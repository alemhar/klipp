mod capture;
mod commands;
mod settings;
mod tray;

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
        .setup(|app| {
            tray::create_tray(app)?;
            Ok(())
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
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::recording::is_recording,
            commands::overlay::show_overlay,
            commands::overlay::hide_overlay,
            commands::overlay::start_mouse_hook,
            commands::overlay::stop_mouse_hook,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
