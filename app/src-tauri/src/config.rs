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

/// Android: o app só lê a pasta compartilhada (Syncthing) com "acesso a todos os arquivos"; sem isso a listagem
/// mostra as pastas mas esconde os arquivos, e o app pareceria ter um vault vazio.
#[cfg(target_os = "android")]
fn acesso_a_todos_os_arquivos() -> bool {
    let ctx = ndk_context::android_context();
    let Ok(vm) = (unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }) else { return true };
    let Ok(mut env) = vm.attach_current_thread() else { return true };
    env.call_static_method("android/os/Environment", "isExternalStorageManager", "()Z", &[]).and_then(|v| v.z()).unwrap_or(true)
}

#[tauri::command]
pub fn vault_sem_acesso(app: State<App>) -> bool {
    #[cfg(target_os = "android")]
    {
        let s = slash(&app.root());
        return (s.starts_with("/storage/") || s.starts_with("/sdcard")) && !acesso_a_todos_os_arquivos();
    }
    #[cfg(not(target_os = "android"))]
    { let _ = app; false }
}

/// Android: abre a tela do sistema onde o usuário libera "acesso a todos os arquivos" para o app.
#[tauri::command]
pub fn abrir_permissao_arquivos(h: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use jni::objects::{JObject, JValue};
        let pacote = h.config().identifier.clone();
        let ctx = ndk_context::android_context();
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
        let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
        let atividade = unsafe { JObject::from_raw(ctx.context().cast()) };
        let r = (|| -> jni::errors::Result<()> {
            let acao = env.new_string("android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION")?;
            let pkg = env.new_string(format!("package:{pacote}"))?;
            let uri = env.call_static_method("android/net/Uri", "parse", "(Ljava/lang/String;)Landroid/net/Uri;", &[JValue::Object(&pkg)])?.l()?;
            let intent = env.new_object("android/content/Intent", "(Ljava/lang/String;Landroid/net/Uri;)V", &[JValue::Object(&acao), JValue::Object(&uri)])?;
            env.call_method(&intent, "addFlags", "(I)Landroid/content/Intent;", &[JValue::Int(0x1000_0000)])?; // FLAG_ACTIVITY_NEW_TASK
            env.call_method(&atividade, "startActivity", "(Landroid/content/Intent;)V", &[JValue::Object(&intent)])?;
            Ok(())
        })();
        if r.is_err() { let _ = env.exception_clear(); }
        return r.map_err(|e| e.to_string());
    }
    #[cfg(not(target_os = "android"))]
    { let _ = h; Err("só no Android".into()) }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PastaListada { caminho: String, pai: Option<String>, pastas: Vec<String>, tem_vault: bool }

/// Android: lista as subpastas de `caminho` (sem as que começam com `.`) para o seletor de pastas do app.
/// `None` começa em `/storage/emulated/0`. `tem_vault` = a pasta já parece um vault (tem `_sistema` ou `Acervo`).
#[tauri::command]
pub fn listar_pastas(caminho: Option<String>) -> Result<PastaListada, String> {
    if !cfg!(target_os = "android") { return Err("só no Android".into()); }
    let base = PathBuf::from(caminho.unwrap_or_else(|| "/storage/emulated/0".into()));
    let p = canon(&base).map_err(|e| format!("{}: {e}", slash(&base)))?;
    let mut pastas: Vec<String> = std::fs::read_dir(&p).map_err(|e| e.to_string())?.flatten()
        .filter(|e| e.path().is_dir()).map(|e| e.file_name().to_string_lossy().into_owned()).filter(|n| !n.starts_with('.')).collect();
    pastas.sort_by_key(|n| n.to_lowercase());
    let pai = p.parent().filter(|q| q.starts_with("/storage")).map(slash);
    Ok(PastaListada { caminho: slash(&p), pai, pastas, tem_vault: p.join("_sistema").is_dir() || p.join("Acervo").is_dir() })
}

/// Pasta escolhida vazia (ignorando o que começa com `.`): monta a estrutura padrão. Só cria o que falta; nunca mexe no que existe.
pub(crate) fn criar_estrutura(root: &Path) -> std::io::Result<()> {
    let vazia = std::fs::read_dir(root)?.flatten().all(|e| e.file_name().to_string_lossy().starts_with('.'));
    if !vazia { return Ok(()); }
    let ano = 1970 + std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) / 31_556_952;
    let mut dirs: Vec<String> = ["_sistema", "Acervo/Aulas", "Acervo/Ciclos", "Acervo/Gramática", "Acervo/Textos", "Acervo/Questoes", "Acervo/Oficinas", "Acervo/Provas"].map(String::from).to_vec();
    dirs.extend(["Semanas", "Correcoes", "Diarios", "Alunos", "Relatorios"].map(|d| format!("Anos/{ano}/{d}")));
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
    // Android sem "acesso a todos os arquivos": os arquivos ficam invisíveis, a pasta pareceria vazia e o app montaria a estrutura por cima do vault.
    #[cfg(target_os = "android")]
    { let s = slash(&p); if (s.starts_with("/storage/") || s.starts_with("/sdcard")) && !acesso_a_todos_os_arquivos() { return Err("Libere o acesso a todos os arquivos para o Margem (botão \"Abrir a tela de permissão\") e escolha a pasta de novo.".into()); } }
    criar_estrutura(&p).map_err(|e| format!("não montou a estrutura: {e}"))?;
    let f = root_file(&h)?;
    if let Some(d) = f.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    std::fs::write(&f, serde_json::json!({ "raiz": p.to_string_lossy() }).to_string()).map_err(|e| e.to_string())?;
    *lock(&app.root_cell) = p.clone();
    app.invalidar();
    liberar_imagens(&h, &p);
    crate::observador::iniciar_observador(&h, &p);
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
