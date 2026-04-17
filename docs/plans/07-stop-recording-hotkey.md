# Plan 07 — Context-Aware `Ctrl+Shift+S` (Screenshot / Stop Recording)

> **Status**: ✅ Completed 2026-04-17 — commit `040624a`

## Context

The `captureShortcut` (default `Ctrl+Shift+S`) currently only triggers screenshot capture, and it's registered globally the whole time settings are loaded — even during recording. This has two problems:

1. **No keyboard way to stop a recording.** The Stop button is in the pill; [Plan 06's bug](./06-pill-buttons-blocked-by-overlay.md) makes it unclickable while a drawing tool is active.
2. **`Ctrl+Shift+S` leaks into recording mode.** Pressing it during a recording triggers screenshot region-selection over the active recording — almost never what the user wants.

**Solution**: make `Ctrl+Shift+S` context-aware.
- **Not recording** → screenshot capture (current behavior preserved).
- **Recording** → stop recording.

One shortcut, state-dependent action. Solves both problems with no new keybinding to memorize.

## Rationale

- Users already know `Ctrl+Shift+S` from the tray menu and title bar.
- Mental model: "the capture/end key" — if I'm capturing nothing, start; if I'm capturing (recording), end.
- No keybinding collision since screenshot capture and recording are mutually exclusive states.

**Risk**: a user who wants to take a screenshot *during* a recording (e.g. to capture a still frame) will instead stop the recording. This is uncommon and we can work around it with a secondary shortcut later if demand surfaces. For now, taking a screenshot during a recording doesn't make sense (the recording pill and overlay would appear in the screenshot).

## Current State

In [src/App.tsx](../../src/App.tsx):

```tsx
// Line 62-68
const handleCaptureShortcut = useCallback(() => {
  if (delay > 0) {
    setIsDelaying(true);
  } else {
    setIsCaptureMode(true);
  }
}, [setIsCaptureMode, delay]);

// Line 71-75 — registered whenever settings are loaded, NOT gated on isRecording
useGlobalShortcut(
  settings.captureShortcut || "Ctrl+Shift+S",
  handleCaptureShortcut,
  isLoaded
);

// Line 79-81 — tray event listener also always active
const unlisten = listen<string>("start-capture", () => {
  handleCaptureShortcut();
});
```

`stopRecording` is on the recording store: `useRecordingStore.getState().stopRecording()`.

In [OverlayApp.tsx](../../src/overlay/OverlayApp.tsx), two stale comments still reference the old `Ctrl+Shift+P` (the original webcam cycle shortcut before we renamed to `E`):

- Line ~89: `// Listen for cycle webcam position events (Ctrl+Shift+P)`
- Line ~153: `// freeform — next Ctrl+Shift+P resets to br`

## Implementation Steps

### 1. Make `handleCaptureShortcut` context-aware in [App.tsx](../../src/App.tsx)

```tsx
import { useRecordingStore } from "./stores/recordingStore";

// ...inside App component:
const { isRecording, stopRecording } = useRecordingStore();

const handleCaptureShortcut = useCallback(() => {
  // If recording, Ctrl+Shift+S stops the recording instead of capturing
  if (isRecording) {
    stopRecording();
    return;
  }
  if (delay > 0) {
    setIsDelaying(true);
  } else {
    setIsCaptureMode(true);
  }
}, [setIsCaptureMode, delay, isRecording, stopRecording]);
```

No change needed to the `useGlobalShortcut` registration itself — it stays gated on `isLoaded` so the shortcut is always active once the app is ready, but the behavior now branches on `isRecording`.

### 2. Apply the same branching to the tray "start-capture" listener

```tsx
const unlisten = listen<string>("start-capture", () => {
  handleCaptureShortcut();  // already uses updated logic — no change if we use handleCaptureShortcut
});
```

Since `handleCaptureShortcut` now handles both cases, the tray path inherits the behavior automatically. Verify the tray "New Snip" menu item still reads reasonably — consider renaming it to something context-neutral, or leaving it since tray is always shown from main window context.

### 3. Update the pill's Stop button tooltip in [RecordingControls.tsx](../../src/components/recording/RecordingControls.tsx)

```tsx
<button onClick={stopRecording} title="Stop Recording (Ctrl+Shift+S)" ...>
```

### 4. Update the tray menu label to reflect dual behavior

In [src-tauri/src/tray.rs](../../src-tauri/src/tray.rs), line 8 currently reads:

```rust
let new_snip = MenuItem::with_id(app, "new_snip", "New Snip (Ctrl+Shift+S)", true, None::<&str>)?;
```

Leave this as-is (tray menu won't be used during recording anyway since the main window is in pill mode and the tray is less discoverable in that state). Optionally, dynamically update the label based on recording state — but that's extra complexity for marginal UX gain. **Skip for this plan.**

### 5. Fix stale `Ctrl+Shift+P` comments in [OverlayApp.tsx](../../src/overlay/OverlayApp.tsx)

- Line ~89: `// Listen for cycle webcam position events (Ctrl+Shift+P)` → `Ctrl+Shift+E`
- Line ~153: `// freeform — next Ctrl+Shift+P resets to br` → `Ctrl+Shift+E`

## Verification

1. **Screenshot flow (not recording)**: press `Ctrl+Shift+S` — region selector opens for screenshot. Confirms existing behavior preserved.
2. **Start a region recording.** While recording is active, press `Ctrl+Shift+S` — recording stops, pill disappears, main window restores. Confirms the toggle direction.
3. **During recording with active drawing tool**: start recording, press `Ctrl+Shift+R` to activate rectangle, draw a shape, then press `Ctrl+Shift+S` — recording should stop (confirms the shortcut bypasses the [Plan 06](./06-pill-buttons-blocked-by-overlay.md) pill-button-blocking bug).
4. **Back to screenshot after stop**: after stopping via `Ctrl+Shift+S`, press `Ctrl+Shift+S` again — region selector opens (confirms we're back in screenshot mode).
5. **Settings-altered capture shortcut**: if the user has changed `settings.captureShortcut` to something else (e.g. `Ctrl+Alt+P`), verify the same context-aware behavior applies to that custom shortcut.
6. **Tooltip**: hover over the pill's Stop button — shows `Stop Recording (Ctrl+Shift+S)`.
7. **Stale comments**: grep for `Ctrl+Shift+P` in `src/` — no matches remain.

## Dependencies

- **None.** Fully independent. Can be implemented anytime.
- Mitigates [Plan 06](./06-pill-buttons-blocked-by-overlay.md) by providing a keyboard escape during drawing.

## Files to Modify

- [src/App.tsx](../../src/App.tsx) — branch `handleCaptureShortcut` on `isRecording`
- [src/components/recording/RecordingControls.tsx](../../src/components/recording/RecordingControls.tsx) — Stop button tooltip
- [src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx) — fix two stale `Ctrl+Shift+P` comments

## Out of Scope

- **Screenshot during recording**: not supported in this plan. If demand arises, a separate shortcut (e.g. `Ctrl+Alt+S`) can be added later.
- **User-configurable stop shortcut**: if the user changes `captureShortcut` in settings, the stop behavior follows automatically (same key, different action). No separate setting.
- **Dynamic tray menu label**: deferred.

## Commit Message Draft

```
feat: Ctrl+Shift+S toggles between capture and stop-recording

Makes the capture shortcut context-aware: when not recording, it
opens the screenshot region selector (existing behavior); when
recording, it stops the recording.

Solves the latent bug where Ctrl+Shift+S triggered screenshot
region selection over an active recording. Also provides a
keyboard escape for the Plan 06 pill-button-blocking bug.

Updates Stop button tooltip to show the shortcut. Cleans up stale
Ctrl+Shift+P comments left over from the rename to Ctrl+Shift+E.
```
