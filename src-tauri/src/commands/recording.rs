use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, State};

use super::ffmpeg;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingConfig {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub fps: u32,
    pub output_path: String,
    pub capture_audio: bool,
    pub webcam_enabled: bool,
    pub webcam_size: i32,
    pub webcam_position: String, // "bottom-right", "bottom-left", "top-right", "top-left"
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

/// List available webcam devices
#[tauri::command]
pub fn list_webcams(app: AppHandle) -> Result<Vec<String>, String> {
    let ffmpeg_path = ffmpeg::get_ffmpeg_path_internal(&app)?;
    let output = Command::new(&ffmpeg_path)
        .args(["-list_devices", "true", "-f", "dshow", "-i", "dummy"])
        .output()
        .map_err(|e| format!("Failed to list devices: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut devices = Vec::new();

    for line in stderr.lines() {
        // Look for video devices — they show as "(video)" or "(none)" but NOT "(audio)"
        if (line.contains("(video)") || line.contains("(none)"))
            && !line.contains("(audio)")
            && !line.contains("Alternative name")
        {
            // Extract device name between quotes
            if let Some(start) = line.find('"') {
                if let Some(end) = line[start + 1..].find('"') {
                    devices.push(line[start + 1..start + 1 + end].to_string());
                }
            }
        }
    }

    Ok(devices)
}

/// Start screen recording using FFmpeg with GDI grab (Windows)
#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    config: RecordingConfig,
    state: State<'_, RecordingState>,
) -> Result<(), String> {
    let mut is_recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    if *is_recording {
        return Err("Already recording".into());
    }

    let ffmpeg_path = ffmpeg::get_ffmpeg_path_internal(&app)?;
    let mut args: Vec<String> = Vec::new();

    // Input 0: Screen capture via GDI
    args.extend_from_slice(&[
        "-y".into(),
        "-f".into(),
        "gdigrab".into(),
        "-framerate".into(),
        config.fps.to_string(),
        "-offset_x".into(),
        config.x.to_string(),
        "-offset_y".into(),
        config.y.to_string(),
        "-video_size".into(),
        format!("{}x{}", config.width, config.height),
        "-i".into(),
        "desktop".into(),
    ]);

    // Input 1: Webcam (if enabled)
    // Track whether we actually added a webcam input
    let mut webcam_added = false;
    if config.webcam_enabled {
        let webcams = list_webcams(app.clone()).unwrap_or_default();
        if let Some(cam_name) = webcams.first() {
            args.extend_from_slice(&[
                "-f".into(),
                "dshow".into(),
                "-i".into(),
                format!("video={}", cam_name),
            ]);
            webcam_added = true;
        }
    }

    // Audio capture if requested
    if config.capture_audio {
        args.extend_from_slice(&[
            "-f".into(),
            "dshow".into(),
            "-i".into(),
            "audio=virtual-audio-capturer".into(),
        ]);
    }

    // Filter: overlay webcam as circle if we successfully added a webcam input
    if webcam_added {
        let margin = 20;
        let cam_s = config.webcam_size;

        // Calculate overlay position
        let (ox, oy) = match config.webcam_position.as_str() {
            "bottom-left" => (margin, config.height - cam_s - margin),
            "top-right" => (config.width - cam_s - margin, margin),
            "top-left" => (margin, margin),
            _ => (config.width - cam_s - margin, config.height - cam_s - margin), // bottom-right default
        };

        // Create circular mask using geq filter and overlay
        // Scale webcam, make it circular, overlay on screen capture
        let filter = format!(
            "[1:v]scale={s}:{s},format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lte(pow(X-{r},2)+pow(Y-{r},2),pow({r},2)),255,0)'[cam];[0:v][cam]overlay={ox}:{oy}",
            s = cam_s,
            r = cam_s / 2,
            ox = ox,
            oy = oy
        );

        args.extend_from_slice(&["-filter_complex".into(), filter, "-map".into(), "0:a?".into()]);
    }

    // Output encoding
    args.extend_from_slice(&[
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        "ultrafast".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-crf".into(),
        "23".into(),
        config.output_path.clone(),
    ]);

    let child = Command::new(&ffmpeg_path)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
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
        if let Some(ref mut stdin) = child.stdin {
            use std::io::Write;
            let _ = stdin.write_all(b"q");
        }
        let _ = child.wait();
    }

    *process = None;
    *is_recording = false;

    Ok("Recording saved".into())
}

/// Check if currently recording
#[tauri::command]
pub fn is_recording(state: State<'_, RecordingState>) -> Result<bool, String> {
    let is_recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    Ok(*is_recording)
}
