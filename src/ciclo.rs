//! Montagem de um ciclo novo a partir de uma proposta (usada pelo MCP `plan_ciclo`).
//! O ciclo é só uma sequência ordenada de aulas, sem datas, ano nem turma: atemporal (docs/formato-do-vault.md).

use crate::vault::Vault;

pub struct Aula {
    pub conteudo: String,
    pub recurso: String,
}

pub struct Proposta {
    pub titulo: String,
    pub objetivo: String,
    pub conteudos: Vec<String>,
    pub habilidades: Vec<String>,
    pub aulas: Vec<Aula>,
}

pub struct Montado {
    pub nome: String,
    pub texto: String,
    pub avisos: Vec<String>,
}

fn cel(s: &str) -> String {
    s.replace('|', "\\|").replace('\n', " ").trim().to_string()
}

/// Texto da habilidade BNCC/CBTC pelo código (linha `- **EF06LP04** texto ^ef06lp04`).
pub fn habilidade(v: &Vault, codigo: &str) -> Option<String> {
    let cod = codigo.to_lowercase();
    for n in v.notes.iter().filter(|n| matches!(n.tipo(), Some("habilidades-bncc" | "habilidades-cbtc"))) {
        for l in n.text.lines() {
            let l = l.trim_end();
            if let Some(corpo) = l.strip_suffix(&format!("^{cod}")) {
                let t = corpo.trim().trim_start_matches('-').trim().replace("**", "");
                return Some(t.trim_start_matches(&codigo.to_uppercase()).trim().to_string());
            }
        }
    }
    None
}

pub fn montar(v: &Vault, p: &Proposta) -> Result<Montado, String> {
    let titulo = p.titulo.trim();
    if titulo.is_empty() || titulo.contains(['/', '\\', ':']) || titulo.starts_with('.') {
        return Err("título inválido (vazio ou com barras/dois-pontos)".into());
    }
    if p.aulas.is_empty() {
        return Err("o ciclo precisa de ao menos uma aula".into());
    }
    let nome = titulo.to_string();
    if let Some(n) = v.resolve(&nome) {
        return Err(format!("já existe uma nota chamada `{}`", n.name));
    }
    let mut avisos = vec![];
    let mut t = String::from("---\ntipo: ciclo\n");
    if !p.objetivo.trim().is_empty() {
        t.push_str(&format!("objetivo: \"{}\"\n", p.objetivo.trim().replace('"', "'")));
    }
    t.push_str("---\n## Conteúdos\n\n");
    for c in &p.conteudos {
        t.push_str(&format!("- {}\n", c.trim()));
    }
    t.push_str("\n## Habilidades\n\n");
    for h in &p.habilidades {
        let cod = h.trim().to_uppercase();
        match habilidade(v, &cod) {
            Some(txt) => t.push_str(&format!("({cod}) {txt}\n")),
            None => {
                avisos.push(format!("habilidade {cod} não encontrada nas notas BNCC/CBTC; mantida só com o código"));
                t.push_str(&format!("({cod})\n"));
            }
        }
    }
    t.push_str("\n## Aulas\n\n| # | Conteúdo | Recurso |\n| --- | --- | --- |\n");
    for (i, a) in p.aulas.iter().enumerate() {
        let r = a.recurso.trim().trim_start_matches("[[").trim_end_matches("]]").trim();
        let rec = if r.is_empty() {
            String::new()
        } else if v.resolve(r).is_some() {
            format!("[[{}]]", cel(r))
        } else {
            avisos.push(format!("aula {}: recurso `{r}` não existe no vault; gravado como texto simples", i + 1));
            cel(r)
        };
        t.push_str(&format!("| {} | {} | {} |\n", i + 1, cel(&a.conteudo), rec));
    }
    let ultima = p.aulas.last().map(|a| a.conteudo.to_lowercase()).unwrap_or_default();
    if ultima.contains("prova") && !ultima.contains("corre") {
        avisos.push("o ciclo termina na avaliação, sem aula de correção ou recuperação".into());
    }
    if !p.aulas.iter().any(|a| a.conteudo.to_lowercase().contains("prova")) {
        avisos.push("nenhuma aula de prova no ciclo".into());
    }
    Ok(Montado { nome, texto: t, avisos })
}
