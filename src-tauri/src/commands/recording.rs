use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingConfig {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub fps: u32,
    pub output_path: String,
    pub capture_audio: bool,
}

pub struct RecordingState {
    process: Mutex<Option<Child>>,
    is_recording: Mutex<bool>,
}

impl RecordingState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            is_recording: Mutex::new(false),
        }
    }
}

/// Check if FFmpeg is available on the system
#[tauri::command]
pub fn check_ffmpeg() -> Result<bool, String> {
    match Command::new("ffmpeg").arg("-version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Start screen recording using FFmpeg with GDI grab (Windows)
#[tauri::command]
pub fn start_recording(
    config: RecordingConfig,
    state: State<'_, RecordingState>,
) -> Result<(), String> {
    let mut is_recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    if *is_recording {
        return Err("Already recording".into());
    }

    // Build FFmpeg command for Windows GDI screen capture
    let mut args = vec![
        "-y".to_string(),
        "-f".to_string(),
        "gdigrab".to_string(),
        "-framerate".to_string(),
        config.fps.to_string(),
        "-offset_x".to_string(),
        config.x.to_string(),
        "-offset_y".to_string(),
        config.y.to_string(),
        "-video_size".to_string(),
        format!("{}x{}", config.width, config.height),
        "-i".to_string(),
        "desktop".to_string(),
    ];

    // Add audio capture if requested
    if config.capture_audio {
        // Capture system audio via DirectShow (requires virtual audio cable or similar)
        args.extend_from_slice(&[
            "-f".to_string(),
            "dshow".to_string(),
            "-i".to_string(),
            "audio=virtual-audio-capturer".to_string(),
        ]);
    }

    // Output encoding settings
    args.extend_from_slice(&[
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "ultrafast".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-crf".to_string(),
        "23".to_string(),
        config.output_path.clone(),
    ]);

    let child = Command::new("ffmpeg")
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}. Is FFmpeg installed?", e))?;

    let mut process = state.process.lock().map_err(|e| e.to_string())?;
    *process = Some(child);
    *is_recording = true;

    Ok(())
}

/// Stop the current recording
#[tauri::command]
pub fn stop_recording(state: State<'_, RecordingState>) -> Result<String, String> {
    let mut is_recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    let mut process = state.process.lock().map_err(|e| e.to_string())?;

    if !*is_recording {
        return Err("Not recording".into());
    }

    if let Some(ref mut child) = *process {
        // Send 'q' to FFmpeg's stdin to gracefully stop
        if let Some(ref mut stdin) = child.stdin {
            use std::io::Write;
            let _ = stdin.write_all(b"q");
        }
        // Wait for process to finish
        let _ = child.wait();
    }

    let output_path = process
        .as_ref()
        .map(|_| "Recording saved".to_string())
        .unwrap_or_default();

    *process = None;
    *is_recording = false;

    Ok(output_path)
}

/// Check if currently recording
#[tauri::command]
pub fn is_recording(state: State<'_, RecordingState>) -> Result<bool, String> {
    let is_recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    Ok(*is_recording)
}
