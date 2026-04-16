use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(windows)]
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, SetWindowsHookExW, UnhookWindowsHookEx, HHOOK, MSLLHOOKSTRUCT,
    WH_MOUSE_LL, WM_LBUTTONDOWN, WM_MBUTTONDOWN, WM_RBUTTONDOWN,
};

static HOOK_ACTIVE: AtomicBool = AtomicBool::new(false);
static MOUSE_HOOK: Mutex<Option<isize>> = Mutex::new(None);
static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);

#[derive(Clone, serde::Serialize)]
struct ClickEvent {
    x: i32,
    y: i32,
    button: String,
}

#[cfg(windows)]
unsafe extern "system" fn mouse_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code >= 0 && HOOK_ACTIVE.load(Ordering::Relaxed) {
        let button = match w_param.0 as u32 {
            WM_LBUTTONDOWN => Some("left"),
            WM_RBUTTONDOWN => Some("right"),
            WM_MBUTTONDOWN => Some("middle"),
            _ => None,
        };

        if let Some(button) = button {
            let mouse_struct = unsafe { &*(l_param.0 as *const MSLLHOOKSTRUCT) };
            let event = ClickEvent {
                x: mouse_struct.pt.x,
                y: mouse_struct.pt.y,
                button: button.to_string(),
            };

            if let Some(app) = APP_HANDLE.lock().ok().and_then(|g| g.clone()) {
                let _ = app.emit("mouse-click", event);
            }
        }
    }

    unsafe { CallNextHookEx(None, n_code, w_param, l_param) }
}

// ─── Overlay window commands ───

#[tauri::command]
pub async fn show_overlay(
    app: AppHandle,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<i32>,
    height: Option<i32>,
) -> Result<(), String> {
    // If overlay already exists, just show it
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.show().map_err(|e: tauri::Error| e.to_string())?;
        return Ok(());
    }

    // Build overlay URL with region query params so the React app knows the recording area
    let url = format!(
        "overlay.html?x={}&y={}&w={}&h={}",
        x.unwrap_or(0),
        y.unwrap_or(0),
        width.unwrap_or(1920),
        height.unwrap_or(1080),
    );

    // Create the overlay window on the main thread via channel to avoid deadlocks.
    let (tx, rx) = mpsc::channel();
    let app_clone = app.clone();

    app.run_on_main_thread(move || {
        let result = WebviewWindowBuilder::new(
            &app_clone,
            "overlay",
            WebviewUrl::App(url.into()),
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

// ─── Overlay interactivity ───

#[tauri::command]
pub fn set_overlay_interactive(app: AppHandle, interactive: bool) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay
            .set_ignore_cursor_events(!interactive)
            .map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

// ─── Mouse hook commands ───

#[tauri::command]
pub fn start_mouse_hook(app: AppHandle) -> Result<(), String> {
    if HOOK_ACTIVE.load(Ordering::Relaxed) {
        return Ok(());
    }

    *APP_HANDLE.lock().map_err(|e| e.to_string())? = Some(app);

    #[cfg(windows)]
    {
        let hook = unsafe {
            SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), None, 0)
                .map_err(|e| format!("Failed to set mouse hook: {}", e))?
        };

        *MOUSE_HOOK.lock().map_err(|e| e.to_string())? = Some(hook.0 as isize);
    }

    HOOK_ACTIVE.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn stop_mouse_hook() -> Result<(), String> {
    if !HOOK_ACTIVE.load(Ordering::Relaxed) {
        return Ok(());
    }

    HOOK_ACTIVE.store(false, Ordering::Relaxed);

    #[cfg(windows)]
    {
        if let Some(hook_id) = MOUSE_HOOK.lock().map_err(|e| e.to_string())?.take() {
            unsafe {
                let _ = UnhookWindowsHookEx(HHOOK(hook_id as *mut _));
            }
        }
    }

    *APP_HANDLE.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}
