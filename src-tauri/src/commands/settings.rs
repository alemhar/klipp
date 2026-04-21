use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

fn default_launch_mode() -> String {
    "pill".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub auto_copy_to_clipboard: bool,
    pub auto_save: bool,
    pub auto_save_path: String,
    pub default_format: String,
    pub capture_shortcut: String,
    pub snip_outline: bool,
    pub snip_outline_color: String,

    #[serde(default = "default_launch_mode")]
    pub launch_mode: String,
    #[serde(default)]
    pub pill_bounds: Option<WindowBounds>,
    #[serde(default)]
    pub full_bounds: Option<WindowBounds>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            auto_copy_to_clipboard: true,
            auto_save: false,
            auto_save_path: String::new(),
            default_format: "png".into(),
            capture_shortcut: "Ctrl+Shift+S".into(),
            snip_outline: false,
            snip_outline_color: "#FF0000".into(),
            launch_mode: default_launch_mode(),
            pill_bounds: None,
            full_bounds: None,
        }
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    Ok(config_dir.join("settings.json"))
}

/// Read settings from disk. Used by the Tauri setup hook to apply initial
/// window bounds before the UI becomes visible. Mirrors the `get_ffmpeg_path_internal`
/// pattern — same I/O as the command but callable directly from Rust.
pub fn get_settings_internal(app: &AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app)?;
    if path.exists() {
        let content =
            fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
    } else {
        Ok(AppSettings::default())
    }
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    get_settings_internal(&app)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))?;
    Ok(())
}
