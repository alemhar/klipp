# Plan 11 — WebView2 Camera & Microphone Permission Intercept

> **Status**: ✅ Completed 2026-04-23 — feat/pill-mode-launch. Phase 2 shipped: WebView2's `PermissionRequested` event is intercepted on the Rust side and authorized against a Klipp-owned consent state. Users see a branded in-app consent modal instead of the Chromium "localhost wants to use your camera/microphone" prompt. Consent decisions persist to `settings.json` and can be reset from the recovery modal's "Allow it now" button.

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

## Shipped Phase 2 — native intercept (what actually landed)

Chose **frontend-driven consent, Rust-side suppression** over a COM-dispatched native dialog:

- React owns the consent UX. A new `PermissionConsentModal` (Klipp-branded, icon + device-specific copy + Allow / Don't allow) is shown via the `useDeviceConsent(device)` hook before any `getUserMedia` call.
- Rust owns authorization. A `ConsentState` in-memory cache is seeded from `settings.json` at boot and mirrored by the `set_device_consent` command. The WebView2 `PermissionRequested` handler reads that cache and replies with `COREWEBVIEW2_PERMISSION_STATE_ALLOW` only when stored consent is `"allowed"`; `"unknown"` and `"denied"` both map to `DENY`. This is defense-in-depth — a React bug cannot grant silent access.
- Consent persists in `settings.json` (`camera_consent`, `microphone_consent`). Mis-click recovery goes through the recovery modal's **"Allow it now"** button, which resets stored consent to `"unknown"` and immediately re-opens the consent modal.
- The handler is attached to both WebView2 instances that can call `getUserMedia`: the main window (for `AudioLevelIndicator`) and the overlay window (for the webcam bubble in `OverlayApp`).

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
