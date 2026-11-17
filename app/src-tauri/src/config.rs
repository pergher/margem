//! Configuração do app: atalhos, pasta do vault escolhida e estrutura inicial.

use std::path::{Path, PathBuf};
use tauri::{Manager, State};
use crate::caminhos::{canon, slash};
use crate::gravacao::gravar_atomico;
use crate::{lock, App};

pub(crate) fn config_path(h: &tauri::AppHandle) -> Result<PathBuf, String> {
    h.path().app_config_dir().map(|d| d.join("atalhos.json")).map_err(|e| e.to_string())
}

/// Atalhos personalizados, guardados em arquivo na pasta de configuração do app.
#[tauri::command]
pub fn read_config(h: tauri::AppHandle) -> Result<Option<String>, String> {
    let p = config_path(&h)?;
    if p.exists() { std::fs::read_to_string(p).map(Some).map_err(|e| e.to_string()) } else { Ok(None) }
}

#[tauri::command]
pub fn write_config(h: tauri::AppHandle, text: String) -> Result<(), String> {
    let p = config_path(&h)?;
    if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    gravar_atomico(&p, &text)
}

/// Arquivo onde o app guarda a pasta do vault escolhida pelo usuário.
pub(crate) fn root_file(h: &tauri::AppHandle) -> Result<PathBuf, String> {
    h.path().app_config_dir().map(|d| d.join("vault.json")).map_err(|e| e.to_string())
}

/// Pasta guardada, mesmo que não exista mais (movida, apagada, disco/Drive desconectado): o app avisa em vez de esquecê-la.
pub(crate) fn saved_root(h: &tauri::AppHandle) -> Option<PathBuf> {
    let j: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(root_file(h).ok()?).ok()?).ok()?;
    Some(PathBuf::from(j.get("raiz")?.as_str()?))
}

/// Caminho do vault quando a pasta sumiu (`None` = tudo certo). Nunca recria a pasta: um Drive desconectado não pode virar uma pasta vazia.
#[tauri::command]
pub fn vault_ausente(app: State<App>) -> Option<String> {
    let r = app.root();
    if r.as_os_str().is_empty() || r.is_dir() { None } else { Some(slash(&r)) }
}

/// Pasta escolhida vazia (ignorando o que começa com `.`): monta a estrutura padrão. Só cria o que falta; nunca mexe no que existe.
pub(crate) fn criar_estrutura(root: &Path) -> std::io::Result<()> {
    let vazia = std::fs::read_dir(root)?.flatten().all(|e| e.file_name().to_string_lossy().starts_with('.'));
    if !vazia { return Ok(()); }
    let ano = 1970 + std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) / 31_556_952;
    let mut dirs: Vec<String> = ["_sistema", "Acervo/Aulas", "Acervo/Ciclos", "Acervo/Gramática", "Acervo/Textos", "Acervo/Questoes", "Acervo/Oficinas"].map(String::from).to_vec();
    dirs.extend(["Semanas", "Provas", "Correcoes", "Diarios", "Alunos", "Relatorios"].map(|d| format!("Anos/{ano}/{d}")));
    for d in dirs { std::fs::create_dir_all(root.join(d))?; }
    Ok(())
}

/// Pasta do vault em uso (`None` = ainda não escolhida).
#[tauri::command]
pub fn get_vault_root(app: State<App>) -> Option<String> {
    let r = app.root();
    if r.as_os_str().is_empty() { None } else { Some(slash(&r)) }
}

/// O protocolo `asset:` só serve arquivos da pasta do vault (escopo dinâmico; o `tauri.conf.json` começa com escopo vazio).
pub(crate) fn liberar_imagens(h: &tauri::AppHandle, root: &Path) {
    if !root.as_os_str().is_empty() { let _ = h.asset_protocol_scope().allow_directory(root, true); }
}

/// Guarda a pasta escolhida e passa a usá-la.
#[tauri::command]
pub fn set_vault_root(h: tauri::AppHandle, app: State<App>, path: String) -> Result<String, String> {
    let p = canon(Path::new(&path)).map_err(|e| format!("{path}: {e}"))?;
    if !p.is_dir() { return Err("não é uma pasta".into()); }
    criar_estrutura(&p).map_err(|e| format!("não montou a estrutura: {e}"))?;
    let f = root_file(&h)?;
    if let Some(d) = f.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    std::fs::write(&f, serde_json::json!({ "raiz": p.to_string_lossy() }).to_string()).map_err(|e| e.to_string())?;
    *lock(&app.root_cell) = p.clone();
    app.invalidar();
    liberar_imagens(&h, &p);
    Ok(slash(&p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estrutura_so_em_pasta_vazia() {
        let d = std::env::temp_dir().join(format!("margem-estrutura-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join(".historico")).unwrap();
        criar_estrutura(&d).unwrap();
        assert!(d.join("Acervo/Aulas").is_dir() && d.join("_sistema").is_dir());
        // pasta com conteúdo: não cria nada novo
        std::fs::remove_dir_all(d.join("Acervo/Oficinas")).unwrap();
        criar_estrutura(&d).unwrap();
        assert!(!d.join("Acervo/Oficinas").exists());
        std::fs::remove_dir_all(&d).unwrap();
    }
}
