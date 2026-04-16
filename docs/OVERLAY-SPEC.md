# Transparent Overlay Window — Implementation Spec

## Goal

Create a fullscreen transparent always-on-top window that renders recording overlays (click indicators, live annotations, webcam bubble) on the desktop so they are:
1. **Visible to the user** in real-time during recording
2. **Captured by FFmpeg** in the screen recording (since they're real desktop windows)

## Current State (as of this handover)

- **Branch:** `feature/realtime-annotation-and-draggable-bubble-camera`
- **What works:**
  - Screen recording via FFmpeg (region selection, start/stop, timer pill)
  - Webcam baked into recording via FFmpeg `-filter_complex` with circular mask
  - CAM toggle in title bar
  - Mouse hook (`mouse_hook.rs`) captures global clicks via Win32 `SetWindowsHookEx`
  - `ClickIndicator.tsx` and `LiveAnnotationOverlay.tsx` exist and render inside the app — but the app shrinks to a 220x50 pill during recording, so they're not useful
- **What doesn't work:**
  - Transparent overlay window — WebView2 on Windows does NOT support transparent webview backgrounds. Setting `transparent: true` in Tauri config makes the window frame transparent but the webview content remains opaque (black/white). This caused a fullscreen black overlay that blocked the entire screen.

## What Was Attempted

### Attempt 1: Overlay defined in tauri.conf.json
- Added second window in `tauri.conf.json` with `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `visible: false`, `fullscreen: true`
- Separate `public/overlay.html` + `src/overlay/OverlayApp.tsx` + `src/overlay/main.tsx`
- `overlay.rs` commands: `show_overlay` (show + set_ignore_cursor_events), `hide_overlay` (hide), `set_overlay_interactive`
- `recordingStore.ts` calls `show_overlay` on recording start, `hide_overlay` on stop
- **Result:** Overlay window appeared but was OPAQUE BLACK, covering the entire screen. User couldn't close it without Task Manager.
- **Root cause:** `public/overlay.html` wasn't processed by Vite dev server (Vite only serves root `index.html` in dev mode), AND WebView2 doesn't support transparent backgrounds.

### Attempt 2: Dynamic window creation
- Removed overlay from tauri.conf.json
- Created window dynamically via `WebviewWindowBuilder` in Rust with `.transparent(true)`
- **Result:** Same opaque black overlay. Froze the system.

### Attempt 3: Query parameter routing
- Used same `index.html?window=overlay` for both windows
- Dynamic import in `main.tsx` to switch between App and OverlayApp
- **Result:** Main app didn't load properly due to dynamic import issues.

## Original Design Intent

When the user asked to implement this, my approach was:

1. **Create a second Tauri window** — transparent, frameless, always-on-top, fullscreen, click-through
2. This window renders via a separate React app (`OverlayApp.tsx`):
   - **Click ripples** — yellow circles on left click, blue on right click, animated expanding + fading
   - **Live annotations** — press R to draw rectangles, A for arrows, ESC to clear. The overlay becomes interactive (captures mouse) only when a drawing tool is active, otherwise it's click-through
   - **Webcam bubble** — circular draggable webcam feed via `getUserMedia`, resizable via scroll wheel
3. Since the overlay is a real window on the desktop, FFmpeg captures it as part of the screen recording
4. The overlay is created when recording starts, destroyed when recording stops

## Why It Failed

**The fundamental problem is WebView2 (Windows) does not support transparent backgrounds.** Tauri uses WebView2 on Windows. Even with `transparent: true`, the webview renders with an opaque background. This is a known limitation:
- https://github.com/nicehash/NiceHashQuickMiner/issues/489
- https://github.com/nicehash/nicehash-web/issues/1
- Tauri GitHub issues discuss this extensively

## Recommended Approaches for Next Session

### Option A: Native Win32 Layered Window (Best, Most Work)

Don't use a webview at all. Create a native Win32 layered window in Rust using:

```rust
// Create a WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST window
CreateWindowExW(
    WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST,
    ...
)
// Use UpdateLayeredWindow with per-pixel alpha
// Or use SetLayeredWindowAttributes for color-key transparency
```

- Render click indicators and annotations using GDI+ or Direct2D
- This is a pure Rust implementation, no webview involved
- The window is genuinely transparent and click-through
- FFmpeg captures it since it's a real window

**Pros:** True transparency, proper click-through, captured by FFmpeg
**Cons:** Complex, need to implement rendering in Rust, no React/HTML

### Option B: Separate Non-Tauri Process

Create a small standalone executable (written in Rust or C++) that:
- Creates a Win32 layered window
- Listens for IPC messages from the main Tauri app (via named pipes, localhost socket, or file)
- Renders overlays using GDI+

**Pros:** Completely independent of Tauri/WebView2 limitations
**Cons:** Two processes, IPC complexity

### Option C: WebView2 with Composition APIs

Use Windows.UI.Composition APIs to create a transparent composition surface:
- This requires using the `webview2-com` crate directly instead of Tauri's abstraction
- Set the webview's background to transparent via `put_DefaultBackgroundColor` with alpha=0
- Requires: `controller.DefaultBackgroundColor = Color { A: 0, R: 0, G: 0, B: 0 }`

This might be possible by accessing the underlying WebView2 controller after Tauri creates the window. Research needed:
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/webview2-winrt-apis
- The key API: `ICoreWebView2Controller2::put_DefaultBackgroundColor`

**Pros:** Keep using HTML/React for rendering, simplest if it works
**Cons:** Requires low-level WebView2 API access through Tauri, may not be exposed

### Option D: Use `window-vibrancy` or Tauri's own transparency fix

Tauri v2 uses the `window-vibrancy` crate. Check if there's a way to achieve true transparency:
- `WindowExt::set_background_color` with RGBA(0,0,0,0)
- Some users report success with specific Tauri versions

## Existing Code to Reuse

These files are still in the codebase and work correctly:

| File | Purpose | Status |
|---|---|---|
| `src-tauri/src/commands/mouse_hook.rs` | Win32 global mouse hook, emits click events via Tauri events | Working |
| `src/components/recording/ClickIndicator.tsx` | React component rendering click ripples from mouse-click events | Working (renders in pill) |
| `src/components/recording/LiveAnnotationOverlay.tsx` | React component for drawing rectangles/arrows with R/A/ESC keys | Working (renders in pill) |
| `src/stores/recordingStore.ts` | Starts/stops mouse hook with recording | Working |
| `src/App.tsx` | Renders ClickIndicator + LiveAnnotationOverlay when isRecording | Working |

## OverlayApp Component Design (for reference)

The `OverlayApp.tsx` that was built (and worked for rendering, just not transparency):

- **Click ripples:** Listens to `mouse-click` Tauri event, renders expanding/fading circles at click coordinates
- **Live annotations:** Keyboard listeners for R (rectangle), A (arrow), ESC (clear). When tool active, `pointerEvents: "auto"` on the overlay div to capture mouse for drawing. When no tool, `pointerEvents: "none"` for click-through.
- **Webcam bubble:** `getUserMedia` for camera, circular `<video>` element with `border-radius: 50%`, draggable via mousedown/mousemove/mouseup, resizable via wheel event
- **set_overlay_interactive** Rust command toggles `set_ignore_cursor_events` on the window for drawing vs click-through modes

## Key Constraint

Whatever approach is chosen, the overlay must:
1. Be truly transparent (no background color)
2. Be click-through by default (mouse events pass to windows underneath)
3. Become interactive when a drawing tool is activated
4. Be always-on-top
5. Cover the full screen (or at least the recording region)
6. Be visible to FFmpeg's GDI screen capture
