//! Provedor Anthropic (`/v1/messages`, com streaming SSE e ferramentas). A chave só existe aqui, no Rust.

use std::collections::BTreeMap;
use std::sync::atomic::Ordering;
use std::time::Duration;
use async_trait::async_trait;
use futures_util::StreamExt;
use serde_json::{json, Value};
use super::provedor::*;
use super::sse::ParserSse;

pub const URL: &str = "https://api.anthropic.com/v1/messages";
const VERSAO_API: &str = "2023-06-01";
/// Sem nenhum byte por este tempo, a conexão é considerada travada.
const OCIOSO: Duration = Duration::from_secs(90);

pub struct Anthropic { pub chave: String, pub modelo: String, pub url: String }

impl Anthropic {
    pub fn novo(chave: String, modelo: String) -> Self { Anthropic { chave, modelo, url: URL.into() } }
}

fn parte_json(p: &Parte) -> Value {
    match p {
        Parte::Texto(t) => json!({"type": "text", "text": t}),
        Parte::UsoFerramenta { id, nome, args } => json!({"type": "tool_use", "id": id, "name": nome, "input": args}),
        Parte::ResultadoFerramenta { id, texto, erro } => json!({"type": "tool_result", "tool_use_id": id, "content": texto, "is_error": erro}),
    }
}

pub(crate) fn corpo(modelo: &str, req: &Requisicao<'_>) -> Value {
    let msgs: Vec<Value> = req.msgs.iter().map(|m| json!({
        "role": if m.papel == Papel::Usuario { "user" } else { "assistant" },
        "content": m.partes.iter().map(parte_json).collect::<Vec<_>>(),
    })).collect();
    let mut c = json!({"model": modelo, "max_tokens": req.max_tokens, "system": req.sistema, "messages": msgs, "stream": true});
    if !req.ferramentas.is_empty() {
        c["tools"] = req.ferramentas.iter().map(|f| json!({"name": f.nome, "description": f.descricao, "input_schema": f.schema})).collect();
    }
    c
}

enum Bloco { Texto(String), Ferramenta { id: String, nome: String, json: String } }

/// Junta os eventos do stream em partes completas. Os argumentos de uma ferramenta chegam em fragmentos de JSON
/// (`input_json_delta`): só são decodificados quando o bloco fecha.
#[derive(Default)]
pub(crate) struct Acumulador { blocos: BTreeMap<usize, Bloco>, tokens_in: u64, tokens_out: u64, pub parada: Option<String>, pub fim: bool }

impl Acumulador {
    pub(crate) fn evento(&mut self, nome: &str, dados: &str, emitir: &mut (dyn FnMut(Evento) + Send)) -> Result<(), String> {
        if dados.trim().is_empty() { return Ok(()); }
        let d: Value = serde_json::from_str(dados).map_err(|e| format!("resposta ilegível ({nome}): {e}"))?;
        let tipo = d.get("type").and_then(Value::as_str).unwrap_or(nome);
        let idx = d.get("index").and_then(Value::as_u64).unwrap_or(0) as usize;
        match tipo {
            "message_start" => {
                self.tokens_in = d.pointer("/message/usage/input_tokens").and_then(Value::as_u64).unwrap_or(0);
                emitir(Evento::Uso { tokens_in: self.tokens_in, tokens_out: self.tokens_out });
            }
            "content_block_start" => {
                let b = &d["content_block"];
                match b.get("type").and_then(Value::as_str) {
                    Some("text") => {
                        let t = b.get("text").and_then(Value::as_str).unwrap_or("").to_string();
                        if !t.is_empty() { emitir(Evento::Texto(t.clone())); }
                        self.blocos.insert(idx, Bloco::Texto(t));
                    }
                    Some("tool_use") => {
                        let s = |k: &str| b.get(k).and_then(Value::as_str).unwrap_or("").to_string();
                        self.blocos.insert(idx, Bloco::Ferramenta { id: s("id"), nome: s("name"), json: String::new() });
                    }
                    _ => {} // blocos que o app não usa (thinking etc.) são ignorados
                }
            }
            "content_block_delta" => match (d.pointer("/delta/type").and_then(Value::as_str), self.blocos.get_mut(&idx)) {
                (Some("text_delta"), Some(Bloco::Texto(t))) => {
                    let novo = d.pointer("/delta/text").and_then(Value::as_str).unwrap_or("");
                    t.push_str(novo);
                    emitir(Evento::Texto(novo.to_string()));
                }
                (Some("input_json_delta"), Some(Bloco::Ferramenta { json, .. })) => json.push_str(d.pointer("/delta/partial_json").and_then(Value::as_str).unwrap_or("")),
                _ => {}
            },
            "content_block_stop" => {
                if let Some(Bloco::Ferramenta { id, nome, json }) = self.blocos.get(&idx) {
                    let args = decodificar(json)?;
                    emitir(Evento::UsoFerramenta { id: id.clone(), nome: nome.clone(), args });
                }
            }
            "message_delta" => {
                if let Some(p) = d.pointer("/delta/stop_reason").and_then(Value::as_str) { self.parada = Some(p.to_string()); }
                if let Some(o) = d.pointer("/usage/output_tokens").and_then(Value::as_u64) { self.tokens_out = o; }
                emitir(Evento::Uso { tokens_in: self.tokens_in, tokens_out: self.tokens_out });
            }
            "message_stop" => { self.fim = true; emitir(Evento::Fim(self.parada.clone().unwrap_or_else(|| "end_turn".into()))); }
            "error" => return Err(format!("Anthropic: {}", d.pointer("/error/message").and_then(Value::as_str).unwrap_or("erro desconhecido"))),
            _ => {} // ping etc.
        }
        Ok(())
    }

