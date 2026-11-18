use std::path::Path;

use serde_json::{json, Value};
use vault_core::mcp::Server;

fn server(expor: bool) -> Server {
    Server { root: Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mini"), expor_correcoes: expor }
}

fn call(s: &Server, tool: &str, args: Value) -> (bool, String) {
    let r = s
        .handle(&json!({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool, "arguments": args}}))
        .unwrap();
    let res = &r["result"];
    (res["isError"].as_bool().unwrap_or(false), res["content"][0]["text"].as_str().unwrap().to_string())
}

#[test]
fn protocolo_basico() {
    let s = server(false);
    let r = s.handle(&json!({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})).unwrap();
    assert_eq!(r["result"]["tools"].as_array().unwrap().len(), 8);
    assert!(s.handle(&json!({"jsonrpc": "2.0", "method": "notifications/initialized"})).is_none());
}

#[test]
fn correcoes_ficam_ocultas_por_padrao() {
    let s = server(false);
    let (e, msg) = call(&s, "search_notes", json!({"query": "*"}));
    assert!(e && msg.contains("busca vazia"), "{msg}");
    let (_, busca) = call(&s, "search_notes", json!({"query": "Aluno"}));
    assert!(!busca.contains("Narrativa-Marco"), "{busca}");
    let (err, txt) = call(&s, "read_note", json!({"nome": "72-Narrativa-Marco"}));
    assert!(err && txt.contains("alunos"));
    let (_, val) = call(&s, "validate", json!({}));
    assert!(!val.contains("72-Narrativa-Marco"));
    let (_, bl) = call(&s, "backlinks", json!({"nome": "rubrica-narrativa"}));
    assert!(!bl.contains("Narrativa-Marco"));
}

#[test]
fn correcoes_aparecem_com_a_flag() {
    let (err, _) = call(&server(true), "read_note", json!({"nome": "72-Narrativa-Marco"}));
    assert!(!err);
}

#[test]
fn busca_por_campo_habilidade_e_backlinks() {
    let s = server(false);
    let (_, b) = call(&s, "search_notes", json!({"tipo": "texto", "campo": "conteudos", "valor": "fig-anafora"}));
    assert!(b.contains("Deus é naja"));
    let (_, h) = call(&s, "get_habilidade", json!({"codigo": "EF06LP04"}));
    assert!(h.contains("flexões"));
    let (_, bl) = call(&s, "backlinks", json!({"nome": "Deus é naja"}));
    assert!(bl.contains("Banco-6ano"));
}

