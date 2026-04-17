# Plan 03 — Microphone Audio Recording

## Context

Currently FFmpeg captures only **system audio** via a hardcoded `audio=virtual-audio-capturer` DirectShow device, and only when `captureAudio` is `true` in the recording config. There's no way to record microphone audio, no device selection UI, and in fact the UI hardcodes `captureAudio: false` (audio isn't even enabled today).

**Goal**: Let the user toggle system audio and microphone independently, select a specific microphone device, and have both mixed into a single audio track in the final video.

**Recommendation**: Mix into a single track by default (best player compatibility). Dual-track export is deferred.

## Current State

### Backend: [src-tauri/src/commands/recording.rs](../../src-tauri/src/commands/recording.rs)

`RecordingConfig`:
```rust
pub struct RecordingConfig {
    pub x: i32, pub y: i32, pub width: i32, pub height: i32,
    pub fps: u32,
    pub output_path: String,
    pub capture_audio: bool,           // ← currently only controls system audio
    pub webcam_enabled: bool,
    pub webcam_size: i32,
    pub webcam_position: String,
}
```

Audio args assembly (`start_recording`):
```rust
if config.capture_audio {
    args.extend_from_slice(&[
        "-f".into(), "dshow".into(),
        "-i".into(), "audio=virtual-audio-capturer".into(),
    ]);
}
```

Webcam overlay uses `-filter_complex` with `-map 0:a?` for audio — if we add more audio inputs, the map logic needs to change.

`list_webcams` command pattern to copy for `list_audio_inputs`:
```rust
pub fn list_webcams(app: AppHandle) -> Result<Vec<String>, String> {
    // calls `ffmpeg -list_devices true -f dshow -i dummy`
    // parses stderr for lines containing "(video)" or "(none)", excluding "(audio)"
    // returns Vec<String> of device names
}
```

### Frontend

`RecordingConfig` (TS) in [src/stores/recordingStore.ts](../../src/stores/recordingStore.ts) mirrors the Rust struct.

`RecordingRegionSelector` currently passes `captureAudio: false` hardcoded in its `handleMouseUp` when calling `startRecording(config)`.

No dedicated recording options UI exists. The main window title bar has a CAM toggle but that's it.

## Implementation Steps

### Step 1: New Rust command `list_audio_inputs`

In [src-tauri/src/commands/recording.rs](../../src-tauri/src/commands/recording.rs), add:

```rust
#[tauri::command]
pub fn list_audio_inputs(app: AppHandle) -> Result<Vec<String>, String> {
    let ffmpeg_path = ffmpeg::get_ffmpeg_path_internal(&app)?;
    let output = Command::new(&ffmpeg_path)
        .args(["-list_devices", "true", "-f", "dshow", "-i", "dummy"])
        .output()
        .map_err(|e| format!("Failed to list devices: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut devices = Vec::new();

    for line in stderr.lines() {
        // Audio devices only — exclude video and "Alternative name" entries
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
```

Register in [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs) invoke handler list.

### Step 2: Extend `RecordingConfig` (Rust + TS)

**Rust** ([recording.rs](../../src-tauri/src/commands/recording.rs)):
```rust
pub struct RecordingConfig {
    pub x: i32, pub y: i32, pub width: i32, pub height: i32,
    pub fps: u32,
    pub output_path: String,
    pub system_audio: bool,                  // NEW
    pub mic_audio: bool,                     // NEW
    pub mic_device: Option<String>,          // NEW — None = first available
    pub webcam_enabled: bool,
    pub webcam_size: i32,
    pub webcam_position: String,
}
```

Remove the old `capture_audio` field.

**TS** ([recordingStore.ts](../../src/stores/recordingStore.ts)): mirror the change. Update `startRecording(config)` signature and `RecordingConfig` interface.

### Step 3: Rewrite FFmpeg audio arg assembly

Replace the existing `capture_audio` block with logic that builds a list of audio input indices, then assembles a filter_complex that mixes them.

