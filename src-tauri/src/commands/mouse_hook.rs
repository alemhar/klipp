use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::*;
use windows::Win32::UI::WindowsAndMessaging::*;

static HOOK_ACTIVE: AtomicBool = AtomicBool::new(false);
static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);

#[derive(serde::Serialize, Clone)]
pub struct MouseClickEvent {
    pub x: i32,
    pub y: i32,
    pub button: String, // "left", "right", "middle"
}

unsafe extern "system" fn mouse_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code >= 0 {
        let button = match w_param.0 as u32 {
            WM_LBUTTONDOWN => Some("left"),
            WM_RBUTTONDOWN => Some("right"),
            WM_MBUTTONDOWN => Some("middle"),
            _ => None,
        };

        if let Some(btn) = button {
            let mouse_struct = &*(l_param.0 as *const MSLLHOOKSTRUCT);
            let event = MouseClickEvent {
                x: mouse_struct.pt.x,
                y: mouse_struct.pt.y,
                button: btn.to_string(),
            };

            if let Ok(guard) = APP_HANDLE.lock() {
                if let Some(app) = guard.as_ref() {
                    let _ = app.emit("mouse-click", event);
                }
            }
        }
    }

    unsafe { CallNextHookEx(None, n_code, w_param, l_param) }
}

#[tauri::command]
pub fn start_mouse_hook(app: AppHandle) -> Result<(), String> {
    if HOOK_ACTIVE.load(Ordering::SeqCst) {
        return Ok(());
    }

    {
        let mut handle = APP_HANDLE.lock().map_err(|e| e.to_string())?;
        *handle = Some(app);
    }

    std::thread::spawn(|| unsafe {
        let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), None, 0);
        match hook {
            Ok(hook_id) => {
                HOOK_ACTIVE.store(true, Ordering::SeqCst);
                // Message loop to keep the hook alive
                let mut msg = MSG::default();
                while HOOK_ACTIVE.load(Ordering::SeqCst) {
                    if PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).as_bool() {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    } else {
                        std::thread::sleep(std::time::Duration::from_millis(10));
                    }
                }
                let _ = UnhookWindowsHookEx(hook_id);
            }
            Err(e) => {
                eprintln!("Failed to set mouse hook: {}", e);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_mouse_hook() -> Result<(), String> {
    HOOK_ACTIVE.store(false, Ordering::SeqCst);
    let mut handle = APP_HANDLE.lock().map_err(|e| e.to_string())?;
    *handle = None;
    Ok(())
}
