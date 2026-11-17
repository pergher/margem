//! Ferramentas que a IA pode usar: leitura do vault pelo `vault_core::mcp::Server` (dentro do processo, sem
//! `--expor-correcoes`), mais duas do próprio app que **não gravam**: só registram propostas para o usuário aprovar.

use std::path::PathBuf;
use serde_json::{json, Value};
use vault_core::mcp::{nota_sensivel, Server};
use vault_core::validate::required_fields;
use super::contexto::tipo_do_texto;
use super::provedor::Ferramenta;
use crate::caminhos::{canon, root_of, slash};
use crate::gravacao::normalizar;
use crate::propostas::{registrar, NovaNota, Proposta};
use crate::{com_vault, App};

/// Só leitura. `create_note` e `plan_ciclo` ficam de fora de propósito: escrever só por proposta.
pub const PERMITIDAS: [&str; 6] = ["search_notes", "read_note", "backlinks", "validate", "get_habilidade", "progress"];
const MAX_SAIDA: usize = 30_000;

pub struct Saida { pub texto: String, pub erro: bool, pub proposta: Option<Proposta> }
impl Saida {
    fn erro(t: impl Into<String>) -> Self { Saida { texto: t.into(), erro: true, proposta: None } }
}

pub trait Ferramentas: Send + Sync {
    fn lista(&self) -> Vec<Ferramenta>;
    fn executar(&self, nome: &str, args: &Value) -> Saida;
}

/// Linha discreta que o painel mostra quando a IA usa uma ferramenta.
pub fn descrever(nome: &str, args: &Value) -> String {
    let s = |k: &str| args.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    match nome {
        "search_notes" => format!("Buscou notas: \"{}\"", s("query")),
        "read_note" => format!("Leu a nota \"{}\"", s("nome")),
        "backlinks" => format!("Viu os links para \"{}\"", s("nome")),
        "validate" => if s("nome").is_empty() { "Validou o vault".into() } else { format!("Validou \"{}\"", s("nome")) },
        "get_habilidade" => format!("Consultou a habilidade {}", s("codigo")),
        "progress" => "Consultou o progresso dos ciclos".into(),
        "propor_edicao" => format!("Propôs uma edição em \"{}\"", s("nota")),
        "propor_nota" => format!("Propôs a nota nova \"{}\"", s("nome")),
        outro => format!("Usou {outro}"),
    }
}

pub struct FerramentasVault<'a> {
    pub app: &'a App,
    /// Nota aberta no editor (caminho e texto atual, inclusive o não salvo): é a base das propostas sobre ela.
    pub aberta: Option<(PathBuf, String)>,
    /// Avisa a interface de uma proposta nova (evento `proposta-nova`).
    pub ao_propor: &'a (dyn Fn(&Proposta) + Send + Sync),
}

