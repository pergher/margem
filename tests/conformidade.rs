//! Conformidade com o app: o mesmo arquivo de casos (`tests/fixtures/conformidade/casos.json`) é lido por este teste
//! e por `app/src/lib/__tests__/conformidade.test.js`. Se o Rust e o JavaScript passarem a entender o vault de
//! jeitos diferentes, um dos dois quebra. Ao mudar uma regra de leitura, atualize o caso e os dois lados.

use serde_json::{json, Value};
use vault_core::semana::{parse_ciclo, parse_semana, Situacao};

fn casos() -> Vec<Value> {
    let p = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/conformidade/casos.json");
    serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap()
}

fn texto_yaml(v: &serde_yaml_ng::Value) -> Value {
    use serde_yaml_ng::Value as Y;
    match v {
        Y::Null => json!(""),
        Y::Bool(b) => json!(b.to_string()),
        Y::Number(n) => json!(n.to_string()),
        Y::String(s) => json!(s),
        Y::Sequence(l) => Value::Array(l.iter().map(texto_yaml).collect()),
        outro => json!(format!("{outro:?}")),
    }
}

fn projetar(tipo: &str, entrada: &str) -> Value {
    match tipo {
        "ciclo" => json!({ "aulas": parse_ciclo(entrada).iter().map(|a| json!({ "n": a.n, "texto": a.texto, "recurso": a.recurso })).collect::<Vec<_>>() }),
        "semana" => {
            let s = parse_semana(entrada);
            json!({ "rotulo": s.rotulo, "turmas": s.turmas.iter().map(|t| json!({
                "turma": t.turma, "ciclo": t.ciclo,
                "aulas": t.aulas.iter().map(|a| json!({
                    "n": a.n, "texto": a.texto, "recurso": a.recurso, "ciclo": a.ciclo, "ciclo_n": a.ciclo_n,
                    "situacao": a.situacao.map(|s| match s { Situacao::Dada => "dada", Situacao::Adiada => "adiada", Situacao::Descartada => "descartada" }),
                })).collect::<Vec<_>>(),
            })).collect::<Vec<_>>() })
        }
        "frontmatter" => {
            let sp = vault_core::frontmatter::split(entrada);
            let mut campos = serde_json::Map::new();
            if let Some(y) = sp.yaml {
                if let Ok(serde_yaml_ng::Value::Mapping(m)) = vault_core::frontmatter::parse(&y) {
                    for (k, v) in m { campos.insert(k.as_str().unwrap_or_default().to_string(), texto_yaml(&v)); }
                }
            }
            json!({ "campos": campos })
        }
        outro => panic!("tipo de caso desconhecido: {outro}"),
    }
}

#[test]
fn rust_entende_os_casos_de_conformidade() {
    let mut falhas = vec![];
    for c in casos() {
        let (nome, tipo, entrada) = (c["nome"].as_str().unwrap(), c["tipo"].as_str().unwrap(), c["entrada"].as_str().unwrap());
        let obtido = projetar(tipo, entrada);
        if obtido != c["esperado"] { falhas.push(format!("{nome}\n  esperado: {}\n  obtido:   {obtido}", c["esperado"])); }
    }
    assert!(falhas.is_empty(), "casos divergentes:\n{}", falhas.join("\n"));
}
