use std::collections::HashSet;
use std::fmt;

use serde_yaml_ng::Value;

use crate::frontmatter::{as_str_list, is_blank};
use crate::links::line_of;
use crate::tables::{find_tables, Table};
use crate::vault::{Note, Vault};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Info,
    Warning,
    Error,
}

#[derive(Debug)]
pub struct Issue {
    pub note: String,
    pub line: usize,
    pub severity: Severity,
    pub code: &'static str,
    pub msg: String,
}

impl fmt::Display for Issue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let s = match self.severity {
            Severity::Error => "erro",
            Severity::Warning => "aviso",
            Severity::Info => "info",
        };
        write!(f, "{s:5} {}:{} [{}] {}", self.note, self.line, self.code, self.msg)
    }
}

/// Campos mínimos por `tipo` (seção 4.1 do escopo).
pub fn required_fields(tipo: &str) -> Option<&'static [&'static str]> {
    Some(match tipo {
        "aula" => &["ano", "status"],
        "plano" => &["ano", "trimestre"],
        "ciclo" => &["ano", "trimestre", "ciclo"],
        "diario" => &["ano", "turma", "semana", "transcricao"],
        "aluno" => &["ano", "turma"],
        "semana" => &["ano", "rotulo"],
        "calendario" => &["inicio", "fim", "feriados", "turmas"],
        "texto" => &["titulo", "autor", "genero", "fonte", "dominio_publico", "foco", "conteudos", "alertas"],
        "banco" => &["ano", "conteudos", "conteudos_excluidos", "textos"],
        "prova" => &["turma", "data", "questoes", "valor"],
        "correcao" => &["turma", "mes", "atividade", "rubrica", "status", "transcricao"],
        "rubrica" | "taxonomia" | "configuracao" => &[],
        "habilidades-bncc" | "habilidades-cbtc" => &["ano"],
        _ => return None,
    })
}

const CODE_FIELDS: &[&str] = &["conteudo", "conteudos", "conteudos_excluidos", "foco"];

pub const STATUS: &[&str] = &["pendente", "andamento", "finalizado", "arquivado"];
pub const TRANSCRICAO: &[&str] = &["pendente", "aguardando-revisao", "aprovada"];

fn int_of(v: &Value) -> Option<i64> {
    match v {
        Value::Number(n) => n.as_i64(),
        _ => None,
    }
}

fn turma_ok(v: &Value) -> bool {
    v.as_str().is_some_and(|s| s.len() == 2 && s.chars().all(|c| c.is_ascii_digit()))
}

/// Confere valores dos vocabulários fechados (docs/formato-do-vault.md).
fn check_valores(n: &Note, err: &mut dyn FnMut(String)) {
    if n.frontmatter.is_none() {
        return;
    }
    if let Some(s) = n.field("status").filter(|v| !matches!(v, Value::Null)) {
        if !s.as_str().is_some_and(|s| STATUS.contains(&s)) {
            err(format!("status {s:?} fora do vocabulário ({})", STATUS.join(", ")));
        }
    }
    if let Some(s) = n.field("transcricao").filter(|v| !matches!(v, Value::Null)) {
        if !s.as_str().is_some_and(|s| TRANSCRICAO.contains(&s)) {
            err(format!("transcricao {s:?} fora do vocabulário ({})", TRANSCRICAO.join(", ")));
        }
    }
    if let Some(a) = n.field("ano").filter(|v| !matches!(v, Value::Null) && n.tipo() != Some("texto")) {
        let ok = |v: &Value| int_of(v).is_some_and(|x| (6..=9).contains(&x));
        let good = match a {
            Value::Sequence(xs) => !xs.is_empty() && xs.iter().all(ok),
            v => ok(v),
        };
        if !good {
            err(format!("ano {a:?} deve ser número de 6 a 9"));
        }
    }
    if let Some(t) = n.field("trimestre").filter(|v| !matches!(v, Value::Null)) {
        if !int_of(t).is_some_and(|x| (1..=3).contains(&x)) {
            err(format!("trimestre {t:?} deve ser 1, 2 ou 3"));
        }
    }
    if let Some(t) = n.field("turma").filter(|v| !matches!(v, Value::Null)) {
        if !turma_ok(t) {
            err(format!("turma {t:?} deve ser texto de dois dígitos, como \"61\""));
        }
    }
    if let Some(t) = n.field("turmas") {
        if !matches!(t, Value::Sequence(xs) if xs.iter().all(turma_ok)) {
            err("turmas deve ser lista de textos de dois dígitos, como [\"61\", \"62\"]".to_string());
        }
    }
}

