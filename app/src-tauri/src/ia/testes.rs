//! Testes do agente sem rede: provedor falso roteirizado, ferramentas do vault e privacidade.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use async_trait::async_trait;
use serde_json::{json, Value};
use super::agente::*;
use super::contexto::*;
use super::ferramentas::*;
use super::provedor::*;
use super::{e_local, validar, ConfigIA, ProvedorCfg, SISTEMA};
use crate::caminhos::{canon, slash};
use crate::propostas::Proposta;
use crate::teste_util::tmpdir;
use crate::{lock, App};

/// Responde com o que foi roteirizado, uma resposta por chamada, e guarda o que recebeu.
struct ProvedorFalso { roteiro: Mutex<VecDeque<Result<Vec<Parte>, String>>>, recebidos: Mutex<Vec<Vec<Msg>>>, cancela_ao_chamar: bool }
impl ProvedorFalso {
    fn novo(r: Vec<Result<Vec<Parte>, String>>) -> Self { ProvedorFalso { roteiro: Mutex::new(r.into()), recebidos: Mutex::new(vec![]), cancela_ao_chamar: false } }
}
#[async_trait]
impl Provedor for ProvedorFalso {
    async fn conversar(&self, req: Requisicao<'_>, emitir: &mut (dyn FnMut(Evento) + Send)) -> Result<Vec<Parte>, String> {
        lock(&self.recebidos).push(req.msgs.to_vec());
        if self.cancela_ao_chamar { req.cancelar.store(true, Ordering::Relaxed); }
        let r = lock(&self.roteiro).pop_front().unwrap_or(Ok(vec![Parte::Texto("(fim do roteiro)".into())]));
        let partes = r?;
        emitir(Evento::Uso { tokens_in: 10, tokens_out: 5 });
        for p in &partes {
            match p {
                Parte::Texto(t) => emitir(Evento::Texto(t.clone())),
                Parte::UsoFerramenta { id, nome, args, .. } => emitir(Evento::UsoFerramenta { id: id.clone(), nome: nome.clone(), args: args.clone() }),
                Parte::ResultadoFerramenta { .. } => {}
            }
        }
        Ok(partes)
    }
}

struct FerramentasFalsas { chamadas: Mutex<Vec<String>> }
impl Ferramentas for FerramentasFalsas {
    fn lista(&self) -> Vec<Ferramenta> { vec![] }
    fn executar(&self, nome: &str, _: &Value) -> Saida { lock(&self.chamadas).push(nome.into()); Saida { texto: format!("resultado de {nome}"), erro: false, proposta: None } }
}

fn uso(id: &str, nome: &str, args: Value) -> Parte { Parte::UsoFerramenta { id: id.into(), nome: nome.into(), args, assinatura: None } }
async fn rodar_com(prov: &dyn Provedor, ferr: &dyn Ferramentas, msgs: &mut Vec<Msg>, max_voltas: usize, cancelar: &AtomicBool) -> Vec<EventoIA> {
    let mut evs = vec![];
    rodar(prov, ferr, &Config { sistema: "s", max_tokens: 100, max_voltas }, msgs, Msg::usuario("pergunta"), cancelar, &mut |e| evs.push(e)).await;
    evs
}

