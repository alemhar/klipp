# Plan 11 — WebView2 Camera & Microphone Permission Intercept

> **Status**: 🚧 Future release. The shipping build has a Phase 1 fix that covers BOTH camera and microphone (amber CAM/MIC icons + a generic `PermissionBlockedModal` with device-specific recovery steps). This plan covers the Phase 2 root-cause fix — intercepting WebView2's `PermissionRequested` event on the Rust side so users never see the raw "localhost wants to use your camera/microphone" dialogs.

## Context

Klipp's webcam bubble uses `navigator.mediaDevices.getUserMedia()` to access the camera. In WebView2 (the Chromium runtime Tauri uses on Windows), this triggers a browser-style permission dialog with the origin shown as `http://localhost:1420` in dev or `http://tauri.localhost` in production builds.

Problems with the default WebView2 prompt:
- **Looks like a web permission**, which is surprising in a desktop app.
- **Permission persists per origin** — if the user clicks Block once, WebView2 remembers it and `getUserMedia` silently fails forever until the cache is manually cleared.
- **No in-app recovery UI** (WebView2 doesn't expose a permission manager).

## Shipped Phase 1 workaround

- `useCameraPermission()` hook polls `navigator.permissions.query({ name: "camera" })`.
- CAM button in title bar turns amber + changes tooltip when state is `denied`.
- Clicking CAM while denied opens `CameraBlockedModal` with recovery instructions (Windows settings + WebView2 cache clear).
- README documents the flow in the "First run" section.

This helps users escape but still exposes them to the raw dialog the first time.

## Proposed Phase 2 — native intercept

Handle WebView2's `PermissionRequested` event on the Rust side via Tauri's `with_webview()` to:
1. **Show our own styled dialog** instead of the Chromium one. The dialog can say "Klipp wants to use your webcam for the recording bubble. [Allow] [Block]".
2. **Control persistence ourselves** — so a Block decision doesn't dead-end. Next time the user toggles CAM, we show our dialog again unless they explicitly checked "remember this".
3. **Keep state in-app** — so Settings → Camera Permission can show the current state and let the user reset from inside Klipp.

## Implementation Sketch

### Rust — wire up PermissionRequested handler

In `src-tauri/src/commands/overlay.rs` (or a new `src-tauri/src/commands/permissions.rs`):

```rust
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2PermissionRequestedEventArgs, ICoreWebView2_4, COREWEBVIEW2_PERMISSION_KIND_CAMERA,
    COREWEBVIEW2_PERMISSION_STATE_ALLOW, COREWEBVIEW2_PERMISSION_STATE_DENY,
};

// Inside show_overlay, after with_webview transparency call:
overlay.with_webview(|webview| unsafe {
    use windows::core::Interface;
    let core: ICoreWebView2_4 = webview.controller().CoreWebView2()?.cast()?;
    let mut token = 0;
    core.add_PermissionRequested(
        &PermissionRequestedHandler::new(|_sender, args| {
            let mut kind = 0;
            args.PermissionKind(&mut kind)?;
            if kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA.0 {
                // Defer to Rust-side state / show our own dialog.
                // For now: always allow (can be refined).
                args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
                args.SetHandled(true)?;
            }
            Ok(())
        }),
        &mut token,
    )?;
})?;
```

### Frontend — remove the permissions API polling

Once the intercept always allows (or routes to our UI), `useCameraPermission()` becomes optional. The CAM button can instead show a state managed entirely by our app:
- `ALLOWED` — webcam usable
- `PENDING` — user clicked CAM, we're asking them via our own dialog
- `DENIED` — user said no in our dialog; next click re-opens the dialog

### UX options

A. **Always allow at the WebView2 level, gate in-app**
   - WebView2 never blocks. Our own app decides whether to call `getUserMedia` based on our in-app permission state.
   - Cleanest — never see the WebView2 dialog.
   - Need to persist our state (settings file).

B. **Native dialog in-app**
   - WebView2 defers to our handler, which shows a Tauri dialog via `tauri-plugin-dialog`.
   - User's choice is remembered in our own settings.
   - Most flexible, slightly more code.

## Verification

- [ ] First launch + CAM toggle: Klipp shows our dialog, not WebView2's.
- [ ] User clicks Allow: webcam works. Next CAM toggle doesn't re-prompt.
- [ ] User clicks Block: webcam silently doesn't show. Next CAM toggle re-prompts (or shows a "camera blocked, reset here" UI).
- [ ] Production build (non-dev origin) behaves the same as dev.
- [ ] Clearing WebView2 cache does NOT reset our app-level permission (we control it now).

## Files to Modify

- `src-tauri/src/commands/overlay.rs` or new `permissions.rs` — PermissionRequested handler.
- `src-tauri/Cargo.toml` — may need additional `webview2-com` features.
- `src/hooks/useCameraPermission.ts` — can be simplified/removed once in-app state takes over.
- `src/components/recording/CameraBlockedModal.tsx` — can be replaced with the native dialog, or kept as fallback.
- Settings panel — new "Permissions" section for resetting in-app permission state.

## Dependencies

- Independent from other plans.
- Phase 1 (shipped) is a valid standalone UX improvement; Phase 2 is polish on top.

## Out of Scope

- FFmpeg-level microphone access — that uses DirectShow, not WebView2/`getUserMedia`, so it isn't affected by this intercept. The OS-level Windows microphone permission still needs to be granted for FFmpeg to capture mic audio.