    /// Partes completas, na ordem. Ferramenta cujo JSON ficou incompleto (stream cortado/cancelado) é descartada.
    pub(crate) fn partes(self) -> Vec<Parte> {
        self.blocos.into_values().filter_map(|b| match b {
            Bloco::Texto(t) if t.is_empty() => None,
            Bloco::Texto(t) => Some(Parte::Texto(t)),
            Bloco::Ferramenta { id, nome, json } => decodificar(&json).ok().map(|args| Parte::UsoFerramenta { id, nome, args }),
        }).collect()
    }
}

fn decodificar(json: &str) -> Result<Value, String> {
    if json.trim().is_empty() { return Ok(json!({})); }
    serde_json::from_str(json).map_err(|e| format!("argumentos de ferramenta ilegíveis: {e}"))
}

/// Mensagem de erro da API sem nunca repetir cabeçalhos (a chave vai só no cabeçalho `x-api-key`).
fn erro_http(status: reqwest::StatusCode, corpo: &str) -> String {
    let msg = serde_json::from_str::<Value>(corpo).ok().and_then(|v| v.pointer("/error/message").and_then(Value::as_str).map(String::from)).unwrap_or_else(|| corpo.chars().take(200).collect());
    match status.as_u16() {
        401 | 403 => format!("Anthropic recusou a chave ({status}). Confira a chave em Configurações › IA."),
        429 => format!("Limite de uso da Anthropic atingido ({status}): {msg}"),
        _ => format!("Anthropic {status}: {msg}"),
    }
}