impl FerramentasVault<'_> {
    fn servidor(&self) -> Server { Server { root: self.app.root(), expor_correcoes: false } }

    fn mcp(&self, nome: &str, args: &Value) -> Saida {
        let r = self.servidor().handle(&json!({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": nome, "arguments": args}}));
        let Some(r) = r.and_then(|r| r.get("result").cloned()) else { return Saida::erro("a ferramenta não respondeu") };
        let texto = r.pointer("/content/0/text").and_then(Value::as_str).unwrap_or("").to_string();
        let t = if texto.chars().count() > MAX_SAIDA { format!("{}\n[... resultado cortado ...]", texto.chars().take(MAX_SAIDA).collect::<String>()) } else { texto };
        Saida { texto: t, erro: r.get("isError").and_then(Value::as_bool).unwrap_or(false), proposta: None }
    }

    fn propor_edicao(&self, a: &Value) -> Saida {
        let s = |k: &str| a.get(k).and_then(Value::as_str);
        let (Some(nome), Some(novo)) = (s("nota"), s("texto_novo")) else { return Saida::erro("faltou `nota` ou `texto_novo`") };
        if novo.trim().is_empty() { return Saida::erro("`texto_novo` vazio: a proposta precisa trazer o texto inteiro da nota"); }
        let achada = com_vault(self.app, |v| v.resolve(nome).map(|n| (n.path.clone(), n.tipo().map(String::from)))).ok().flatten();
        let Some((path, tipo)) = achada else { return Saida::erro(format!("nota `{nome}` não encontrada")) };
        let root = match root_of(self.app) { Ok(r) => r, Err(e) => return Saida::erro(e) };
        let (ca, cr) = (canon(&path).unwrap_or(path.clone()), root);
        if nota_sensivel(&cr, &ca, tipo.as_deref()) { return Saida::erro("nota com dados de alunos: não pode ser alterada pela IA"); }
        let base = match &self.aberta {
            Some((p, t)) if canon(p).ok().as_ref() == Some(&ca) => t.clone(), // o que está no editor agora
            _ => match std::fs::read_to_string(&path) { Ok(t) => normalizar(t), Err(e) => return Saida::erro(e.to_string()) },
        };
        if tipo_do_texto(&base).is_some_and(|t| matches!(t.as_str(), "correcao" | "diario" | "aluno")) { return Saida::erro("nota com dados de alunos: não pode ser alterada pela IA"); }
        if normalizar(novo.to_string()) == base { return Saida::erro("o texto proposto é igual ao atual"); }
        self.registrar(Some(slash(&ca)), None, &base, novo.to_string(), s("resumo").unwrap_or("Edição proposta pela IA"))
    }

    fn propor_nota(&self, a: &Value) -> Saida {
        let s = |k: &str| a.get(k).and_then(Value::as_str);
        let (Some(tipo), Some(nome), Some(texto)) = (s("tipo"), s("nome"), s("texto")) else { return Saida::erro("faltou `tipo`, `nome` ou `texto`") };
        if required_fields(tipo).is_none() { return Saida::erro(format!("tipo `{tipo}` não existe")); }
        if matches!(tipo, "correcao" | "diario" | "aluno") { return Saida::erro("a IA não cria notas com dados de alunos"); }
        if tipo_do_texto(texto).is_some_and(|t| matches!(t.as_str(), "correcao" | "diario" | "aluno")) { return Saida::erro("a IA não cria notas com dados de alunos"); }
        let dir = self.servidor().destino_dir(tipo);
        self.registrar(None, Some(NovaNota { dir: slash(&dir), nome: nome.trim().trim_end_matches(".md").to_string() }), "", texto.to_string(), s("resumo").unwrap_or("Nota nova proposta pela IA"))
    }

    fn registrar(&self, nota: Option<String>, nova: Option<NovaNota>, base: &str, novo: String, resumo: &str) -> Saida {
        match registrar(self.app, nota, nova, base, novo, resumo.to_string()) {
            Ok(p) => {
                (self.ao_propor)(&p);
                Saida { texto: format!("Proposta registrada (id {}), aguardando aprovação do usuário. Nada foi gravado.", p.id), erro: false, proposta: Some(p) }
            }
            Err(e) => Saida::erro(e),
        }
    }
}

impl Ferramentas for FerramentasVault<'_> {
    fn lista(&self) -> Vec<Ferramenta> {
        let r = self.servidor().handle(&json!({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}));
        let mut out: Vec<Ferramenta> = r.and_then(|r| r.pointer("/result/tools").cloned()).and_then(|t| t.as_array().cloned()).unwrap_or_default().iter()
            .filter(|t| PERMITIDAS.contains(&t["name"].as_str().unwrap_or("")))
            .map(|t| Ferramenta { nome: t["name"].as_str().unwrap_or("").into(), descricao: t["description"].as_str().unwrap_or("").into(), schema: t["inputSchema"].clone() })
            .collect();
        out.push(Ferramenta {
            nome: "propor_edicao".into(),
            descricao: "Propõe uma alteração numa nota existente. NÃO grava: o usuário vê as diferenças e aprova. `texto_novo` é o texto COMPLETO da nota (com o frontmatter), não um trecho. Use sempre que quiser alterar uma nota.".into(),
            schema: json!({"type": "object", "properties": {"nota": {"type": "string", "description": "nome da nota, sem caminho"}, "texto_novo": {"type": "string"}, "resumo": {"type": "string", "description": "uma frase sobre o que mudou"}}, "required": ["nota", "texto_novo", "resumo"]}),
        });
        out.push(Ferramenta {
            nome: "propor_nota".into(),
            descricao: "Propõe uma nota nova (vai para a pasta certa conforme o tipo). NÃO grava: o usuário aprova antes. `texto` é a nota inteira, com frontmatter.".into(),
            schema: json!({"type": "object", "properties": {"tipo": {"type": "string"}, "nome": {"type": "string"}, "texto": {"type": "string"}, "resumo": {"type": "string"}}, "required": ["tipo", "nome", "texto", "resumo"]}),
        });
        out
    }

    fn executar(&self, nome: &str, args: &Value) -> Saida {
        match nome {
            "propor_edicao" => self.propor_edicao(args),
            "propor_nota" => self.propor_nota(args),
            n if PERMITIDAS.contains(&n) => self.mcp(n, args),
            n => Saida::erro(format!("ferramenta `{n}` não permitida")),
        }
    }
}