Pseudo-code in `start_recording`:

```rust
// Input 0: screen (gdigrab) — always present
// Input 1: webcam (optional)
// Input N: system audio (if enabled)
// Input N+1: mic audio (if enabled)

let mut audio_inputs: Vec<usize> = Vec::new();  // FFmpeg input indices
let mut next_input_idx: usize = if webcam_added { 2 } else { 1 };

if config.system_audio {
    args.extend_from_slice(&[
        "-f".into(), "dshow".into(),
        "-i".into(), "audio=virtual-audio-capturer".into(),
    ]);
    audio_inputs.push(next_input_idx);
    next_input_idx += 1;
}

if config.mic_audio {
    let device = match &config.mic_device {
        Some(d) => d.clone(),
        None => {
            // Default: use first available audio input
            list_audio_inputs(app.clone())
                .ok()
                .and_then(|devices| devices.into_iter().next())
                .ok_or("No audio input device available".to_string())?
        }
    };
    args.extend_from_slice(&[
        "-f".into(), "dshow".into(),
        "-i".into(), format!("audio={}", device),
    ]);
    audio_inputs.push(next_input_idx);
    next_input_idx += 1;
}

// Build filter_complex
let mut filter_parts: Vec<String> = Vec::new();

if webcam_added {
    // existing webcam overlay filter
    filter_parts.push(format!("[1:v]scale=...[cam];[0:v][cam]overlay=...[vout]"));
}

if audio_inputs.len() >= 2 {
    let inputs_str: String = audio_inputs.iter()
        .map(|i| format!("[{}:a]", i))
        .collect::<Vec<_>>().join("");
    filter_parts.push(format!(
        "{}amix=inputs={}:duration=longest:dropout_transition=0[aout]",
        inputs_str, audio_inputs.len()
    ));
}

if !filter_parts.is_empty() {
    args.push("-filter_complex".into());
    args.push(filter_parts.join(";"));
}

// Map outputs
if webcam_added {
    args.extend_from_slice(&["-map".into(), "[vout]".into()]);
} else {
    args.extend_from_slice(&["-map".into(), "0:v".into()]);
}

match audio_inputs.len() {
    0 => {}, // no audio mapping
    1 => args.extend_from_slice(&["-map".into(), format!("{}:a", audio_inputs[0])]),
    _ => args.extend_from_slice(&["-map".into(), "[aout]".into()]),
}
```

**Note**: the existing webcam filter uses `[cam]` as an intermediate label and outputs to stdout (no explicit label). When we add audio filtering, we need to make the video output explicit with `[vout]` so the `-map` works cleanly.

### Step 4: Truth Table (document in code comment)

| webcam | system | mic | filter_complex | -map |
|---|---|---|---|---|
| ❌ | ❌ | ❌ | (none) | `0:v` |
| ❌ | ✅ | ❌ | (none) | `0:v` + `1:a` |
| ❌ | ❌ | ✅ | (none) | `0:v` + `1:a` |
| ❌ | ✅ | ✅ | `[1:a][2:a]amix=...[aout]` | `0:v` + `[aout]` |
| ✅ | ❌ | ❌ | `[1:v]scale...[cam];[0:v][cam]overlay[vout]` | `[vout]` |
| ✅ | ✅ | ❌ | `[1:v]scale...[cam];[0:v][cam]overlay[vout]` | `[vout]` + `2:a` |
| ✅ | ❌ | ✅ | `[1:v]scale...[cam];[0:v][cam]overlay[vout]` | `[vout]` + `2:a` |
| ✅ | ✅ | ✅ | `[1:v]scale...[cam];[0:v][cam]overlay[vout];[2:a][3:a]amix=...[aout]` | `[vout]` + `[aout]` |

### Step 5: UI — new `RecordingOptions` component

Create [src/components/recording/RecordingOptions.tsx](../../src/components/recording/RecordingOptions.tsx):

