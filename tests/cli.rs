//! O CLI `vault` guarda a versão antiga no histórico (`.historico/`) antes de gravar, como diz o módulo `historico`.

use std::path::{Path, PathBuf};
use std::process::Command;

fn vault(args: &[&str]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_vault")).args(args).output().unwrap()
}

fn tmp(nome: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("cli-{nome}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn copiar(a: &Path, b: &Path) {
    std::fs::create_dir_all(b).unwrap();
    for e in std::fs::read_dir(a).unwrap() {
        let p = e.unwrap().path();
        let t = b.join(p.file_name().unwrap());
        if p.is_dir() { copiar(&p, &t) } else { std::fs::copy(&p, &t).unwrap(); }
    }
}

/// Todos os arquivos de versão guardados em `.historico/`, com o texto de cada um.
fn versoes(raiz: &Path) -> Vec<String> {
    fn andar(d: &Path, out: &mut Vec<String>) {
        let Ok(rd) = std::fs::read_dir(d) else { return };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() { andar(&p, out) } else if let Ok(t) = std::fs::read_to_string(&p) { out.push(t) }
        }
    }
    let mut out = vec![];
    andar(&raiz.join(".historico"), &mut out);
    out
}

#[test]
fn migrar_aplicar_guarda_a_versao_antiga() {
    let d = tmp("migrar");
    copiar(&Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/modelo"), &d);
    let antes: Vec<(PathBuf, String)> = walk(&d).into_iter().map(|p| { let t = std::fs::read_to_string(&p).unwrap(); (p, t) }).collect();
    let o = vault(&["migrar", d.to_str().unwrap(), "--aplicar"]);
    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stdout));
    let guardadas = versoes(&d);
    let mudadas: Vec<&String> = antes.iter().filter(|(p, t)| std::fs::read_to_string(p).unwrap() != *t).map(|(_, t)| t).collect();
    assert!(!mudadas.is_empty(), "o modelo antigo deveria ter notas a migrar");
    for original in mudadas { assert!(guardadas.contains(original), "faltou guardar a versão antiga de uma nota migrada"); }
    let _ = std::fs::remove_dir_all(&d);
}

fn walk(d: &Path) -> Vec<PathBuf> {
    let mut out = vec![];
    for e in std::fs::read_dir(d).unwrap().flatten() {
        let p = e.path();
        if e.file_name().to_string_lossy().starts_with('.') { continue; }
        if p.is_dir() { out.extend(walk(&p)) } else if p.extension().is_some_and(|x| x == "md") { out.push(p) }
    }
    out
}

#[test]
fn margem_aplicar_guarda_a_versao_antiga() {
    let d = tmp("margem");
    std::fs::create_dir_all(d.join("Acervo/Aulas")).unwrap();
    let original = "---\ntipo: aula\nano: 6\nstatus: andamento\n---\n\n> [!tip] Dica para o professor\n> Peça que leiam em voz alta.\n";
    std::fs::write(d.join("Acervo/Aulas/A.md"), original).unwrap();
    let o = vault(&["margem", d.to_str().unwrap(), "--aplicar"]);
    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
    assert_ne!(std::fs::read_to_string(d.join("Acervo/Aulas/A.md")).unwrap(), original);
    assert!(versoes(&d).iter().any(|t| t == original));
    let _ = std::fs::remove_dir_all(&d);
}

#[test]
fn edit_cell_guarda_a_versao_antiga() {
    let d = tmp("edit-cell");
    std::fs::create_dir_all(d.join("Acervo")).unwrap();
    let nota = d.join("Acervo/T.md");
    let original = "# T\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
    std::fs::write(&nota, original).unwrap();
    let o = vault(&["edit-cell", nota.to_str().unwrap(), "0", "0", "1", "novo"]);
    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
    assert!(std::fs::read_to_string(&nota).unwrap().contains("novo"));
    assert!(versoes(&d).iter().any(|t| t == original));
    let _ = std::fs::remove_dir_all(&d);
}

#[test]
fn edit_cell_em_arquivo_inexistente_falha_com_mensagem_e_sem_pânico() {
    let o = vault(&["edit-cell", "/tmp/margem-nao-existe.md", "0", "0", "0", "x"]);
    assert_eq!(o.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&o.stderr).contains("não leu"), "{}", String::from_utf8_lossy(&o.stderr));
}