#[test]
fn create_note_nao_sobrescreve_nem_sai_da_pasta() {
    let dir = std::env::temp_dir().join(format!("mcp-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let s = Server { root: dir.clone(), expor_correcoes: false };
    assert!(!call(&s, "create_note", json!({"tipo": "aula", "nome": "Crase"})).0);
    assert!(call(&s, "create_note", json!({"tipo": "aula", "nome": "Crase"})).0);
    assert!(call(&s, "create_note", json!({"tipo": "aula", "nome": "../fora"})).0);
    assert!(call(&s, "create_note", json!({"tipo": "inexistente", "nome": "X"})).0);
    let txt = std::fs::read_to_string(dir.join("Acervo/Aulas/Crase.md")).unwrap();
    assert!(txt.starts_with("---\ntipo: aula\nano: \n"));
    assert!(!call(&s, "create_note", json!({"tipo": "prova", "nome": "Prova 1"})).0);
    assert!(dir.join("Acervo/Provas/Prova 1.md").exists());
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn pasta_de_correcoes_e_relatorios_do_ano_fica_oculta_mesmo_sem_tipo() {
    let dir = std::env::temp_dir().join(format!("mcp-pasta-{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    std::fs::create_dir_all(dir.join("Anos/2026/Relatorios")).unwrap();
    std::fs::create_dir_all(dir.join("Anos/2026/Planejamento")).unwrap();
    std::fs::write(dir.join("Anos/2026/Relatorios/Aluno X.md"), "sem tipo, dados de aluno").unwrap();
    std::fs::write(dir.join("Anos/2026/Planejamento/Plano.md"), "plano aberto").unwrap();
    let s = Server { root: dir.clone(), expor_correcoes: false };
    assert!(call(&s, "read_note", json!({"nome": "Aluno X"})).0);
    assert!(!call(&s, "read_note", json!({"nome": "Plano"})).0);
    let s2 = Server { root: dir.clone(), expor_correcoes: true };
    assert!(!call(&s2, "read_note", json!({"nome": "Aluno X"})).0);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn diarios_e_alunos_ficam_ocultos_por_pasta_e_por_tipo() {
    let dir = std::env::temp_dir().join(format!("mcp-diario-{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    std::fs::create_dir_all(dir.join("Anos/2026/Diarios/61")).unwrap();
    std::fs::create_dir_all(dir.join("Anos/2026/Alunos/61")).unwrap();
    std::fs::create_dir_all(dir.join("Acervo")).unwrap();
    std::fs::write(dir.join("Anos/2026/Diarios/61/Diario 61.md"), "sem tipo").unwrap();
    std::fs::write(dir.join("Anos/2026/Alunos/61/Fulano.md"), "---\ntipo: aluno\n---\nocorrência").unwrap();
    std::fs::write(dir.join("Acervo/Solto.md"), "---\ntipo: diario\n---\nfora da pasta").unwrap();
    std::fs::write(dir.join("Acervo/Aberta.md"), "aberta").unwrap();
    let s = Server { root: dir.clone(), expor_correcoes: false };
    for n in ["Diario 61", "Fulano", "Solto"] {
        assert!(call(&s, "read_note", json!({"nome": n})).0, "{n} deveria estar oculta");
    }
    assert!(!call(&s, "read_note", json!({"nome": "Aberta"})).0);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn plan_ciclo_propoe_sem_gravar_e_cria_sem_sobrescrever() {
    let dir = std::env::temp_dir().join(format!("mcp-ciclo-{}", std::process::id()));
    std::fs::create_dir_all(dir.join("Acervo/Ciclos")).unwrap();
    let s = Server { root: dir.clone(), expor_correcoes: false };
    let args = json!({"titulo": "Crase", "conteudos": ["Crase"], "habilidades": ["EF07LP99"],
        "aulas": [{"conteudo": "**Crase**.", "recurso": "A crase"}, {"conteudo": "🔥 Prova"}]});
    let (err, txt) = call(&s, "plan_ciclo", args.clone());
    assert!(!err, "{txt}");
    assert!(txt.contains("nada foi gravado") && txt.contains("EF07LP99") && txt.contains("não existe no vault") && txt.contains("termina na avaliação"), "{txt}");
    assert!(!dir.join("Acervo/Ciclos/Crase.md").exists());
    let mut g = args.clone();
    g["gravar"] = json!(true);
    let (err, txt) = call(&s, "plan_ciclo", g.clone());
    assert!(!err && txt.contains("criado: Acervo/Ciclos/Crase.md"), "{txt}");
    let feito = std::fs::read_to_string(dir.join("Acervo/Ciclos/Crase.md")).unwrap();
    assert!(feito.starts_with("---\ntipo: ciclo\n---") && feito.contains("| 2 | 🔥 Prova |  |"), "{feito}");
    let (err, _) = call(&s, "plan_ciclo", g);
    assert!(err, "não pode sobrescrever");
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn cadeado_de_pasta_vale_com_o_servidor_iniciado_uma_pasta_acima() {
    let dir = std::env::temp_dir().join(format!("mcp-acima-{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    std::fs::create_dir_all(dir.join("Escola/Anos/2026/Relatorios")).unwrap();
    std::fs::create_dir_all(dir.join("Escola/_sistema/notas")).unwrap();
    std::fs::create_dir_all(dir.join("Escola/Acervo")).unwrap();
    std::fs::write(dir.join("Escola/Anos/2026/Relatorios/Aluno Y.md"), "sem tipo, dados de aluno").unwrap();
    std::fs::write(dir.join("Escola/_sistema/notas/Solta.md"), "veio de Correções").unwrap();
    std::fs::write(dir.join("Escola/Acervo/Aberta.md"), "aberta").unwrap();
    let s = Server { root: dir.clone(), expor_correcoes: false }; // raiz = pasta acima de `Escola`
    assert!(call(&s, "read_note", json!({"nome": "Aluno Y"})).0, "relatório deveria estar oculto");
    assert!(call(&s, "read_note", json!({"nome": "Solta"})).0, "nota solta de _sistema/notas deveria estar oculta");
    assert!(!call(&s, "read_note", json!({"nome": "Aberta"})).0);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn progress_le_semanas_e_ciclos() {
    let d = std::env::temp_dir().join(format!("vault-progress-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(d.join("Acervo/Ciclos")).unwrap();
    std::fs::create_dir_all(d.join("Anos/2026/Semanas")).unwrap();
    std::fs::write(d.join("Acervo/Ciclos/Crase.md"), "---\ntipo: ciclo\n---\n# Crase\n\n## Aulas\n\n| # | Conteúdo | Recurso |\n|---|---|---|\n| 1 | Diagnóstico |  |\n| 2 | Regra |  |\n| 3 | Prova |  |\n").unwrap();
    std::fs::write(d.join("Anos/2026/Semanas/Semana 2026-03-02.md"), "---\ntipo: semana\nano: 6\nrotulo: x\n---\n# S\n\n### 61\n\n| Aula | Recurso | Ciclo |\n|---|---|---|\n| Diagnóstico ✓ |  | [[Crase]] 1 |\n| Regra ↷ |  | [[Crase]] 2 |\n").unwrap();
    let s = Server { root: d.clone(), expor_correcoes: false };
    let (err, t) = call(&s, "progress", json!({}));
    let _ = std::fs::remove_dir_all(&d);
    assert!(!err, "{t}");
    assert!(t.contains("61 · Crase: 1/3 dadas, 1 adiadas"), "{t}");
    assert!(t.contains("próxima sem linha: 3. Prova"), "{t}");
}
