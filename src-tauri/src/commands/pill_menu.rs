use tauri::{
    menu::{CheckMenuItem, ContextMenu, Menu, MenuItem, PredefinedMenuItem},
    AppHandle, LogicalPosition, Wry,
};

/// Show a native popup menu for the pill UI. Using the OS menu means the
/// dropdown paints *outside* the pill window, matching Microsoft Snipping
/// Tool's behaviour — no window resize hack needed. Item IDs are prefixed by
/// the menu kind (e.g. "pill-mode:rectangular") so the global menu-event
/// handler can route the selection to the correct frontend handler via a
/// `pill-menu-selected` event.
#[tauri::command]
pub fn show_pill_menu(
    app: AppHandle,
    window: tauri::WebviewWindow,
    kind: String,
    x: f64,
    y: f64,
    current_mode: String,
    current_delay: u32,
    mic_enabled: bool,
    webcam_enabled: bool,
) -> Result<(), String> {
    let menu = match kind.as_str() {
        "mode" => build_mode_menu(&app, &current_mode)?,
        "delay" => build_delay_menu(&app, current_delay)?,
        "options" => build_options_menu(&app, mic_enabled, webcam_enabled)?,
        other => return Err(format!("unknown pill menu kind: {}", other)),
    };
    ContextMenu::popup_at(&menu, window.as_ref().window(), LogicalPosition::new(x, y))
        .map_err(|e| format!("Failed to popup menu: {}", e))?;
    Ok(())
}

fn build_mode_menu(app: &AppHandle, current: &str) -> Result<Menu<Wry>, String> {
    let menu = Menu::new(app).map_err(|e| e.to_string())?;
    let selection = CheckMenuItem::with_id(
        app,
        "pill-mode:rectangular",
        "Selection",
        true,
        current == "rectangular",
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let fullscreen = CheckMenuItem::with_id(
        app,
        "pill-mode:fullscreen",
        "Fullscreen",
        true,
        current == "fullscreen",
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let window_item = CheckMenuItem::with_id(
        app,
        "pill-mode:window",
        "Window (coming soon)",
        false,
        false,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    menu.append(&selection).map_err(|e| e.to_string())?;
    menu.append(&fullscreen).map_err(|e| e.to_string())?;
    menu.append(&window_item).map_err(|e| e.to_string())?;
    Ok(menu)
}

fn build_delay_menu(app: &AppHandle, current: u32) -> Result<Menu<Wry>, String> {
    let menu = Menu::new(app).map_err(|e| e.to_string())?;
    for (val, label) in [
        (0u32, "No delay"),
        (3, "3 seconds"),
        (5, "5 seconds"),
        (10, "10 seconds"),
    ] {
        let item = CheckMenuItem::with_id(
            app,
            &format!("pill-delay:{}", val),
            label,
            true,
            current == val,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        menu.append(&item).map_err(|e| e.to_string())?;
    }
    Ok(menu)
}

fn build_options_menu(
    app: &AppHandle,
    mic_enabled: bool,
    webcam_enabled: bool,
) -> Result<Menu<Wry>, String> {
    let menu = Menu::new(app).map_err(|e| e.to_string())?;

    // Audio header (disabled "item" used as a visual label)
    let audio_header =
        MenuItem::with_id(app, "pill-opts:__audio-header", "Audio sources", false, None::<&str>)
            .map_err(|e| e.to_string())?;
    menu.append(&audio_header).map_err(|e| e.to_string())?;

    let mic = CheckMenuItem::with_id(
        app,
        "pill-opts:mic",
        "Microphone",
        true,
        mic_enabled,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    menu.append(&mic).map_err(|e| e.to_string())?;

    let sys =
        CheckMenuItem::with_id(app, "pill-opts:sys", "System audio (coming soon)", false, false, None::<&str>)
            .map_err(|e| e.to_string())?;
    menu.append(&sys).map_err(|e| e.to_string())?;

    let sep1 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    menu.append(&sep1).map_err(|e| e.to_string())?;

    // Webcam header
    let webcam_header =
        MenuItem::with_id(app, "pill-opts:__webcam-header", "Webcam", false, None::<&str>)
            .map_err(|e| e.to_string())?;
    menu.append(&webcam_header).map_err(|e| e.to_string())?;

    let webcam = CheckMenuItem::with_id(
        app,
        "pill-opts:webcam",
        "Webcam overlay",
        true,
        webcam_enabled,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    menu.append(&webcam).map_err(|e| e.to_string())?;

    let sep2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    menu.append(&sep2).map_err(|e| e.to_string())?;

    let prefs = MenuItem::with_id(app, "pill-opts:prefs", "Preferences…", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    menu.append(&prefs).map_err(|e| e.to_string())?;

    let quit = MenuItem::with_id(app, "pill-opts:quit", "Quit Klipp", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    menu.append(&quit).map_err(|e| e.to_string())?;

    Ok(menu)
}
