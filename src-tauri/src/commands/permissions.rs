// WebView2 permission intercept for camera/microphone.
//
// Without this handler, WebView2 shows its own Chromium-style "localhost wants
// to use your camera/microphone" dialog the first time `getUserMedia()` is
// called, and remembers Block decisions per-origin indefinitely. We replace
// that with a Klipp-branded in-app consent modal (in React) plus this handler,
// which reads the user's stored consent and mirrors it back to WebView2 so the
// Chromium prompt never surfaces.
//
// Authorization model:
//   - "allowed" -> SetState(ALLOW). getUserMedia succeeds.
//   - "denied" or "unknown" -> SetState(DENY). getUserMedia rejects.
//
// This means a React bug that calls getUserMedia without first securing
// consent can never accidentally grant silent device access — the stored
// consent is the only source of truth.
//
// React is responsible for surfacing the consent modal BEFORE calling
// getUserMedia, and for calling `set_device_consent` to flip the state to
// "allowed" once the user explicitly agrees.

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[cfg(windows)]
use webview2_com::Microsoft::Web::WebView2::Win32::{
    COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_CAMERA,
    COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    COREWEBVIEW2_PERMISSION_STATE_DENY,
};
#[cfg(windows)]
use webview2_com::PermissionRequestedEventHandler;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Device {
    Camera,
    Microphone,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ConsentValue {
    Unknown,
    Allowed,
    Denied,
}

fn parse_consent(s: &str) -> ConsentValue {
    match s {
        "allowed" => ConsentValue::Allowed,
        "denied" => ConsentValue::Denied,
        _ => ConsentValue::Unknown,
    }
}

fn consent_to_str(v: ConsentValue) -> &'static str {
    match v {
        ConsentValue::Unknown => "unknown",
        ConsentValue::Allowed => "allowed",
        ConsentValue::Denied => "denied",
    }
}

/// In-memory cache of the user's per-device consent decisions. Initialized
/// from settings.json at boot and kept in sync by `set_device_consent`. The
/// WebView2 PermissionRequested handler reads from here on every event.
pub struct ConsentState(Mutex<HashMap<Device, ConsentValue>>);

impl ConsentState {
    pub fn new() -> Self {
        let mut m = HashMap::new();
        m.insert(Device::Camera, ConsentValue::Unknown);
        m.insert(Device::Microphone, ConsentValue::Unknown);
        Self(Mutex::new(m))
    }

    pub fn get(&self, d: Device) -> ConsentValue {
        self.0
            .lock()
            .ok()
            .and_then(|g| g.get(&d).copied())
            .unwrap_or(ConsentValue::Unknown)
    }

    pub fn set(&self, d: Device, v: ConsentValue) {
        if let Ok(mut g) = self.0.lock() {
            g.insert(d, v);
        }
    }

    /// Seed the cache from persisted settings values. Called once during app
    /// setup so the PermissionRequested handler sees the correct state on the
    /// very first getUserMedia call.
    pub fn load_from_settings(&self, camera: &str, microphone: &str) {
        self.set(Device::Camera, parse_consent(camera));
        self.set(Device::Microphone, parse_consent(microphone));
    }
}

#[tauri::command]
pub fn get_device_consent(
    device: String,
    state: State<'_, ConsentState>,
) -> Result<String, String> {
    let d = match device.as_str() {
        "camera" => Device::Camera,
        "microphone" => Device::Microphone,
        _ => return Err(format!("Unknown device: {}", device)),
    };
    Ok(consent_to_str(state.get(d)).to_string())
}

#[tauri::command]
pub fn set_device_consent(
    app: AppHandle,
    device: String,
    consent: String,
    state: State<'_, ConsentState>,
) -> Result<(), String> {
    let d = match device.as_str() {
        "camera" => Device::Camera,
        "microphone" => Device::Microphone,
        _ => return Err(format!("Unknown device: {}", device)),
    };
    let v = parse_consent(&consent);
    state.set(d, v);

    // Persist to settings.json so the next launch boots into the same state.
    let mut settings = crate::commands::settings::get_settings_internal(&app).unwrap_or_default();
    let canonical = consent_to_str(v).to_string();
    match d {
        Device::Camera => settings.camera_consent = canonical,
        Device::Microphone => settings.microphone_consent = canonical,
    }
    crate::commands::settings::save_settings(app, settings)
}

/// Attach the PermissionRequested handler to a window's WebView2 instance.
/// Must be called for each window that may call `getUserMedia` — currently
/// the main window (for AudioLevelIndicator) and the overlay window (for the
/// webcam bubble).
#[cfg(windows)]
pub fn attach_permission_handler(window: &tauri::WebviewWindow) -> Result<(), tauri::Error> {
    let app_handle = window.app_handle().clone();
    window.with_webview(move |webview: tauri::webview::PlatformWebview| {
        unsafe {
            let controller = webview.controller();
            let core = match controller.CoreWebView2() {
                Ok(c) => c,
                Err(_) => return,
            };
            let mut token = 0i64;
            let handler =
                PermissionRequestedEventHandler::create(Box::new(move |_sender, args| {
                    let Some(args) = args else {
                        return Ok(());
                    };

                    let mut kind = COREWEBVIEW2_PERMISSION_KIND(0);
                    args.PermissionKind(&mut kind)?;

                    let device = if kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA {
                        Some(Device::Camera)
                    } else if kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE {
                        Some(Device::Microphone)
                    } else {
                        None
                    };

                    if let Some(d) = device {
                        let state = app_handle.state::<ConsentState>();
                        let decision = match state.get(d) {
                            ConsentValue::Allowed => COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                            // Unknown and Denied both map to DENY. React is
                            // expected to gate getUserMedia behind the consent
                            // modal, so reaching this handler with Unknown
                            // means a bug — denying is the safe default.
                            _ => COREWEBVIEW2_PERMISSION_STATE_DENY,
                        };
                        args.SetState(decision)?;
                    }
                    // Any other permission kind (notifications, geolocation,
                    // etc.) falls through unhandled. WebView2 will apply its
                    // default behavior (usually deny) for those.
                    Ok(())
                }));
            let _ = core.add_PermissionRequested(&handler, &mut token);
        }
    })
}

#[cfg(not(windows))]
pub fn attach_permission_handler(_window: &tauri::WebviewWindow) -> Result<(), tauri::Error> {
    Ok(())
}
