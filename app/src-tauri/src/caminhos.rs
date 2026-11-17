//! Caminhos: tudo o que o app aceita de fora passa por aqui e precisa ficar dentro do vault.

use std::path::{Path, PathBuf};
use crate::App;

/// Caminho para o JS: sempre com `/` (o Windows aceita) e sem o prefixo `\\?\`.
pub(crate) fn slash(p: &Path) -> String { simp(p).to_string_lossy().replace('\\', "/") }

/// `canonicalize` sem o prefixo `\\?\` do Windows (deixa os caminhos iguais aos da lista de notas).
pub(crate) fn canon(p: &Path) -> std::io::Result<PathBuf> { dunce::canonicalize(p) }
pub(crate) fn simp(p: &Path) -> PathBuf { dunce::simplified(p).to_path_buf() }

pub(crate) fn inside(app: &App, p: &str) -> Result<PathBuf, String> {
    inside_root(&app.root(), p)
}

pub(crate) fn inside_root(root: &Path, p: &str) -> Result<PathBuf, String> {
    inside_ext(root, p, &["md"])
}

pub(crate) fn inside_ext(root: &Path, p: &str, exts: &[&str]) -> Result<PathBuf, String> {
    let p = canon(Path::new(p)).map_err(|e| format!("{p}: {e}"))?;
    let root = canon(root).map_err(|e| e.to_string())?;
    if p.starts_with(&root) && p.extension().is_some_and(|x| exts.iter().any(|e| x == *e)) { Ok(p) } else { Err("fora do vault".into()) }
}

pub(crate) fn root_of(app: &App) -> Result<PathBuf, String> { canon(&app.root()).map_err(|e| e.to_string()) }

/// Caminho existente (arquivo ou pasta) dentro do vault, nunca a própria raiz nem pasta oculta.
pub(crate) fn inside_any(app: &App, p: &str) -> Result<PathBuf, String> { inside_any_em(&root_of(app)?, p) }

pub(crate) fn inside_any_em(root: &Path, p: &str) -> Result<PathBuf, String> {
    let p = canon(Path::new(p)).map_err(|e| format!("{p}: {e}"))?;
    let oculto = p.strip_prefix(root).map_or(true, |r| r.components().any(|c| c.as_os_str().to_string_lossy().starts_with('.')));
    if p == root || !p.starts_with(root) || oculto { Err("fora do vault".into()) } else { Ok(p) }
}

/// Pasta de destino para criar algo: a raiz (vazia ou o próprio caminho dela) ou uma pasta do vault.
/// Se a pasta ainda não existe (vault novo, sem `Anos/2026/Semanas`), cria-a — só dentro do vault e nunca oculta.
pub(crate) fn pasta_destino(app: &App, dir: &str) -> Result<PathBuf, String> { pasta_destino_em(&root_of(app)?, dir) }

pub(crate) fn pasta_destino_em(root: &Path, dir: &str) -> Result<PathBuf, String> {
    let root = root.to_path_buf();
    if dir.is_empty() { return Ok(root); }
    if let Ok(c) = canon(Path::new(dir)) {
        if c == root { return Ok(root); }
        return inside_any_em(&root, dir);
    }
    let mut rest: Vec<std::ffi::OsString> = Vec::new();
    let mut atual = PathBuf::from(dir);
    let base = loop {
        if let Ok(c) = canon(&atual) { break c; }
        let Some(nome) = atual.file_name().map(|n| n.to_os_string()) else { return Err("fora do vault".into()) };
        rest.push(nome);
        if !atual.pop() { return Err("fora do vault".into()); }
    };
    if !base.starts_with(&root) { return Err("fora do vault".into()); }
    let mut alvo = base;
    for n in rest.into_iter().rev() {
        let s = n.to_string_lossy();
        if s == ".." || s == "." || s.starts_with('.') { return Err("fora do vault".into()); }
        alvo.push(n);
    }
    std::fs::create_dir_all(&alvo).map_err(|e| e.to_string())?;
    Ok(alvo)
}

pub(crate) fn valid_name(n: &str) -> Result<&str, String> {
    let n = n.trim();
    if n.is_empty() || n.starts_with('.') || n.contains(['/', '\\', ':']) { Err(format!("nome inválido: {n:?}")) } else { Ok(n) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pasta_destino_cria_pastas_que_faltam_so_dentro_do_vault() {
        let d = std::env::temp_dir().join(format!("margem-destino-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        let root = canon(&d).unwrap();
        let r = root.to_string_lossy().to_string();
        // a própria raiz vale como destino (vault vazio)
        assert_eq!(pasta_destino_em(&root, &r).unwrap(), root);
        assert_eq!(pasta_destino_em(&root, "").unwrap(), root);
        // pasta que não existe ainda é criada
        let novo = pasta_destino_em(&root, &format!("{r}/Anos/2026/Semanas")).unwrap();
        assert!(novo.is_dir() && novo.ends_with("Anos/2026/Semanas"));
        // fora do vault, oculta ou com `..`: recusa e não cria
        assert!(pasta_destino_em(&root, "/tmp/margem-fora-do-vault/x").is_err());
        assert!(pasta_destino_em(&root, &format!("{r}/.oculta/x")).is_err());
        assert!(pasta_destino_em(&root, &format!("{r}/Anos/../../x")).is_err());
        assert!(!root.join(".oculta").exists());
        std::fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn anexo_e_sidecar_so_dentro_do_vault_e_com_extensao_certa() {
        let d = std::env::temp_dir().join(format!("vault-anexo-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("_sistema/anexos")).unwrap();
        std::fs::write(d.join("_sistema/_dados.json"), "{}").unwrap();
        std::fs::write(d.join("_sistema/x.txt"), "x").unwrap();
        let sub = d.join("_sistema").to_string_lossy().to_string();
        assert!(inside_ext(&d, &format!("{sub}/_dados.json"), &["json"]).is_ok());
        assert!(inside_ext(&d, &format!("{sub}/x.txt"), &["json"]).is_err());
        assert!(inside_ext(&d, "/etc/passwd", &["json"]).is_err());
        let _ = std::fs::remove_dir_all(&d);
    }
}
