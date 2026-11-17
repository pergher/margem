//! Chave de API no cofre do sistema (Credential Manager no Windows). Nenhum comando devolve a chave: ela só é lida
//! pelo Rust, na hora de falar com o provedor. Nunca vai para arquivo de configuração, vault, localStorage nem log.

use keyring::Entry;

const SERVICO: &str = "br.margem.app";

fn entrada(provedor: &str) -> Result<Entry, String> {
    if provedor.is_empty() || !provedor.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') { return Err("provedor inválido".into()); }
    Entry::new(SERVICO, &format!("ia-{provedor}")).map_err(|e| e.to_string())
}

pub(crate) fn guardar(provedor: &str, chave: &str) -> Result<(), String> {
    let chave = chave.trim();
    if chave.is_empty() { return Err("chave vazia".into()); }
    entrada(provedor)?.set_password(chave).map_err(|e| format!("não consegui guardar a chave no cofre do sistema: {e}"))
}

pub(crate) fn ler(provedor: &str) -> Result<Option<String>, String> {
    match entrada(provedor)?.get_password() {
        Ok(c) => Ok(Some(c)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("não consegui ler a chave do cofre do sistema: {e}")),
    }
}

pub(crate) fn apagar(provedor: &str) -> Result<(), String> {
    match entrada(provedor)?.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(e.to_string()) }
}

#[tauri::command]
pub fn ia_guardar_chave(provedor: String, chave: String) -> Result<(), String> { guardar(&provedor, &chave) }

#[tauri::command]
pub fn ia_tem_chave(provedor: String) -> Result<bool, String> { ler(&provedor).map(|c| c.is_some()) }

#[tauri::command]
pub fn ia_apagar_chave(provedor: String) -> Result<(), String> { apagar(&provedor) }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recusa_chave_vazia_e_nome_de_provedor_estranho() {
        assert!(guardar("anthropic", "   ").is_err());
        assert!(entrada("../x").is_err() && entrada("").is_err());
    }
}
