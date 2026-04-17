use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

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

/// Applies a fully transparent background to the overlay's WebView2 surface
/// via the COREWEBVIEW2_DEFAULT_BACKGROUND_COLOR COM API. Must be called
/// whenever the window's layered-transparency state may have been reset
/// (e.g. after resize or after toggling set_ignore_cursor_events on Windows,
/// which can cause the webview to fall back to an opaque default background).
#[cfg(windows)]
fn apply_webview_transparency(
    overlay: &tauri::WebviewWindow,
) -> Result<(), tauri::Error> {
    overlay.with_webview(|webview: tauri::webview::PlatformWebview| {
        unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller2;
            use windows::core::Interface;

            let controller = webview.controller();
            let controller2: ICoreWebView2Controller2 = controller
                .cast()
                .expect("Failed to get ICoreWebView2Controller2");

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
}


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

    // Compute the outline pad on each side. We expand the overlay window by
    // OUTLINE_PAD pixels beyond the recording region (where screen space allows)
    // so the region-outline border sits outside the capture. If the region
    // touches the monitor edge on any side, pad on that side is 0 and the
    // outline on that side falls back to being inside the recording.
    const OUTLINE_PAD: i32 = 2;
    let region_x = x.unwrap_or(0);
    let region_y = y.unwrap_or(0);
    let region_w = width.unwrap_or(1920).max(1);
    let region_h = height.unwrap_or(1080).max(1);

    // Query monitor bounds so we know where the screen edges are. Falls back
    // to primary-resolution defaults if the query fails.
    let (mon_x, mon_y, mon_w, mon_h) = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let pos = m.position();
            let sz = m.size();
            (pos.x, pos.y, sz.width as i32, sz.height as i32)
        })
        .unwrap_or((0, 0, 1920, 1080));

    let pad_left = if region_x - mon_x >= OUTLINE_PAD { OUTLINE_PAD } else { 0 };
    let pad_top = if region_y - mon_y >= OUTLINE_PAD { OUTLINE_PAD } else { 0 };
    let pad_right = if (mon_x + mon_w) - (region_x + region_w) >= OUTLINE_PAD {
        OUTLINE_PAD
    } else {
        0
    };
    let pad_bottom = if (mon_y + mon_h) - (region_y + region_h) >= OUTLINE_PAD {
        OUTLINE_PAD
    } else {
        0
    };

    // Build overlay URL. Frontend reads region + pad values to correctly size
    // the region outline (inner edge aligned with the recorded region boundary).
    let url = format!(
        "overlay.html?x={}&y={}&w={}&h={}&pl={}&pt={}&pr={}&pb={}",
        region_x, region_y, region_w, region_h, pad_left, pad_top, pad_right, pad_bottom,
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
        // Builder-level transparent(true) ensures the OS window is created with
        // WS_EX_LAYERED, which is required for transparency to survive
        // set_ignore_cursor_events toggles. The WebView2 COM DefaultBackgroundColor
        // call below handles the webview's own background.
        .transparent(true)
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

    // Size overlay to match the (padded) recording region in physical pixels.
    // gdigrab + mouse hook both use physical coords, so PhysicalPosition/Size
    // keeps the coordinate contract consistent end-to-end. Must be applied
    // BEFORE the WebView2 transparency COM call; a resize afterwards reverts it.
    let win_x = region_x - pad_left;
    let win_y = region_y - pad_top;
    let win_w = (region_w + pad_left + pad_right).max(1) as u32;
    let win_h = (region_h + pad_top + pad_bottom).max(1) as u32;

    overlay
        .set_position(PhysicalPosition::new(win_x, win_y))
        .map_err(|e: tauri::Error| e.to_string())?;
    overlay
        .set_size(PhysicalSize::new(win_w, win_h))
        .map_err(|e: tauri::Error| e.to_string())?;

    // Windows adds invisible chrome around frameless Tauri/wry windows
    // (typically 8px on left/right/bottom, 0 on top). set_position sets the
    // OUTER position, but WebView2 renders inside the INNER area. Without
    // compensation, the inner area is offset by the chrome amount, which
    // pushes the region outline inside the captured region on the affected
    // sides. Query the delta and re-position the outer window so the inner
    // area lands exactly where we want it.
    if let (Ok(outer_pos), Ok(inner_pos)) =
        (overlay.outer_position(), overlay.inner_position())
    {
        let dx = inner_pos.x - outer_pos.x;
        let dy = inner_pos.y - outer_pos.y;
        if dx != 0 || dy != 0 {
            overlay
                .set_position(PhysicalPosition::new(win_x - dx, win_y - dy))
                .map_err(|e: tauri::Error| e.to_string())?;
        }
    }

    // Set WebView2 background to fully transparent via COM API, AFTER the resize
    // so the controller state is applied to the final window dimensions.
    #[cfg(windows)]
    apply_webview_transparency(&overlay).map_err(|e| e.to_string())?;

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
        // Toggling the layered-transparent flag on Windows can cause the WebView2
        // surface to revert to an opaque default background — re-apply transparency
        // to keep the overlay see-through during drawing.
        #[cfg(windows)]
        apply_webview_transparency(&overlay).map_err(|e: tauri::Error| e.to_string())?;
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
