use std::sync::mpsc;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn show_overlay(app: AppHandle) -> Result<(), String> {
    // If overlay already exists, just show it
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.show().map_err(|e: tauri::Error| e.to_string())?;
        return Ok(());
    }

    // Create the overlay window on the main thread via channel to avoid deadlocks.
    // Async tauri commands run on a thread pool, but window creation must happen
    // on the main thread.
    let (tx, rx) = mpsc::channel();
    let app_clone = app.clone();

    app.run_on_main_thread(move || {
        let result = WebviewWindowBuilder::new(
            &app_clone,
            "overlay",
            WebviewUrl::App("overlay.html".into()),
        )
        .title("")
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build();

        let _ = tx.send(result);
    })
    .map_err(|e: tauri::Error| e.to_string())?;

    let overlay = rx
        .recv()
        .map_err(|e| e.to_string())?
        .map_err(|e: tauri::Error| e.to_string())?;

    // Set WebView2 background to fully transparent via COM API
    #[cfg(windows)]
    {
        overlay
            .with_webview(|webview: tauri::webview::PlatformWebview| {
                unsafe {
                    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller2;
                    use windows::core::Interface;

                    let controller = webview.controller();
                    let controller2: ICoreWebView2Controller2 =
                        controller.cast().expect("Failed to get ICoreWebView2Controller2");

                    let transparent_color =
                        webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_COLOR {
                            A: 0,
                            R: 0,
                            G: 0,
                            B: 0,
                        };
                    controller2
                        .SetDefaultBackgroundColor(transparent_color)
                        .expect("Failed to set transparent background");
                }
            })
            .map_err(|e: tauri::Error| e.to_string())?;
    }

    overlay
        .set_fullscreen(true)
        .map_err(|e: tauri::Error| e.to_string())?;
    overlay
        .set_ignore_cursor_events(true)
        .map_err(|e: tauri::Error| e.to_string())?;
    overlay
        .show()
        .map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn hide_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.hide().map_err(|e: tauri::Error| e.to_string())?;
        overlay.close().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}
