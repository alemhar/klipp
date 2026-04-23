mod capture;
mod commands;
mod settings;
mod tray;

use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager};

/// Apply the persisted window mode (pill / full) + bounds before the main
/// window is shown. Defaults to a 560x90 pill centered at the top of the
/// primary monitor on first run. Falls back silently on any error — the window
/// will still become visible with its tauri.conf.json defaults.
fn apply_initial_window_state(app: &AppHandle) {
    let settings = commands::settings::get_settings_internal(app).unwrap_or_default();
    let Some(win) = app.get_webview_window("main") else {
        return;
    };

    let is_pill = settings.launch_mode == "pill";
    let (default_w, default_h): (u32, u32) = if is_pill { (560, 90) } else { (1200, 800) };
    let bounds_opt = if is_pill { settings.pill_bounds } else { settings.full_bounds };
    let (width, height) = bounds_opt
        .map(|b| (b.width, b.height))
        .unwrap_or((default_w, default_h));

    let _ = win.set_resizable(!is_pill);
    let _ = win.set_size(LogicalSize::new(width as f64, height as f64));

    if let Some(b) = bounds_opt {
        let _ = win.set_position(LogicalPosition::new(b.x as f64, b.y as f64));
    } else if is_pill {
        // Center pill at top of primary monitor. Fall back to a sensible default
        // if the monitor can't be resolved.
        if let Ok(Some(m)) = win.primary_monitor() {
            let scale = m.scale_factor();
            let logical_w = m.size().width as f64 / scale;
            let x = ((logical_w - width as f64) / 2.0).round() as i32;
            let _ = win.set_position(LogicalPosition::new(x as f64, 10.0));
        }
    }

    let _ = win.show();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(commands::recording::RecordingState::new())
        .manage(commands::permissions::ConsentState::new())
        .setup(|app| {
            tray::create_tray(app)?;
            apply_initial_window_state(app.handle());

            // Seed the in-memory consent cache from settings.json so the
            // WebView2 PermissionRequested handler sees the correct state on
            // the very first getUserMedia call after launch.
            let stored = commands::settings::get_settings_internal(app.handle()).unwrap_or_default();
            app.state::<commands::permissions::ConsentState>()
                .load_from_settings(&stored.camera_consent, &stored.microphone_consent);

            // Attach the PermissionRequested handler to the main window's
            // WebView2 so AudioLevelIndicator's mic stream (opened in the main
            // window) is authorized by our stored consent rather than the
            // Chromium prompt. Overlay window gets its own attachment in
            // show_overlay — see commands/overlay.rs.
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = commands::permissions::attach_permission_handler(&main_win);
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            // Forward pill-menu selections (ids prefixed "pill-") back to the
            // frontend so the PillModeBar can update React state.
            let id = event.id().as_ref();
            if id.starts_with("pill-") {
                let _ = app.emit("pill-menu-selected", id.to_string());
            }
        })
        .on_window_event(|window, event| {
            // When the main window is closed, clean up overlay and mouse hook
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    let _ = commands::overlay::stop_mouse_hook();
                    if let Some(overlay) = window.app_handle().get_webview_window("overlay") {
                        let _ = overlay.close();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::capture::capture_fullscreen,
            commands::capture::capture_fullscreen_fast,
            commands::capture::capture_region,
            commands::capture::crop_image,
            commands::clipboard::copy_image_to_clipboard,
            commands::file_io::save_image,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::ffmpeg::check_ffmpeg,
            commands::ffmpeg::get_ffmpeg_path,
            commands::ffmpeg::download_ffmpeg,
            commands::recording::list_webcams,
            commands::recording::list_audio_inputs,
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::recording::is_recording,
            commands::overlay::show_overlay,
            commands::overlay::hide_overlay,
            commands::overlay::set_overlay_interactive,
            commands::overlay::start_mouse_hook,
            commands::overlay::stop_mouse_hook,
            commands::permissions::get_device_consent,
            commands::permissions::set_device_consent,
            commands::pill_menu::show_pill_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
