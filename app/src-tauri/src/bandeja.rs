//! Modo bandeja (Windows): com ele ligado, fechar a janela só a esconde e o Margem continua rodando, com um ícone na área de
//! notificação (clique abre a janela; menu direito: Abrir, Captura rápida, Sair). Assim o atalho global funciona com a janela
//! "fechada". Quem esconde a janela é o app (depois de salvar a nota); aqui ficam o ícone e os ajudantes de janela.
//! No Android os comandos existem, mas não fazem nada.

#[cfg(not(target_os = "android"))]
use tauri::{AppHandle, Emitter, Manager, Runtime};

#[cfg(not(target_os = "android"))]
const ID: &str = "margem";

/// Traz a janela principal para a frente (mesmo escondida ou minimizada).
#[cfg(not(target_os = "android"))]
pub(crate) fn mostrar_janela<R: Runtime>(app: &AppHandle<R>) {
    if let Some(janela) = app.get_webview_window("main") {
        let _ = janela.unminimize();
        let _ = janela.show();
        let _ = janela.set_focus();
    }
}

/// Traz a janela e pede ao app para abrir a captura rápida.
#[cfg(not(target_os = "android"))]
pub(crate) fn pedir_captura<R: Runtime>(app: &AppHandle<R>) {
    mostrar_janela(app);
    let _ = app.emit("margem://captura", ());
}

#[cfg(not(target_os = "android"))]
fn criar_icone(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    let abrir = MenuItem::with_id(app, "abrir", "Abrir o Margem", true, None::<&str>)?;
    let captura = MenuItem::with_id(app, "captura", "Captura rápida", true, None::<&str>)?;
    let sair = MenuItem::with_id(app, "sair", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&abrir, &captura, &PredefinedMenuItem::separator(app)?, &sair])?;
    let mut b = TrayIconBuilder::with_id(ID)
        .tooltip("Margem")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, ev| match ev.id().as_ref() {
            "abrir" => mostrar_janela(app),
            "captura" => pedir_captura(app),
            "sair" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev { mostrar_janela(tray.app_handle()); }
        });
    if let Some(icone) = app.default_window_icon() { b = b.icon(icone.clone()); }
    b.build(app)?;
    Ok(())
}

/// Liga (cria o ícone) ou desliga (tira o ícone) o modo bandeja. Só deve ser considerado pronto depois de `Ok`.
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) fn definir_bandeja(app: AppHandle, ligada: bool) -> Result<(), String> {
    if !ligada { let _ = app.remove_tray_by_id(ID); return Ok(()); }
    if app.tray_by_id(ID).is_some() { return Ok(()); }
    criar_icone(&app).map_err(|e| format!("não deu para criar o ícone da bandeja: {e}"))
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) fn definir_bandeja(_ligada: bool) -> Result<(), String> { Ok(()) }