#[tokio::test]
async fn ferramenta_resultado_e_texto_final() {
    let prov = ProvedorFalso::novo(vec![Ok(vec![Parte::Texto("Vou buscar.".into()), uso("t1", "search_notes", json!({"query": "anáfora"}))]), Ok(vec![Parte::Texto("Achei duas.".into())])]);
    let ferr = FerramentasFalsas { chamadas: Mutex::new(vec![]) };
    let mut msgs = vec![];
    let evs = rodar_com(&prov, &ferr, &mut msgs, MAX_VOLTAS, &AtomicBool::new(false)).await;
    assert_eq!(lock(&ferr.chamadas).as_slice(), ["search_notes"]);
    assert!(evs.contains(&EventoIA::Ferramenta { nome: "search_notes".into(), resumo: "Buscou notas: \"anáfora\"".into() }), "{evs:?}");
    assert_eq!(evs.last(), Some(&EventoIA::Fim { motivo: "fim".into() }));
    // totais de tokens somam as duas chamadas
    assert!(evs.contains(&EventoIA::Uso { tokens_in: 20, tokens_out: 10 }), "{evs:?}");
    // a segunda chamada ao modelo recebeu o resultado da ferramenta
    let segunda = &lock(&prov.recebidos)[1];
    assert_eq!(segunda.last().unwrap().partes, vec![Parte::ResultadoFerramenta { id: "t1".into(), texto: "resultado de search_notes".into(), erro: false }]);
    assert_eq!(msgs.len(), 4); // pergunta, ferramenta, resultado, resposta final
}

#[tokio::test]
async fn limite_de_voltas_para_e_deixa_o_historico_valido() {
    let infinito = (0..10).map(|i| Ok(vec![uso(&format!("t{i}"), "progress", json!({}))])).collect();
    let prov = ProvedorFalso::novo(infinito);
    let ferr = FerramentasFalsas { chamadas: Mutex::new(vec![]) };
    let mut msgs = vec![];
    let evs = rodar_com(&prov, &ferr, &mut msgs, 2, &AtomicBool::new(false)).await;
    assert_eq!(lock(&ferr.chamadas).len(), 2, "só 2 voltas executam ferramentas");
    assert!(matches!(evs.last(), Some(EventoIA::Erro { msg }) if msg.contains("limite")), "{evs:?}");
    // toda chamada de ferramenta tem resultado (a conversa pode continuar)
    let ultima = msgs.last().unwrap();
    assert_eq!(ultima.papel, Papel::Usuario);
    assert!(matches!(&ultima.partes[0], Parte::ResultadoFerramenta { erro: true, .. }));
}

#[tokio::test]
async fn cancelar_para_e_nao_executa_ferramentas() {
    let mut prov = ProvedorFalso::novo(vec![Ok(vec![uso("t1", "progress", json!({}))])]);
    prov.cancela_ao_chamar = true;
    let ferr = FerramentasFalsas { chamadas: Mutex::new(vec![]) };
    let mut msgs = vec![Msg::usuario("antes"), Msg { papel: Papel::Assistente, partes: vec![Parte::Texto("ok".into())] }];
    let evs = rodar_com(&prov, &ferr, &mut msgs, MAX_VOLTAS, &AtomicBool::new(false)).await;
    assert!(lock(&ferr.chamadas).is_empty());
    assert_eq!(evs.last(), Some(&EventoIA::Fim { motivo: "cancelado".into() }));
    assert_eq!(msgs.len(), 2, "a pergunta cancelada some do histórico");
}

#[tokio::test]
async fn erro_do_provedor_volta_o_historico_ao_que_era() {
    let prov = ProvedorFalso::novo(vec![Err("Anthropic 529: sobrecarregado".into())]);
    let mut msgs = vec![Msg::usuario("antes")];
    let evs = rodar_com(&prov, &FerramentasFalsas { chamadas: Mutex::new(vec![]) }, &mut msgs, MAX_VOLTAS, &AtomicBool::new(false)).await;
    assert!(matches!(evs.last(), Some(EventoIA::Erro { msg }) if msg.contains("sobrecarregado")));
    assert_eq!(msgs.len(), 1);
}

// ---------- ferramentas do vault e privacidade ----------

