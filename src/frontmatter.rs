//! Separa o frontmatter YAML do corpo, sem alterar nenhum byte do texto.

use serde_yaml_ng::Value;

pub struct Split {
    /// Texto YAML entre os `---` (sem os delimitadores).
    pub yaml: Option<String>,
    /// Offset do primeiro byte depois do `---` de fechamento.
    pub body_start: usize,
}

pub fn split(text: &str) -> Split {
    let none = Split { yaml: None, body_start: 0 };
    let mut lines = text.split_inclusive('\n');
    match lines.next() {
        Some(l) if l.trim_start_matches('\u{feff}').trim_end() == "---" => {} // BOM do Bloco de Notas é aceito
        _ => return none,
    }
    let mut offset = text.split_inclusive('\n').next().unwrap().len();
    let yaml_start = offset;
    for l in lines {
        if l.trim_end() == "---" {
            return Split {
                yaml: Some(text[yaml_start..offset].to_string()),
                body_start: offset + l.len(),
            };
        }
        offset += l.len();
    }
    none
}

pub fn parse(yaml: &str) -> Result<Value, String> {
    serde_yaml_ng::from_str::<Value>(yaml).map_err(|e| e.to_string())
}

/// Valor "vazio" para fins de pendência: ausente, nulo ou string em branco.
pub fn is_blank(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => true,
        Some(Value::String(s)) => s.trim().is_empty(),
        _ => false,
    }
}

pub fn as_str_list(v: Option<&Value>) -> Vec<String> {
    match v {
        Some(Value::Sequence(s)) => s
            .iter()
            .filter_map(|x| x.as_str().map(|s| s.to_string()))
            .collect(),
        Some(Value::String(s)) => vec![s.clone()],
        _ => vec![],
    }
}
