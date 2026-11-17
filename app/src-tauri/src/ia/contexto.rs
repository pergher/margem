//! Contexto da nota aberta que acompanha a pergunta. A checagem de privacidade é feita aqui, no Rust: o que o frontend
//! manda é só uma proposta de contexto, nunca uma ordem de envio.

use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use vault_core::mcp::nota_sensivel;
use crate::caminhos::{inside, root_of};
use crate::App;

/// Limite do texto da nota enviado (caracteres): notas gigantes não estouram o contexto nem o custo.
const MAX_NOTA: usize = 60_000;
const MAX_SELECAO: usize = 20_000;

#[derive(Deserialize, Clone, Debug)]
pub struct Contexto { pub path: String, pub texto: String, pub selecao: Option<String> }

#[derive(Serialize, Debug, Default)]
pub struct ContextoMontado {
    /// Texto que vai junto da pergunta (`None` = nada da nota é enviado).
    pub texto: Option<String>,
    /// Por que a nota não foi enviada (privacidade, caminho inválido).
    pub aviso: Option<String>,
    #[serde(skip)]
    pub aberta: Option<(PathBuf, String)>,
}

/// `tipo:` do frontmatter lido linha a linha (não depende de o YAML estar válido: na dúvida, a nota é tratada pelo que diz).
pub(crate) fn tipo_do_texto(texto: &str) -> Option<String> {
    let s = vault_core::frontmatter::split(texto);
    let yaml = s.yaml?;
    yaml.lines().find_map(|l| l.strip_prefix("tipo:").map(|v| v.trim().trim_matches(['"', '\'']).to_lowercase()))
}

fn cortar(t: &str, max: usize) -> String {
    if t.chars().count() <= max { return t.to_string(); }
    format!("{}\n[... texto cortado: a nota é maior que {max} caracteres ...]", t.chars().take(max).collect::<String>())
}

pub fn montar_contexto(app: &App, ctx: Option<&Contexto>) -> ContextoMontado {
    let Some(c) = ctx else { return ContextoMontado::default() };
    let (p, root) = match (inside(app, &c.path), root_of(app)) {
        (Ok(p), Ok(r)) => (p, r),
        _ => return ContextoMontado { aviso: Some("A nota aberta está fora do vault: o conteúdo não foi enviado.".into()), ..Default::default() },
    };
    let tipo = tipo_do_texto(&c.texto);
    if nota_sensivel(&root, &p, tipo.as_deref()) {
        return ContextoMontado { aviso: Some("Esta nota tem dados de alunos: o conteúdo não foi enviado à IA. A conversa segue só com perguntas gerais.".into()), ..Default::default() };
    }
    let nome = p.file_stem().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let mut t = format!("[Contexto do Margem] Nota aberta no editor: \"{nome}\"{}.\n```markdown\n{}\n```", tipo.map(|t| format!(" (tipo: {t})")).unwrap_or_default(), cortar(&c.texto, MAX_NOTA));
    if let Some(s) = c.selecao.as_deref().filter(|s| !s.trim().is_empty()) {
        t.push_str(&format!("\nTrecho selecionado pelo usuário:\n```\n{}\n```", cortar(s, MAX_SELECAO)));
    }
    ContextoMontado { texto: Some(t), aviso: None, aberta: Some((p, c.texto.clone())) }
}
