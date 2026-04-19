use serde::{Deserialize, Serialize};
use std::process::{Child, Stdio};
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
    pub system_audio: bool,
    pub mic_audio: bool,
    pub mic_device: Option<String>, // None = use first available audio input
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
    let output = ffmpeg::hidden_command(&ffmpeg_path)
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

/// List available audio input devices (microphones, line-ins, virtual captures)
#[tauri::command]
pub fn list_audio_inputs(app: AppHandle) -> Result<Vec<String>, String> {
    let ffmpeg_path = ffmpeg::get_ffmpeg_path_internal(&app)?;
    let output = ffmpeg::hidden_command(&ffmpeg_path)
        .args(["-list_devices", "true", "-f", "dshow", "-i", "dummy"])
        .output()
        .map_err(|e| format!("Failed to list devices: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut devices = Vec::new();

    for line in stderr.lines() {
        // Audio-only devices: "(audio)" and not "(video)", skip duplicate "Alternative name" rows
        if line.contains("(audio)")
            && !line.contains("(video)")
            && !line.contains("Alternative name")
        {
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

    // Track which FFmpeg input indices hold audio streams, so we can map them.
    // Input 0 = screen. If webcam added, input 1 = webcam. Audio inputs come next.
    let mut next_input_idx: usize = if webcam_added { 2 } else { 1 };
    let mut audio_inputs: Vec<usize> = Vec::new();

    // Input: system audio (virtual-audio-capturer, from Screen Capturer Recorder)
    // Validate the driver is actually installed before FFmpeg fails opaquely.
    if config.system_audio {
        let devices = list_audio_inputs(app.clone()).unwrap_or_default();
        if !devices.iter().any(|d| d == "virtual-audio-capturer") {
            return Err(
                "System audio requires the 'virtual-audio-capturer' DirectShow driver, \
                 which is not installed. Install Screen Capturer Recorder to enable this feature."
                    .into(),
            );
        }
        args.extend_from_slice(&[
            "-f".into(),
            "dshow".into(),
            "-i".into(),
            "audio=virtual-audio-capturer".into(),
        ]);
        audio_inputs.push(next_input_idx);
        next_input_idx += 1;
    }

    // Input: microphone
    if config.mic_audio {
        // Resolve device: explicit from config, or first available audio input
        let device = match &config.mic_device {
            Some(d) => Some(d.clone()),
            None => list_audio_inputs(app.clone())
                .ok()
                .and_then(|devices| devices.into_iter().next()),
        };
        if let Some(device) = device {
            args.extend_from_slice(&[
                "-f".into(),
                "dshow".into(),
                "-i".into(),
                format!("audio={}", device),
            ]);
            audio_inputs.push(next_input_idx);
            next_input_idx += 1;
        }
        // If no mic device available, silently skip (graceful degradation)
    }

    // Build filter_complex (webcam overlay + audio mix), and track whether we
    // need to map explicit [vout]/[aout] labels.
    let mut filter_parts: Vec<String> = Vec::new();
    let mut has_vout_label = false;
    let mut has_aout_label = false;

    // Video filter: overlay circular webcam on the screen capture
    if webcam_added {
        let margin = 20;
        let cam_s = config.webcam_size;
        let (ox, oy) = match config.webcam_position.as_str() {
            "bottom-left" => (margin, config.height - cam_s - margin),
            "top-right" => (config.width - cam_s - margin, margin),
            "top-left" => (margin, margin),
            _ => (config.width - cam_s - margin, config.height - cam_s - margin),
        };
        filter_parts.push(format!(
            "[1:v]scale={s}:{s},format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lte(pow(X-{r},2)+pow(Y-{r},2),pow({r},2)),255,0)'[cam];[0:v][cam]overlay={ox}:{oy}[vout]",
            s = cam_s,
            r = cam_s / 2,
            ox = ox,
            oy = oy
        ));
        has_vout_label = true;
    }

    // Audio filter: mix multiple audio inputs via amix
    if audio_inputs.len() >= 2 {
        let inputs_str: String = audio_inputs
            .iter()
            .map(|i| format!("[{}:a]", i))
            .collect::<Vec<_>>()
            .join("");
        filter_parts.push(format!(
            "{}amix=inputs={}:duration=longest:dropout_transition=0[aout]",
            inputs_str,
            audio_inputs.len()
        ));
        has_aout_label = true;
    }

    if !filter_parts.is_empty() {
        args.push("-filter_complex".into());
        args.push(filter_parts.join(";"));
    }

    // Map outputs
    if has_vout_label {
        args.extend_from_slice(&["-map".into(), "[vout]".into()]);
    } else {
        args.extend_from_slice(&["-map".into(), "0:v".into()]);
    }
    match audio_inputs.len() {
        0 => {} // no audio
        1 => args.extend_from_slice(&["-map".into(), format!("{}:a", audio_inputs[0])]),
        _ => args.extend_from_slice(&["-map".into(), "[aout]".into()]),
    }
    // has_aout_label is only used for readability; map logic handles it above
    let _ = has_aout_label;

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

    let child = ffmpeg::hidden_command(&ffmpeg_path)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
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