fn vault(nome: &str) -> (App, std::path::PathBuf) {
    let d = tmpdir(nome);
    let root = canon(&d).unwrap();
    let w = |rel: &str, t: &str| { let p = root.join(rel); std::fs::create_dir_all(p.parent().unwrap()).unwrap(); std::fs::write(p, t).unwrap(); };
    w("Acervo/Aulas/Aula de Crase.md", "---\ntipo: aula\ntitulo: Crase\n---\n\n# Aula de Crase\n\nUso da crase.\n");
    w("Anos/2026/Correcoes/Lote 1/Redações da 72.md", "---\ntipo: correcao\n---\n\n# Redações\n\nMaria Silva escreveu isto.\n");
    w("Anos/2026/Relatorios/Relatório Ana.md", "---\ntipo: aula\n---\n\n# Relatório Ana\n\nDados da aluna Ana.\n");
    (App::new(root.clone()), root)
}
fn ctx(root: &std::path::Path, rel: &str, texto: &str) -> Contexto { Contexto { path: slash(&root.join(rel)), texto: texto.into(), selecao: None } }

#[test]
fn nota_de_correcao_nao_e_enviada() {
    let (app, root) = vault("ia-privacidade");
    let t = std::fs::read_to_string(root.join("Anos/2026/Correcoes/Lote 1/Redações da 72.md")).unwrap();
    let m = montar_contexto(&app, Some(&ctx(&root, "Anos/2026/Correcoes/Lote 1/Redações da 72.md", &t)));
    assert!(m.texto.is_none() && m.aberta.is_none() && m.aviso.as_deref().unwrap().contains("dados de alunos"));
    // o tipo manda mesmo fora das pastas sensíveis, e a pasta manda mesmo com outro tipo
    let m = montar_contexto(&app, Some(&ctx(&root, "Acervo/Aulas/Aula de Crase.md", "---\ntipo: correcao\n---\nMaria")));
    assert!(m.texto.is_none(), "tipo correcao no texto atual do editor");
    let m = montar_contexto(&app, Some(&ctx(&root, "Anos/2026/Relatorios/Relatório Ana.md", "---\ntipo: aula\n---\nAna")));
    assert!(m.texto.is_none(), "pasta Relatorios");
    // fora do vault
    let m = montar_contexto(&app, Some(&Contexto { path: "/etc/passwd".into(), texto: "x".into(), selecao: None }));
    assert!(m.texto.is_none() && m.aviso.is_some());
    // sem contexto: nada, sem aviso
    let m = montar_contexto(&app, None);
    assert!(m.texto.is_none() && m.aviso.is_none());
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn nota_comum_e_enviada_com_o_texto_do_editor_e_a_selecao() {
    let (app, root) = vault("ia-contexto");
    let mut c = ctx(&root, "Acervo/Aulas/Aula de Crase.md", "---\ntipo: aula\n---\n\n# Aula de Crase\n\ntexto ainda não salvo\n");
    c.selecao = Some("texto ainda".into());
    let m = montar_contexto(&app, Some(&c));
    let t = m.texto.unwrap();
    assert!(t.contains("Aula de Crase") && t.contains("tipo: aula") && t.contains("texto ainda não salvo") && t.contains("Trecho selecionado"), "{t}");
    assert!(m.aberta.is_some());
    let _ = std::fs::remove_dir_all(&root);
}

fn ferr<'a>(app: &'a App, aberta: Option<(std::path::PathBuf, String)>, vistas: &'a Mutex<Vec<Proposta>>) -> FerramentasVault<'a> {
    // o fecho precisa viver tanto quanto o `FerramentasVault`: guardamos numa caixa vazada só nos testes
    let f: &'a (dyn Fn(&Proposta) + Send + Sync) = Box::leak(Box::new(move |p: &Proposta| lock(vistas).push(p.clone())));
    FerramentasVault { app, aberta, ao_propor: f }
}

#[test]
fn ferramenta_fora_da_lista_e_recusada() {
    let (app, root) = vault("ia-lista");
    let vistas = Mutex::new(vec![]);
    let f = ferr(&app, None, &vistas);
    for nome in ["create_note", "plan_ciclo", "rm", "write_file"] {
        let s = f.executar(nome, &json!({"tipo": "aula", "nome": "Nova", "titulo": "x", "aulas": [], "gravar": true}));
        assert!(s.erro && s.texto.contains("não permitida"), "{nome}: {}", s.texto);
    }
    assert!(!root.join("Acervo/Aulas/Nova.md").exists() && !root.join("Acervo/Ciclos").exists(), "nada foi criado");
    let nomes: Vec<String> = f.lista().into_iter().map(|x| x.nome).collect();
    assert!(nomes.contains(&"search_notes".into()) && nomes.contains(&"propor_edicao".into()) && nomes.contains(&"propor_nota".into()));
    assert!(!nomes.contains(&"create_note".into()) && !nomes.contains(&"plan_ciclo".into()), "{nomes:?}");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn leitura_do_vault_pelo_mcp_oculta_dados_de_alunos() {
    let (app, root) = vault("ia-mcp");
    let vistas = Mutex::new(vec![]);
    let f = ferr(&app, None, &vistas);
    let ok = f.executar("read_note", &json!({"nome": "Aula de Crase"}));
    assert!(!ok.erro && ok.texto.contains("Uso da crase"));
    let oculta = f.executar("read_note", &json!({"nome": "Redações da 72"}));
    assert!(oculta.erro && !oculta.texto.contains("Maria"), "{}", oculta.texto);
    let busca = f.executar("search_notes", &json!({"query": "Maria"}));
    assert!(!busca.texto.contains("Redações"), "{}", busca.texto);
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn propor_registra_sem_gravar_em_disco() {
    let (app, root) = vault("ia-propor");
    let aula = root.join("Acervo/Aulas/Aula de Crase.md");
    let antes = std::fs::read_to_string(&aula).unwrap();
    let vistas = Mutex::new(vec![]);
    // a base da proposta é o texto atual do editor (inclusive o não salvo)
    let no_editor = format!("{antes}\nlinha ainda não salva\n");
    let f = ferr(&app, Some((aula.clone(), no_editor.clone())), &vistas);
    let novo = format!("{no_editor}\nMais apoio aqui.\n");
    let s = f.executar("propor_edicao", &json!({"nota": "Aula de Crase", "texto_novo": novo, "resumo": "mais apoio"}));
    assert!(!s.erro, "{}", s.texto);
    let p = s.proposta.unwrap();
    assert_eq!(p.texto_base, no_editor);
    assert_eq!(p.texto_novo, novo);
    assert_eq!(lock(&vistas).len(), 1, "a interface foi avisada");
    assert_eq!(std::fs::read_to_string(&aula).unwrap(), antes, "o arquivo não mudou");
    // nota nova: só proposta, nada no disco
    let s = f.executar("propor_nota", &json!({"tipo": "aula", "nome": "Aula de Vírgula", "texto": "---\ntipo: aula\n---\n# x\n", "resumo": "r"}));
    assert!(!s.erro, "{}", s.texto);
    assert!(s.proposta.unwrap().nova.unwrap().dir.ends_with("Acervo/Aulas"));
    assert!(!root.join("Acervo/Aulas/Aula de Vírgula.md").exists());
    assert_eq!(crate::propostas::pendentes(&app), 2);
    // texto igual ao atual é recusado
    assert!(f.executar("propor_edicao", &json!({"nota": "Aula de Crase", "texto_novo": no_editor, "resumo": "r"})).erro);
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn ia_nao_propoe_nada_sobre_dados_de_alunos() {
    let (app, root) = vault("ia-propor-aluno");
    let vistas = Mutex::new(vec![]);
    let f = ferr(&app, None, &vistas);
    for nome in ["Redações da 72", "Relatório Ana"] {
        let s = f.executar("propor_edicao", &json!({"nota": nome, "texto_novo": "x", "resumo": "r"}));
        assert!(s.erro, "{nome}: {}", s.texto);
    }
    assert!(f.executar("propor_nota", &json!({"tipo": "correcao", "nome": "N", "texto": "x", "resumo": "r"})).erro);
    assert!(f.executar("propor_nota", &json!({"tipo": "aula", "nome": "N", "texto": "---\ntipo: correcao\n---\nx", "resumo": "r"})).erro);
    assert!(lock(&vistas).is_empty());
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn sistema_leva_as_convencoes_do_vault_e_as_regras_do_painel() {
    assert!(SISTEMA.contains("Convenções do vault") && SISTEMA.contains("propor_edicao") && SISTEMA.contains("português"));
}

#[test]
fn config_padrao_vem_desligada_e_a_validacao_exige_o_aviso() {
    let c = ConfigIA::default();
    assert!(!c.ativa && validar(&c).is_ok());
    assert!(validar(&ConfigIA { ativa: true, ..c.clone() }).is_err(), "ligar sem aceitar o aviso");
    assert!(validar(&ConfigIA { ativa: true, aceitou_aviso: true, ..c.clone() }).is_ok());
    assert!(validar(&ConfigIA { max_tokens: 10, ..c.clone() }).is_err());
    assert!(validar(&ConfigIA { provedor: "outro".into(), ..c.clone() }).is_err());
    let mut r = c.clone(); r.provedores[0].modelo = "a b".into();
    assert!(validar(&r).is_err());
}

#[test]
fn validacao_dos_provedores_protege_a_chave() {
    let c = ConfigIA::default();
    let com = |f: &dyn Fn(&mut Vec<ProvedorCfg>)| { let mut x = c.clone(); f(&mut x.provedores); x };
    assert!(validar(&com(&|p| p[1].base_url = "http://api.exemplo.com/v1".into())).is_err(), "http fora do computador carregaria a chave em texto puro");
    assert!(validar(&com(&|p| p[1].base_url = "ftp://x".into())).is_err());
    assert!(validar(&com(&|p| p[2].base_url = "http://127.0.0.1:1234/v1".into())).is_ok(), "http é aceito para o computador local");
    assert!(validar(&com(&|p| p[1].base_url = "https://openrouter.ai/api/v1".into())).is_ok());
    assert!(validar(&com(&|p| p[1].id = "anthropic".into())).is_err(), "id repetido");
    assert!(validar(&com(&|p| p[1].id = "../x".into())).is_err());
    assert!(validar(&com(&|p| p[1].tipo = "outro".into())).is_err());
    assert!(validar(&com(&|p| p.truncate(0))).is_err());
}

#[test]
fn local_e_reconhecido_pelo_endereco() {
    for u in ["http://localhost:11434/v1", "http://127.0.0.1:8080", "http://[::1]:11434/v1", "http://LOCALHOST/v1"] { assert!(e_local(u), "{u}"); }
    for u in ["https://api.openai.com/v1", "http://localhost.evil.com/v1", "http://evil.com/localhost", "http://localhost@evil.com/v1", "https://x.com:443/127.0.0.1"] { assert!(!e_local(u), "{u}"); }
    let n = ConfigIA::default().normalizar();
    assert_eq!(n.provedores.iter().map(|p| p.local).collect::<Vec<_>>(), vec![false, false, false, true]);
    assert!(!n.provedores[3].exige_chave && !n.provedores[3].suporta_ferramentas, "o local não pede chave e começa sem ferramentas");
}

#[test]
fn config_da_etapa_m_migra_para_a_lista_de_provedores() {
    let velha = r#"{"ativa": true, "provedor": "anthropic", "modelo": "claude-meu-modelo", "max_tokens": 2000, "aceitou_aviso": true}"#;
    let c: ConfigIA = serde_json::from_str::<ConfigIA>(velha).unwrap().normalizar();
    assert_eq!(c.provedores.len(), 4);
    assert_eq!(c.selecionado().unwrap().modelo, "claude-meu-modelo");
    assert!(c.ativa && validar(&c).is_ok());
    assert!(serde_json::to_value(&c).unwrap().get("modelo").is_none(), "o campo antigo deixa de ser gravado");
}

// ---------- contrato: a mesma conversa, dois formatos de SSE, os mesmos eventos neutros ----------

fn mesclar_textos(evs: Vec<Evento>) -> Vec<Evento> {
    let mut out: Vec<Evento> = vec![];
    for e in evs {
        match (out.last_mut(), e) {
            (_, Evento::Uso { .. }) => {} // quando e quantas vezes cada provedor informa o uso varia; o conteúdo não
            (Some(Evento::Texto(a)), Evento::Texto(b)) => a.push_str(&b),
            (_, e) => out.push(e),
        }
    }
    out
}

fn por_anthropic(fixture: &str, tam: usize) -> (Vec<Evento>, Vec<Parte>) {
    use super::anthropic::Acumulador;
    use super::sse::ParserSse;
    let (mut sse, mut acc, mut evs) = (ParserSse::default(), Acumulador::default(), vec![]);
    for p in fixture.as_bytes().chunks(tam) { for (n, d) in sse.empurrar(p) { acc.evento(&n, &d, &mut |e| evs.push(e)).unwrap(); } }
    (mesclar_textos(evs), acc.partes())
}

fn por_openai(fixture: &str, tam: usize) -> (Vec<Evento>, Vec<Parte>) {
    use super::openai_compat::Acumulador;
    use super::sse::ParserSse;
    let (mut sse, mut acc, mut evs) = (ParserSse::default(), Acumulador::default(), vec![]);
    for p in fixture.as_bytes().chunks(tam) { for (_, d) in sse.empurrar(p) { acc.evento(&d, &mut |e| evs.push(e)).unwrap(); } }
    (mesclar_textos(evs), acc.partes())
}

#[test]
fn contrato_os_dois_adaptadores_geram_os_mesmos_eventos_neutros() {
    let casos = [
        (include_str!("fixtures/anthropic_texto.sse"), include_str!("fixtures/openai_texto.sse"),
         vec![Evento::Texto("Olá, professor! Posso ajudar.".into()), Evento::Fim("end_turn".into())],
         vec![Parte::Texto("Olá, professor! Posso ajudar.".into())]),
        (include_str!("fixtures/anthropic_ferramenta.sse"), include_str!("fixtures/openai_ferramenta.sse"),
         vec![Evento::Texto("Vou buscar.".into()), Evento::UsoFerramenta { id: "toolu_01".into(), nome: "search_notes".into(), args: json!({"query": "anáfora", "tipo": "texto"}) }, Evento::Fim("tool_use".into())],
         vec![Parte::Texto("Vou buscar.".into()), Parte::UsoFerramenta { id: "toolu_01".into(), nome: "search_notes".into(), args: json!({"query": "anáfora", "tipo": "texto"}), assinatura: None }]),
    ];
    for (anth, oai, eventos, partes) in casos {
        for tam in [6, 41, 100_000] { // pedaços de rede de qualquer tamanho
            assert_eq!(por_anthropic(anth, tam), (eventos.clone(), partes.clone()), "anthropic, pedaços de {tam}");
            assert_eq!(por_openai(oai, tam), (eventos.clone(), partes.clone()), "openai-compat, pedaços de {tam}");
        }
    }
}

/// Os dois formatos, alimentando o mesmo agente, levam à mesma conversa neutra (ferramenta → resultado → texto).
#[tokio::test]
async fn contrato_o_agente_nao_depende_do_formato() {
    let (_, partes) = por_openai(include_str!("fixtures/openai_ferramenta.sse"), 50);
    let (_, partes_a) = por_anthropic(include_str!("fixtures/anthropic_ferramenta.sse"), 50);
    assert_eq!(partes, partes_a);
    for p in [partes, partes_a] {
        let prov = ProvedorFalso::novo(vec![Ok(p), Ok(vec![Parte::Texto("Achei.".into())])]);
        let ferr = FerramentasFalsas { chamadas: Mutex::new(vec![]) };
        let mut msgs = vec![];
        let evs = rodar_com(&prov, &ferr, &mut msgs, MAX_VOLTAS, &AtomicBool::new(false)).await;
        assert_eq!(lock(&ferr.chamadas).as_slice(), ["search_notes"]);
        assert_eq!(evs.last(), Some(&EventoIA::Fim { motivo: "fim".into() }));
    }
}