pub fn taxonomy(v: &Vault) -> HashSet<String> {
    let mut out = HashSet::new();
    // lista em tópicos: - `codigo` — descrição  (formato de Recursos/_codigos.md)
    for n in v.notes.iter().filter(|n| n.tipo() == Some("taxonomia") || n.name == "_codigos") {
        for l in n.text.lines() {
            if let Some(rest) = l.trim_start().strip_prefix("- `") {
                if let Some(end) = rest.find('`') {
                    out.insert(rest[..end].to_string());
                }
            }
        }
    }
    for n in v.by_tipo("taxonomia") {
        for t in find_tables(&n.text) {
            if t.header.first().map(|c| c.text.as_str()) != Some("código") {
                continue;
            }
            for r in &t.rows {
                if let Some(c) = r.first() {
                    out.insert(c.text.clone());
                }
            }
        }
    }
    out
}

pub fn validate(v: &Vault) -> Vec<Issue> {
    let mut out = vec![];
    let tax = taxonomy(v);
    for n in v.notes.iter().filter(|n| n.name != "CLAUDE") {
        let mut push = |line: usize, severity, code, msg: String| {
            out.push(Issue { note: n.name.clone(), line, severity, code, msg })
        };
        if let Some(e) = &n.frontmatter_error {
            push(1, Severity::Error, "yaml", format!("frontmatter inválido: {e}"));
            continue;
        }
        match n.tipo() {
            None => push(1, Severity::Warning, "sem-tipo", "nota sem `tipo` no frontmatter".into()),
            Some(t) => match required_fields(t) {
                None => push(1, Severity::Warning, "tipo-desconhecido", format!("tipo `{t}` não existe")),
                Some(req) => {
                    for f in req {
                        let vazia_ok = matches!(*f, "alertas" | "conteudos_excluidos" | "foco");
                        let vazia = !vazia_ok && matches!(n.field(f), Some(Value::Sequence(s)) if s.is_empty());
                        if is_blank(n.field(f)) || vazia {
                            push(1, Severity::Warning, "campo-vazio", format!("campo `{f}` vazio ou ausente"));
                        }
                    }
                }
            },
        }
        if n.tipo() == Some("aula") && n.field("turmas").is_some() {
            push(1, Severity::Warning, "campo-obsoleto", "`turmas` não pertence mais à aula; a turma vive no ciclo ou plano do ano".into());
        }
        check_valores(n, &mut |msg| push(1, Severity::Error, "valor-invalido", msg));
        for f in CODE_FIELDS {
            for code in as_str_list(n.field(f)) {
                if !tax.is_empty() && !tax.contains(&code) {
                    push(1, Severity::Error, "conteudo-desconhecido", format!("código `{code}` em `{f}` não está na taxonomia"));
                }
            }
        }
        for l in &n.links {
            if l.target.is_empty() {
                continue; // [[#ancora]] aponta para a própria nota
            }
            let line = line_of(&n.text, l.offset);
            match v.resolve(&l.target) {
                None if v.has_attachment(&l.target) => {}
                None => push(line, Severity::Warning, "link-quebrado", format!("[[{}]] não existe", l.target)),
                Some(dest) => {
                    if let Some(a) = &l.anchor {
                        let ok = match a.strip_prefix('^') {
                            Some(id) => dest.blocks.iter().any(|b| b == id),
                            None => dest.headings.iter().any(|h| h == a),
                        };
                        if !ok {
                            push(line, Severity::Warning, "ancora-quebrada", format!("[[{}#{}]]: âncora não encontrada", l.target, a));
                        }
                    }
                }
            }
        }
    }
    for n in &v.notes {
        match n.tipo() {
            Some("ciclo") => check_ciclo(v, n, &mut out),
            Some("correcao") => check_correcao(v, n, &mut out),
            _ => {}
        }
    }
    out.sort_by(|a, b| a.note.cmp(&b.note).then(a.line.cmp(&b.line)));
    out
}

pub fn parse_num(s: &str) -> Option<f64> {
    s.replace('*', "").replace(',', ".").trim().parse().ok()
}

fn col(t: &Table, name: &str) -> Option<usize> {
    t.header.iter().position(|c| c.text == name)
}

