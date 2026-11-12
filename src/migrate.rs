//! Converte o frontmatter antigo para o formato de docs/formato-do-vault.md.
//! Só mexe nas linhas do frontmatter; o corpo da nota fica idêntico, byte a byte.

use serde_yaml_ng::Value;

use crate::frontmatter;

pub struct Migration {
    pub text: String,
    /// Mudanças aplicadas, em linguagem de gente.
    pub changes: Vec<String>,
    /// Pontos que precisam de decisão manual.
    pub manual: Vec<String>,
}

struct Entry {
    key: String,
    lines: Vec<String>,
    value: Value,
}

fn is_key_line(l: &str) -> Option<String> {
    let c = l.chars().next()?;
    if c.is_whitespace() || c == '#' || c == '-' {
        return None;
    }
    let (k, _) = l.split_once(':')?;
    if k.contains(char::is_whitespace) {
        return None;
    }
    Some(k.to_string())
}

fn parse_entries(yaml: &str) -> Result<Vec<Entry>, String> {
    let mut entries: Vec<Entry> = vec![];
    for l in yaml.split_inclusive('\n') {
        match is_key_line(l) {
            Some(k) => entries.push(Entry { key: k, lines: vec![l.to_string()], value: Value::Null }),
            None => entries.last_mut().ok_or("frontmatter começa fora de uma chave")?.lines.push(l.to_string()),
        }
    }
    for e in &mut entries {
        let m = frontmatter::parse(&e.lines.concat())?;
        e.value = m.get(&e.key).cloned().unwrap_or(Value::Null);
    }
    Ok(entries)
}

fn fold(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ã' | 'â' => 'a',
            'é' | 'ê' => 'e',
            'í' => 'i',
            'ó' | 'ô' | 'õ' => 'o',
            'ú' => 'u',
            'ç' => 'c',
            c => c,
        })
        .collect()
}

fn canon_tipo(t: &str) -> String {
    match t.trim() {
        "class" => "aula".into(),
        "plan" => "plano".into(),
        "correção" => "correcao".into(),
        "bncc" => "habilidades-bncc".into(),
        t => t.to_string(),
    }
}

fn items(v: &Value) -> Vec<&Value> {
    match v {
        Value::Sequence(s) => s.iter().collect(),
        Value::Null => vec![],
        v => vec![v],
    }
}