```tsx
// Small panel rendered before region selection (e.g. in title bar area or a dropdown)
// - System Audio toggle
// - Microphone toggle
// - Mic Device dropdown (populated from invoke("list_audio_inputs"))
// - Wires changes to recordingStore
```

Add state to [src/stores/recordingStore.ts](../../src/stores/recordingStore.ts):

```tsx
systemAudio: boolean;
micAudio: boolean;
micDevice: string | null;
audioInputs: string[];  // populated on mount via list_audio_inputs
setSystemAudio: (v: boolean) => void;
setMicAudio: (v: boolean) => void;
setMicDevice: (d: string | null) => void;
loadAudioInputs: () => Promise<void>;
```

In [RecordingRegionSelector](../../src/components/recording/RecordingRegionSelector.tsx) `handleMouseUp`, pull from store when building config:

```tsx
const { systemAudio, micAudio, micDevice } = useRecordingStore.getState();
const config = {
  ...
  systemAudio,
  micAudio,
  micDevice,
};
```

### Step 6: Graceful degradation

- On app startup, call `list_audio_inputs` to populate the dropdown.
- If `virtual-audio-capturer` isn't in the list, disable the System Audio toggle and show a tooltip: "Install Screen Capturer Recorder to enable system audio."
- If no audio inputs at all, disable the Microphone toggle too.

## Verification

1. **Enumerate devices**: run the app, verify the mic dropdown is populated with real device names.
2. **System-only recording**: enable System Audio only, record, verify playback has system audio (YouTube video playing in browser during record).
3. **Mic-only recording**: enable Mic only, record while speaking, verify playback has voice.
4. **Mixed recording**: enable both, record with voice over a video, verify both audio sources are audible in playback.
5. **Device switching**: change mic device between two recordings, verify second recording uses new device.
6. **Webcam + both audio**: enable webcam + both audio sources, verify video has webcam bubble AND mixed audio.
7. **No audio**: disable both, record, verify video has no audio track.
8. **Missing virtual-audio-capturer**: on a machine without it installed, verify System toggle is disabled with tooltip.

## Dependencies

- **None for backend work.**
- **UI can be built in parallel with overlay work** (this plan is independent of overlay coordinate changes in Phase 6).

## Files to Modify

- [src-tauri/src/commands/recording.rs](../../src-tauri/src/commands/recording.rs) — new command, config, FFmpeg args
- [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs) — register command
- [src/stores/recordingStore.ts](../../src/stores/recordingStore.ts) — config shape + audio state
- [src/components/recording/RecordingOptions.tsx](../../src/components/recording/RecordingOptions.tsx) — NEW
- [src/components/recording/RecordingRegionSelector.tsx](../../src/components/recording/RecordingRegionSelector.tsx) — pull audio config from store
- Wherever `RecordingOptions` is rendered (title bar, settings panel, or dedicated menu — decide during implementation)

## Out of Scope

- **Dual-track export**: both audio sources as separate tracks. Deferred — most consumer players only play the first track.
- **Mic level VU meter**: real-time input level indicator.
- **Audio-only mode**: recording without video.
- **Per-source volume adjustment**: fixed 50/50 mix.

## Decision Points

1. **Where to render `RecordingOptions`?** Options:
   - (a) In title bar next to CAM toggle — consistent with existing pattern
   - (b) In a dropdown triggered by a settings icon in the title bar — cleaner
   - (c) Embedded in a pre-recording modal
   - **Recommendation**: (a) for simplicity; revisit if title bar gets crowded.

2. **Default state**: System=off, Mic=off, or System=on, Mic=off? Recommend **both off** to match current behavior (no surprise audio recording).

3. **Does disabling audio mean no audio track, or a silent track?** Recommend **no track** (current behavior).

## Commit Message Draft

```
feat: microphone + system audio recording with mixing

Adds list_audio_inputs Rust command, replaces captureAudio bool with
systemAudio/micAudio/micDevice in RecordingConfig, and mixes sources
via FFmpeg amix filter when both enabled. New RecordingOptions UI in
title bar for toggling sources and selecting mic device.
```