/// Ciclo = sequência ordenada de aulas (sem datas: ver docs/formato-do-vault.md). Só aponta aula sem recurso
/// e ciclo que termina na avaliação. Aceita a tabela do app (`# | Conteúdo | Recurso`) em qualquer caixa.
fn check_ciclo(_v: &Vault, n: &Note, out: &mut Vec<Issue>) {
    let norm = |t: &Table, nomes: &[&str]| t.header.iter().position(|c| nomes.iter().any(|n| c.text.trim().to_lowercase() == *n));
    for t in find_tables(&n.text) {
        let (Some(cc), Some(cr)) = (norm(&t, &["conteudo", "conteúdo"]), norm(&t, &["recurso"])) else { continue };
        for r in &t.rows {
            let texto = r.get(cc).map(|c| c.text.to_lowercase()).unwrap_or_default();
            // exercícios, revisão, prova, correção etc. não precisam de recurso
            const SEM_RECURSO: &[&str] = &["exerc", "revis", "prova", "corre", "recupera", "finaliza", "diagn", "🔻", "🔹", "🔥", "🎮"];
            if !SEM_RECURSO.iter().any(|w| texto.contains(w)) && r.get(cr).is_none_or(|c| c.text.is_empty()) {
                out.push(Issue { note: n.name.clone(), line: line_of(&n.text, r[0].raw.0), severity: Severity::Info, code: "aula-sem-recurso", msg: "aula sem recurso".into() });
            }
        }
        let last = t.rows.last().and_then(|r| r.get(cc)).map(|c| c.text.to_lowercase()).unwrap_or_default();
        if last.contains("prova") && !last.contains("correção") && !last.contains("correcao") {
            out.push(Issue { note: n.name.clone(), line: line_of(&n.text, t.rows.last().unwrap()[0].raw.0), severity: Severity::Info, code: "sem-recuperacao", msg: "o ciclo termina na avaliação, sem aula de correção ou recuperação".into() });
        }
    }
}

/// Lê a rubrica referenciada: critério -> (máximo, passo).
pub fn rubrica(v: &Vault, n: &Note) -> Vec<(String, f64, f64)> {
    let link = n.links.iter().find(|l| l.offset < n.body_start);
    let Some(r) = link.and_then(|l| v.resolve(&l.target)) else { return vec![] };
    let mut out = vec![];
    for t in find_tables(&r.text) {
        let (Some(c), Some(m), Some(p)) = (col(&t, "critério"), col(&t, "máximo"), col(&t, "passo")) else { continue };
        for row in &t.rows {
            if let (Some(max), Some(step)) = (parse_num(&row[m].text), parse_num(&row[p].text)) {
                out.push((row[c].text.clone(), max, step));
            }
        }
    }
    out
}

fn check_correcao(v: &Vault, n: &Note, out: &mut Vec<Issue>) {
    let rub = rubrica(v, n);
    let aprovada = n.field("transcricao").and_then(|s| s.as_str()) == Some("aprovada");
    // marcas de transcrição pendentes: [palavra?] e [ilegível]
    let b = n.text.as_bytes();
    for (i, _) in n.text.match_indices('[') {
        if i < n.body_start || b.get(i + 1) == Some(&b'[') || (i > 0 && b[i - 1] == b'[') {
            continue;
        }
        if let Some(rel) = n.text[i + 1..].find(']') {
            let inner = &n.text[i + 1..i + 1 + rel];
            if !inner.contains('\n') && (inner.ends_with('?') || inner == "ilegível") && aprovada {
                out.push(Issue { note: n.name.clone(), line: line_of(&n.text, i), severity: Severity::Error, code: "marca-pendente", msg: format!("[{inner}] sem decisão, mas transcricao é aprovada") });
            }
        }
    }
    for t in find_tables(&n.text) {
        let (Some(cc), Some(cn)) = (col(&t, "critério"), col(&t, "nota")) else { continue };
        if rub.is_empty() && t.header.len() >= 2 && n.field("rubrica").is_some() {
            continue;
        }
        let mut soma = 0.0;
        for r in &t.rows {
            let line = line_of(&n.text, r[0].raw.0);
            let crit = r[cc].text.replace('*', "");
            let Some(val) = parse_num(&r[cn].text) else { continue };
            if crit.eq_ignore_ascii_case("total") {
                if (val - soma).abs() > 1e-9 {
                    out.push(Issue { note: n.name.clone(), line, severity: Severity::Error, code: "total-diverge", msg: format!("total {val} mas a soma dos critérios é {soma}") });
                }
                continue;
            }
            soma += val;
            if let Some((_, max, step)) = rub.iter().find(|(c, _, _)| *c == crit) {
                let q = val / step;
                if val > *max + 1e-9 || (q - q.round()).abs() > 1e-9 {
                    out.push(Issue { note: n.name.clone(), line, severity: Severity::Error, code: "nota-fora-da-rubrica", msg: format!("{crit}: {val} (máximo {max}, passo {step})") });
                }
            }
        }
    }
}
