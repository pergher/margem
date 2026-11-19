//! Chave de API no cofre do sistema (Credential Manager no Windows). Nenhum comando devolve a chave: ela só é lida
//! pelo Rust, na hora de falar com o provedor. Nunca vai para arquivo de configuração, vault, localStorage nem log.

#[cfg(not(target_os = "android"))]
use keyring::Entry;

#[cfg(not(target_os = "android"))]
const SERVICO: &str = "br.margem.app";

#[cfg(not(target_os = "android"))]
fn entrada(provedor: &str) -> Result<Entry, String> {
    if provedor.is_empty() || !provedor.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') { return Err("provedor inválido".into()); }
    Entry::new(SERVICO, &format!("ia-{provedor}")).map_err(|e| e.to_string())
}

#[cfg(not(target_os = "android"))]
pub(crate) fn guardar(provedor: &str, chave: &str) -> Result<(), String> {
    let chave = chave.trim();
    if chave.is_empty() { return Err("chave vazia".into()); }
    entrada(provedor)?.set_password(chave).map_err(|e| format!("não consegui guardar a chave no cofre do sistema: {e}"))
}

#[cfg(not(target_os = "android"))]
pub(crate) fn ler(provedor: &str) -> Result<Option<String>, String> {
    match entrada(provedor)?.get_password() {
        Ok(c) => Ok(Some(c)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("não consegui ler a chave do cofre do sistema: {e}")),
    }
}

#[cfg(not(target_os = "android"))]
pub(crate) fn apagar(provedor: &str) -> Result<(), String> {
    match entrada(provedor)?.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(e.to_string()) }
}

// Android: sem cofre do sistema por enquanto (a IA fica escondida no celular).
#[cfg(target_os = "android")]
pub(crate) fn guardar(_: &str, _: &str) -> Result<(), String> { Err("a chave de API ainda não é guardada no Android".into()) }
#[cfg(target_os = "android")]
pub(crate) fn ler(_: &str) -> Result<Option<String>, String> { Ok(None) }
#[cfg(target_os = "android")]
pub(crate) fn apagar(_: &str) -> Result<(), String> { Ok(()) }

#[tauri::command]
pub fn ia_guardar_chave(provedor: String, chave: String) -> Result<(), String> { guardar(&provedor, &chave) }

#[tauri::command]
pub fn ia_tem_chave(provedor: String) -> Result<bool, String> { ler(&provedor).map(|c| c.is_some()) }

#[tauri::command]
pub fn ia_apagar_chave(provedor: String) -> Result<(), String> { apagar(&provedor) }

#[cfg(all(test, not(target_os = "android")))]
mod tests {
    use super::*;

    #[test]
    fn recusa_chave_vazia_e_nome_de_provedor_estranho() {
        assert!(guardar("anthropic", "   ").is_err());
        assert!(entrada("../x").is_err() && entrada("").is_err());
    }
}