fn int_of(v: &Value) -> Option<i64> {
    match v {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

fn str_of(v: &Value) -> Option<String> {
    match v {
        Value::Number(n) => Some(n.to_string()),
        Value::String(s) => Some(s.trim().to_string()),
        _ => None,
    }
}

fn rename_first_line(e: &Entry, new_key: &str) -> Vec<String> {
    let mut lines = e.lines.clone();
    lines[0] = format!("{new_key}:{}", &lines[0][e.key.len() + 1..]);
    lines
}

pub fn migrate(text: &str) -> Result<Migration, String> {
    migrate_named("", text)
}

/// Cabeçalho para notas que nasceram sem frontmatter, deduzido do nome do arquivo:
/// `_codigos` vira taxonomia; `banco-questoes-*` vira banco (ano pelo título, textos pelas fichas citadas).
fn novo_frontmatter(name: &str, text: &str) -> Option<String> {
    if name == "_codigos" {
        return Some("---\ntipo: taxonomia\n---\n".into());
    }
    if !name.starts_with("banco-questoes") {
        return None;
    }
    let titulo = text.lines().find(|l| l.starts_with("# ")).unwrap_or("");
    let ano = titulo
        .split("º ano")
        .next()
        .filter(|_| titulo.contains("º ano"))
        .and_then(|t| t.trim_end().chars().last())
        .and_then(|c| c.to_digit(10));
    let mut textos: Vec<String> = vec![];
    for (i, _) in text.match_indices("Recursos/textos/") {
        let rest = &text[i + "Recursos/textos/".len()..];
        if let Some(end) = rest.find(".md") {
            let n = &rest[..end];
            if !n.contains(['/', '`', ' ']) && !textos.iter().any(|t| t == n) {
                textos.push(n.to_string());
            }
        }
    }
    let mut fm = String::from("---\ntipo: banco\n");
    match ano {
        Some(a) => fm.push_str(&format!("ano: {a}\n")),
        None => fm.push_str("ano:\n"),
    }
    fm.push_str("conteudos: []\nconteudos_excluidos: []\n");
    if textos.is_empty() {
        fm.push_str("textos: []\n");
    } else {
        let l: Vec<String> = textos.iter().map(|t| format!("\"[[{t}]]\"")).collect();
        fm.push_str(&format!("textos: [{}]\n", l.join(", ")));
    }
    fm.push_str("---\n");
    Some(fm)
}

/// "631 - …" → (ano 6, trimestre 3, ciclo 1).
fn ciclo_do_nome(name: &str) -> Option<(i64, i64, i64)> {
    let b = name.as_bytes();
    if b.len() < 3 || !b[..3].iter().all(u8::is_ascii_digit) || b.get(3).is_some_and(u8::is_ascii_alphanumeric) {
        return None;
    }
    let d = |i: usize| i64::from(b[i] - b'0');
    Some((d(0), d(1), d(2))).filter(|(a, t, c)| (6..=9).contains(a) && (1..=3).contains(t) && *c >= 1)
}

pub fn migrate_named(name: &str, text: &str) -> Result<Migration, String> {
    let sp = frontmatter::split(text);
    let mut mig = Migration { text: text.to_string(), changes: vec![], manual: vec![] };
    let Some(yaml) = sp.yaml else {
        match novo_frontmatter(name, text) {
            Some(fm) => {
                mig.changes.push(format!("+ frontmatter novo ({})", fm.lines().nth(1).unwrap_or("")));
                mig.text = format!("{fm}{text}");
                frontmatter::parse(frontmatter::split(&mig.text).yaml.as_deref().unwrap_or(""))
                    .map_err(|e| format!("resultado inválido: {e}"))?;
            }
            None => mig.manual.push("sem frontmatter".into()),
        }
        return Ok(mig);
    };
    let entries = parse_entries(&yaml)?;
    let get = |k: &str| entries.iter().find(|e| e.key == k);

    let legacy_tipo = get("tipo").or_else(|| get("type")).and_then(|e| e.value.as_str()).map(canon_tipo);
    let inferred = legacy_tipo.is_none() && get("foco").is_some() && get("conteudos").is_some() && get("alertas").is_some();
    let tipo = if inferred { Some("texto".to_string()) } else { legacy_tipo };
    let Some(tipo) = tipo else {
        mig.manual.push("tipo não identificado".into());
        return Ok(mig);
    };
    // Plano antigo cujo nome é "ATC - Título - PR" (A = ano, T = trimestre, C = ciclo) é, na verdade, um ciclo.
    let ciclo_do_nome = ciclo_do_nome(name);
    let tipo = if tipo == "plano" && ciclo_do_nome.is_some() { "ciclo".to_string() } else { tipo };
    let has_tipo = get("tipo").is_some();
    if crate::validate::required_fields(&tipo).is_none() {
        mig.manual.push(format!("tipo `{tipo}` não existe no formato novo"));
    }

    let mut out: Vec<String> = vec![];
    if inferred {
        out.push("tipo: texto\n".into());
        mig.changes.push("+ tipo: texto (inferido pelo formato da ficha)".into());
    }
    for e in &entries {
        let k = e.key.as_str();
        let renomear = |nova: &str, mig: &mut Migration| {
            mig.changes.push(format!("{k} → {nova}"));
            rename_first_line(e, nova)
        };
        let lines: Vec<String> = match (tipo.as_str(), k) {
            (_, "type") if has_tipo => {
                mig.manual.push("tem `type` e `tipo` ao mesmo tempo".into());
                e.lines.clone()
            }
            (_, "type") => {
                mig.changes.push(format!("type: {} → tipo: {tipo}", e.value.as_str().unwrap_or("")));
                vec![format!("tipo: {tipo}\n")]
            }
            (_, "tipo") if e.value.as_str().is_some_and(|v| canon_tipo(v) != v) => {
                mig.changes.push(format!("tipo: {} → {tipo}", e.value.as_str().unwrap_or("")));
                vec![format!("tipo: {tipo}\n")]
            }
            ("aula" | "plano" | "ciclo", "year") => {
                let nums: Vec<i64> = items(&e.value).iter().filter_map(|v| int_of(v)).collect();
                let txt = match nums.as_slice() {
                    [] if items(&e.value).is_empty() => "ano:\n".to_string(),
                    [] => {
                        mig.manual.push(format!("year {:?} não é número", e.value));
                        e.lines.clone().concat()
                    }
                    [n] => format!("ano: {n}\n"),
                    ns => format!("ano: [{}]\n", ns.iter().map(|n| n.to_string()).collect::<Vec<_>>().join(", ")),
                };
                mig.changes.push(format!("year → {}", txt.trim()));
                vec![txt]
            }
            ("aula", "period") => {
                mig.changes.push(format!("period removido (a turma vive no ciclo ou plano do ano; era {:?})", items(&e.value).iter().filter_map(|v| str_of(v)).collect::<Vec<_>>()));
                vec![]
            }
            ("ciclo", "period") => {
                let (_, tri, ciclo) = ciclo_do_nome.unwrap();
                let antigo = items(&e.value).first().and_then(|v| int_of(v));
                if antigo.is_some_and(|n| n != tri) {
                    mig.manual.push(format!("period {antigo:?} difere do trimestre do nome ({tri}); conferir"));
                }
                mig.changes.push(format!("period → trimestre: {tri} + ciclo: {ciclo} (pelo nome do arquivo)"));
                vec![format!("trimestre: {tri}\n"), format!("ciclo: {ciclo}\n")]
            }
            ("plano", "period") => match items(&e.value).first().and_then(|v| int_of(v)) {
                Some(n) => {
                    mig.changes.push(format!("period → trimestre: {n}"));
                    vec![format!("trimestre: {n}\n")]
                }
                None => {
                    mig.manual.push("period vazio no plano; falta o trimestre".into());
                    e.lines.clone()
                }
            },
            ("aula", "subject") => renomear("assuntos", &mut mig),
            ("texto", "ano") => renomear("publicacao", &mut mig),
            ("texto", "title") => renomear("titulo", &mut mig),
            ("texto", "author") => renomear("autor", &mut mig),
            ("correcao", "mês") => renomear("mes", &mut mig),
            ("correcao", "arquivado") => renomear("arquivado_em", &mut mig),
            ("correcao", "turma") if !matches!(e.value, Value::String(_)) => match str_of(&e.value) {
                Some(t) => {
                    mig.changes.push(format!("turma: {t} → turma: \"{t}\""));
                    vec![format!("turma: \"{t}\"\n")]
                }
                None => e.lines.clone(),
            },
            (_, "status") => {
                let raw = str_of(&e.value).unwrap_or_default();
                let f = fold(&raw);
                let (st, extra) = match f.as_str() {
                    "nao iniciado" | "pendente" => (Some("pendente"), None),
                    "iniciado" | "em andamento" | "em-andamento" | "andamento" => (Some("andamento"), None),
                    "finalizado" | "concluido" => (Some("finalizado"), None),
                    "arquivado" => (Some("arquivado"), None),
                    "transcricao aprovada" | "transcricao-aprovada" => (Some("andamento"), Some("aprovada")),
                    "aguardando revisao do professor" => (Some("andamento"), Some("aguardando-revisao")),
                    _ => (None, None),
                };
                match st {
                    Some(st) => {
                        let mut v = vec![format!("status: {st}\n")];
                        if let Some(x) = extra.filter(|_| tipo == "correcao" && get("transcricao").is_none()) {
                            v.push(format!("transcricao: {x}\n"));
                        }
                        if v.concat() != e.lines.concat() {
                            mig.changes.push(format!("status: {raw} → {}", v.concat().trim().replace('\n', " + ")));
                        }
                        v
                    }
                    None => {
                        mig.manual.push(format!("status {raw:?} sem equivalente"));
                        e.lines.clone()
                    }
                }
            }
            _ => e.lines.clone(),
        };
        out.extend(lines);
    }
    let new_yaml = out.concat();
    if new_yaml == yaml {
        return Ok(mig);
    }
    let start = text.split_inclusive('\n').next().unwrap().len();
    let new_text = format!("{}{}{}", &text[..start], new_yaml, &text[start + yaml.len()..]);
    // verificações de segurança: continua válido e o corpo não mudou
    let sp2 = frontmatter::split(&new_text);
    frontmatter::parse(sp2.yaml.as_deref().unwrap_or("")).map_err(|e| format!("resultado inválido: {e}"))?;
    if new_text[sp2.body_start..] != text[sp.body_start..] {
        return Err("o corpo da nota mudaria; migração abortada".into());
    }
    mig.text = new_text;
    Ok(mig)
}
