# Overlay — Next Session TODO

## Phase 6: Polish (Current)
- Size overlay to recording region (not full desktop) using `RecordingConfig` dimensions
- DPI scaling: convert between physical (mouse hook) and logical (overlay) coordinates
- Cap concurrent ripples at ~10, use CSS transform animations for GPU acceleration
- Multi-monitor support

## Good-to-Have (Future)

### 1. Webcam Position Cycling Hotkey
Add a global shortcut (e.g. `Ctrl+Shift+P`) that cycles the webcam bubble through fixed positions relative to the recording region:
- **Bottom-right** (default) → **Bottom-left** → **Top-left** → **Top-right** → back to **Bottom-right**

Each position should have a consistent margin from the region edges (e.g. 20px).

### 2. Recording Region Outline
Show a visible outline/stroke around the selected recording region so the user knows exactly what area is being captured. This helps the user stay aware of what's within frame during recording. Could be a thin colored border (e.g. red dashed line) rendered on the overlay at the region coordinates.

### 3. Microphone Audio Recording
Investigate and verify whether microphone audio is being captured alongside the video. Currently FFmpeg uses `audio=virtual-audio-capturer` for system audio when `captureAudio` is enabled. Check if:
- Microphone input is also captured
- If not, add an option to select and record from a microphone device via DirectShow
- Consider mixing mic + system audio into a single track

### 4. Timeout Investigation
Investigate the timeout errors appearing in the app during recording. Determine:
- What is causing the timeouts (WebView2 initialization? IPC calls? FFmpeg?)
- Are they dev-mode only (hot reload, file watcher) or would they occur in production builds?
- If dev-only, document and ignore; if production, fix the root cause
