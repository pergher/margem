//! Atalho global da captura rápida: com o app aberto em segundo plano ou minimizado, a combinação traz a janela para a frente
//! e pede ao app para abrir a captura (evento `margem://captura`). O app informa a combinação (`definir_atalho_global`);
//! `None` desliga. Onde o sistema não deixa registrar (Linux com Wayland, combinação já usada por outro programa), o erro volta
//! ao app para ser mostrado. Só no computador: no Android o comando existe, mas não faz nada.

use std::sync::Mutex;

/// Combinação registrada agora (para trocá-la ou tirá-la depois).
#[derive(Default)]
pub(crate) struct AtalhoGlobal(Mutex<Option<String>>);

#[cfg(not(target_os = "android"))]
pub(crate) fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    use tauri_plugin_global_shortcut::ShortcutState;
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _atalho, evento| {
            if evento.state() == ShortcutState::Pressed { crate::bandeja::pedir_captura(app); }
        })
        .build()
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) fn definir_atalho_global(app: tauri::AppHandle, estado: tauri::State<'_, AtalhoGlobal>, atalho: Option<String>) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let mut atual = crate::lock(&estado.0);
    if *atual == atalho { return Ok(()); }
    let gs = app.global_shortcut();
    if let Some(velho) = atual.take() { let _ = gs.unregister(velho.as_str()); }
    if let Some(novo) = atalho {
        gs.register(novo.as_str()).map_err(|e| format!("não deu para registrar {novo}: {e}"))?;
        *atual = Some(novo);
    }
    Ok(())
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) fn definir_atalho_global(_estado: tauri::State<'_, AtalhoGlobal>, _atalho: Option<String>) -> Result<(), String> { Ok(()) }