#[async_trait]
impl Provedor for Anthropic {
    async fn conversar(&self, req: Requisicao<'_>, emitir: &mut (dyn FnMut(Evento) + Send)) -> Result<Vec<Parte>, String> {
        let cliente = reqwest::Client::builder().connect_timeout(Duration::from_secs(15)).build().map_err(|e| e.to_string())?;
        let resp = cliente.post(&self.url)
            .header("x-api-key", &self.chave).header("anthropic-version", VERSAO_API).header("content-type", "application/json")
            .json(&corpo(&self.modelo, &req)).send().await.map_err(|e| format!("sem conexão com a Anthropic: {}", e.without_url()))?;
        let status = resp.status();
        if !status.is_success() { return Err(erro_http(status, &resp.text().await.unwrap_or_default())); }
        let (mut sse, mut acc) = (ParserSse::default(), Acumulador::default());
        let mut fluxo = resp.bytes_stream();
        loop {
            if req.cancelar.load(Ordering::Relaxed) { break; }
            let Some(pedaco) = tokio::time::timeout(OCIOSO, fluxo.next()).await.map_err(|_| "a Anthropic parou de responder (sem dados por 90 s)".to_string())? else { break };
            for (nome, dados) in sse.empurrar(&pedaco.map_err(|e| format!("conexão interrompida: {}", e.without_url()))?) { acc.evento(&nome, &dados, emitir)?; }
            if acc.fim { break; }
        }
        Ok(acc.partes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;

    const TEXTO: &str = include_str!("fixtures/anthropic_texto.sse");
    const FERRAMENTA: &str = include_str!("fixtures/anthropic_ferramenta.sse");

    fn rodar(fixture: &str, tamanho_pedaco: usize) -> (Vec<Evento>, Acumulador) {
        let (mut sse, mut acc, mut evs) = (ParserSse::default(), Acumulador::default(), vec![]);
        for p in fixture.as_bytes().chunks(tamanho_pedaco) {
            for (n, d) in sse.empurrar(p) { acc.evento(&n, &d, &mut |e| evs.push(e)).unwrap(); }
        }
        (evs, acc)
    }

    #[test]
    fn texto_em_streaming_vira_uma_parte_e_conta_tokens() {
        for tam in [7, 64, 100_000] { // pedaços de rede cortados em qualquer ponto dão o mesmo resultado
            let (evs, acc) = rodar(TEXTO, tam);
            let texto: String = evs.iter().filter_map(|e| if let Evento::Texto(t) = e { Some(t.as_str()) } else { None }).collect();
            assert_eq!(texto, "Olá, professor! Posso ajudar.");
            assert_eq!(acc.parada.as_deref(), Some("end_turn"));
            assert!(evs.contains(&Evento::Uso { tokens_in: 25, tokens_out: 9 }), "{evs:?}");
            assert_eq!(evs.last(), Some(&Evento::Fim("end_turn".into())));
            assert_eq!(acc.partes(), vec![Parte::Texto("Olá, professor! Posso ajudar.".into())]);
        }
    }

    #[test]
    fn argumentos_da_ferramenta_chegam_em_fragmentos_e_so_sao_decodificados_no_fim() {
        for tam in [5, 33, 100_000] {
            let (evs, acc) = rodar(FERRAMENTA, tam);
            let usos: Vec<&Evento> = evs.iter().filter(|e| matches!(e, Evento::UsoFerramenta { .. })).collect();
            assert_eq!(usos, vec![&Evento::UsoFerramenta { id: "toolu_01".into(), nome: "search_notes".into(), args: json!({"query": "anáfora", "tipo": "texto"}) }]);
            assert_eq!(acc.parada.as_deref(), Some("tool_use"));
            assert_eq!(acc.partes(), vec![
                Parte::Texto("Vou buscar.".into()),
                Parte::UsoFerramenta { id: "toolu_01".into(), nome: "search_notes".into(), args: json!({"query": "anáfora", "tipo": "texto"}) },
            ]);
        }
    }

    #[test]
    fn ferramenta_cortada_no_meio_e_descartada() {
        let mut acc = Acumulador::default();
        let mut nada = |_e: Evento| {};
        acc.evento("content_block_start", r#"{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t","name":"x","input":{}}}"#, &mut nada).unwrap();
        acc.evento("content_block_delta", r#"{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"a\":"}}"#, &mut nada).unwrap();
        assert!(acc.partes().is_empty());
    }

    #[test]
    fn evento_de_erro_vira_erro() {
        let e = Acumulador::default().evento("error", r#"{"type":"error","error":{"type":"overloaded_error","message":"Sobrecarregado"}}"#, &mut |_| {}).unwrap_err();
        assert!(e.contains("Sobrecarregado"));
    }

    #[test]
    fn corpo_da_requisicao_segue_o_formato_da_api() {
        let cancelar = AtomicBool::new(false);
        let msgs = vec![
            Msg::usuario("oi"),
            Msg { papel: Papel::Assistente, partes: vec![Parte::UsoFerramenta { id: "t1".into(), nome: "read_note".into(), args: json!({"nome": "A"}) }] },
            Msg { papel: Papel::Usuario, partes: vec![Parte::ResultadoFerramenta { id: "t1".into(), texto: "conteúdo".into(), erro: false }] },
        ];
        let fs = vec![Ferramenta { nome: "read_note".into(), descricao: "Lê".into(), schema: json!({"type": "object"}) }];
        let c = corpo("modelo-x", &Requisicao { sistema: "sis", msgs: &msgs, ferramentas: &fs, max_tokens: 1000, cancelar: &cancelar });
        assert_eq!(c["model"], "modelo-x");
        assert_eq!(c["max_tokens"], 1000);
        assert_eq!(c["system"], "sis");
        assert_eq!(c["stream"], true);
        assert_eq!(c["messages"][0], json!({"role": "user", "content": [{"type": "text", "text": "oi"}]}));
        assert_eq!(c["messages"][1]["content"][0], json!({"type": "tool_use", "id": "t1", "name": "read_note", "input": {"nome": "A"}}));
        assert_eq!(c["messages"][2]["content"][0], json!({"type": "tool_result", "tool_use_id": "t1", "content": "conteúdo", "is_error": false}));
        assert_eq!(c["tools"][0], json!({"name": "read_note", "description": "Lê", "input_schema": {"type": "object"}}));
        let sem = corpo("m", &Requisicao { sistema: "s", msgs: &msgs[..1], ferramentas: &[], max_tokens: 1, cancelar: &cancelar });
        assert!(sem.get("tools").is_none(), "sem ferramentas não manda `tools`");
    }

    #[test]
    fn erro_http_nao_vaza_nada_alem_da_mensagem() {
        let e = erro_http(reqwest::StatusCode::UNAUTHORIZED, r#"{"error":{"message":"invalid x-api-key"}}"#);
        assert!(e.contains("recusou a chave") && !e.contains("sk-"));
        assert!(erro_http(reqwest::StatusCode::TOO_MANY_REQUESTS, r#"{"error":{"message":"rate"}}"#).contains("rate"));
    }
}
