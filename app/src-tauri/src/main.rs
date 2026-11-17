#![cfg_attr(not(test), warn(clippy::unwrap_used))]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod atualizacao;
mod busca;
mod cache;
mod caminhos;
mod config;
mod gravacao;
mod ia;
mod notas;
mod observador;
mod propostas;

use std::path::PathBuf;
use std::sync::atomic::AtomicUsize;
use std::sync::Mutex;
use tauri::Manager;

pub(crate) use cache::com_vault;
use cache::VaultEmCache;
use gravacao::Vistos;

/// Trava o Mutex mesmo que outro comando tenha dado pânico com ele aberto: um erro isolado não derruba todos os comandos seguintes.
pub(crate) fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> { m.lock().unwrap_or_else(|e| e.into_inner()) }

pub(crate) struct App {
    pub(crate) root_cell: Mutex<PathBuf>,
    /// Vault já interpretado (ver `cache.rs`); `None` = precisa ler de novo.
    pub(crate) vault: Mutex<Option<VaultEmCache>>,
    /// Quantas vezes o vault foi lido do disco (para os testes do cache).
    pub(crate) aberturas: AtomicUsize,
    pub(crate) vistos: Vistos,
    /// Cabo do observador de arquivos (ver `observador.rs`); soltá-lo para de observar.
    /// Propostas de alteração aguardando aprovação (ver `propostas.rs`); só em memória.
    pub(crate) propostas: propostas::Propostas,
    /// Conversas e cancelamentos da IA (só em memória; ver `ia/`).
    pub(crate) ia: ia::Estado,
    pub(crate) observador: Mutex<Option<Box<dyn std::any::Any + Send>>>,
}

impl App {
    pub(crate) fn new(root: PathBuf) -> Self {
        App { root_cell: Mutex::new(root), vault: Mutex::new(None), aberturas: AtomicUsize::new(0), vistos: Mutex::new(Default::default()), propostas: Default::default(), ia: Default::default(), observador: Mutex::new(None) }
    }
    pub(crate) fn root(&self) -> PathBuf { lock(&self.root_cell).clone() }
    /// Esquece o vault em cache: chamado depois de toda gravação feita pelo app.
    pub(crate) fn invalidar(&self) { *lock(&self.vault) = None; }
}

fn main() {
    // Ordem: VAULT_ROOT (desenvolvimento) → pasta salva → (só em debug) vault de teste → nenhuma (o app pede).
    let env_root = std::env::var("VAULT_ROOT").map(PathBuf::from).ok();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            notas::list_notes, notas::read_note, notas::save_note, notas::resolve_link, config::read_config, config::write_config,
            notas::create_note, notas::create_folder, notas::rename_entry, notas::move_entry, notas::delete_entry, notas::list_dirs,
            config::vault_ausente, notas::note_info, busca::search_text, busca::read_embed, notas::read_sidecar, notas::save_attachment,
            notas::vault_health, notas::list_history, notas::read_version, notas::restore_version, config::get_vault_root,
            config::set_vault_root, atualizacao::agendar_reabertura, observador::verificar_nota, observador::ler_do_disco,
            propostas::listar_propostas, propostas::descartar_proposta, propostas::aplicar_proposta, propostas::propor_teste,
            ia::ia_config_ler, ia::ia_config_gravar, ia::ia_enviar, ia::ia_cancelar, ia::ia_limpar, ia::ia_testar, ia::ia_previa_contexto,
            ia::segredos::ia_guardar_chave, ia::segredos::ia_tem_chave, ia::segredos::ia_apagar_chave]);
    builder
        .setup(move |app| {
            let root = env_root.clone().or_else(|| config::saved_root(app.handle())).unwrap_or_else(|| {
                if cfg!(debug_assertions) { PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/fixtures/ficticio")) } else { PathBuf::new() }
            });
            config::liberar_imagens(app.handle(), &root);
            app.manage(App::new(root.clone()));
            observador::iniciar_observador(app.handle(), &root);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar");
}

/// Ajudantes só dos testes.
#[cfg(test)]
pub(crate) mod teste_util {
    use std::path::{Path, PathBuf};
    pub(crate) fn copiar_pasta(de: &Path, para: &Path) {
        std::fs::create_dir_all(para).unwrap();
        for e in std::fs::read_dir(de).unwrap() {
            let e = e.unwrap();
            let dest = para.join(e.file_name());
            if e.file_type().unwrap().is_dir() { copiar_pasta(&e.path(), &dest); } else { std::fs::copy(e.path(), dest).unwrap(); }
        }
    }
    pub(crate) fn tmpdir(n: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("margem-{n}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }
}
