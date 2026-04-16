use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Emitter, Manager,
};

pub fn create_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let new_snip = MenuItem::with_id(app, "new_snip", "New Snip (Ctrl+Shift+S)", true, None::<&str>)?;
    let screen_record =
        MenuItem::with_id(app, "screen_record", "Screen Record", false, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let separator2 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit SnippingZo", true, Some("Ctrl+Q"))?;

    let menu = Menu::with_items(
        app,
        &[
            &new_snip,
            &screen_record,
            &separator,
            &settings,
            &separator2,
            &quit,
        ],
    )?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("SnippingZo")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "new_snip" => {
                let _ = app.emit("start-capture", "rectangular");
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = app.emit("open-settings", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
