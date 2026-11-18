//! O laço do agente: pergunta → resposta com chamadas de ferramenta → resultados → resposta final.
//! Independe de Tauri e de rede: testado com um provedor falso.

use std::sync::atomic::{AtomicBool, Ordering};
use serde::Serialize;
use super::ferramentas::{descrever, Ferramentas};
use super::provedor::*;

/// Voltas de ferramenta por pergunta (cada volta = uma chamada ao modelo seguida da execução das ferramentas).
pub const MAX_VOLTAS: usize = 8;

/// O que a interface recebe pelo canal.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "tipo", rename_all = "snake_case")]
pub enum EventoIA {
    Texto { texto: String },
    Ferramenta { nome: String, resumo: String },
    Proposta { id: u64, resumo: String, nota: Option<String>, nova: Option<String> },
    /// Totais acumulados da pergunta (somando todas as voltas).
    Uso { tokens_in: u64, tokens_out: u64 },
    Aviso { msg: String },
    Erro { msg: String },
    Fim { motivo: String },
}

pub struct Config<'a> { pub sistema: &'a str, pub max_tokens: u32, pub max_voltas: usize }

/// Acrescenta a pergunta a `msgs` e roda o agente até a resposta final. Em erro ou cancelamento, `msgs` volta a um estado
/// válido (sem chamada de ferramenta sem resultado), para a conversa poder continuar.
pub async fn rodar(
    prov: &dyn Provedor, ferr: &dyn Ferramentas, cfg: &Config<'_>, msgs: &mut Vec<Msg>, pergunta: Msg,
    cancelar: &AtomicBool, emitir: &mut (dyn FnMut(EventoIA) + Send),
) {
    let inicio = msgs.len();
    msgs.push(pergunta);
    let lista = ferr.lista();
    let (mut tot_in, mut tot_out) = (0u64, 0u64);
    for volta in 0.. {
        if cancelar.load(Ordering::Relaxed) { return cancelado(msgs, inicio, emitir); }
        let (mut ult_in, mut ult_out) = (0u64, 0u64);
        let r = {
            let mut ao_evento = |e: Evento| match e {
                Evento::Texto(t) => emitir(EventoIA::Texto { texto: t }),
                Evento::UsoFerramenta { nome, args, .. } => emitir(EventoIA::Ferramenta { resumo: descrever(&nome, &args), nome }),
                Evento::Uso { tokens_in, tokens_out } => { ult_in = tokens_in; ult_out = tokens_out; emitir(EventoIA::Uso { tokens_in: tot_in + tokens_in, tokens_out: tot_out + tokens_out }) }
                Evento::Aviso(msg) => emitir(EventoIA::Aviso { msg }),
                Evento::Fim(_) => {}
            };
            prov.conversar(Requisicao { sistema: cfg.sistema, msgs, ferramentas: &lista, max_tokens: cfg.max_tokens, cancelar }, &mut ao_evento).await
        };
        tot_in += ult_in; tot_out += ult_out;
        let partes = match r {
            Ok(p) => p,
            Err(msg) => { msgs.truncate(inicio); emitir(EventoIA::Erro { msg }); return; }
        };
        if cancelar.load(Ordering::Relaxed) {
            // guarda o que já apareceu na tela, sem chamadas de ferramenta incompletas
            let so_texto: Vec<Parte> = partes.into_iter().filter(|p| matches!(p, Parte::Texto(_))).collect();
            if so_texto.is_empty() { msgs.truncate(inicio); } else { msgs.push(Msg { papel: Papel::Assistente, partes: so_texto }); }
            emitir(EventoIA::Fim { motivo: "cancelado".into() });
            return;
        }
        let usos: Vec<(String, String, serde_json::Value)> = partes.iter().filter_map(|p| if let Parte::UsoFerramenta { id, nome, args, .. } = p { Some((id.clone(), nome.clone(), args.clone())) } else { None }).collect();
        msgs.push(Msg { papel: Papel::Assistente, partes });
        if usos.is_empty() { emitir(EventoIA::Fim { motivo: "fim".into() }); return; }

        let mut resultados = vec![];
        let no_limite = volta >= cfg.max_voltas;
        for (id, nome, args) in usos {
            if no_limite || cancelar.load(Ordering::Relaxed) {
                resultados.push(Parte::ResultadoFerramenta { id, texto: "não executada: limite de voltas ou cancelamento".into(), erro: true });
                continue;
            }
            let s = ferr.executar(&nome, &args);
            if let Some(p) = &s.proposta { emitir(EventoIA::Proposta { id: p.id, resumo: p.resumo.clone(), nota: p.nota.clone(), nova: p.nova.as_ref().map(|n| n.nome.clone()) }); }
            resultados.push(Parte::ResultadoFerramenta { id, texto: s.texto, erro: s.erro });
        }
        msgs.push(Msg { papel: Papel::Usuario, partes: resultados });
        if no_limite { emitir(EventoIA::Erro { msg: format!("A IA passou do limite de {} voltas de ferramenta e foi interrompida.", cfg.max_voltas) }); return; }
        if cancelar.load(Ordering::Relaxed) { return cancelado(msgs, inicio, emitir); }
    }
}

/// Cancelou entre as voltas: volta ao começo da pergunta (o histórico fica válido).
fn cancelado(msgs: &mut Vec<Msg>, inicio: usize, emitir: &mut (dyn FnMut(EventoIA) + Send)) {
    msgs.truncate(inicio);
    emitir(EventoIA::Fim { motivo: "cancelado".into() });
}
