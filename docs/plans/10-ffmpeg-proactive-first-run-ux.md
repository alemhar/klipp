# Plan 10 — Proactive FFmpeg First-Run UX

> **Status**: 🚧 Future release. A lightweight version of this UX ("loading spinner on Record button + auto-proceed after install") already shipped; see the commit for [ux/ffmpeg-first-run](../plans/README.md). This plan covers the next iteration: proactively prompting for the download on startup so the user never hits a mid-workflow stall.

## Context

FFmpeg isn't bundled with Klipp (LGPL/GPL compliance) and has to be downloaded on demand. The current flow after the shipped minimal fix is:

1. User clicks **Record**.
2. Klipp confirms they want to install FFmpeg (~30MB).
3. User clicks OK → button shows a spinner.
4. Download completes (~30s).
5. Klipp automatically proceeds to the region selector.

It works, but it still stalls the user's first recording workflow by ~30 seconds. A better UX is to detect the missing dependency on app startup and prompt for the install *before* the user needs it — so their first click on Record is instant.

## Proposed Behavior

1. On app startup, silently `check_ffmpeg` (already done via `recordingStore.checkFfmpeg()`).
2. If missing, show a **dismissible banner** at the top of the main window (below the title bar):
   > Screen recording requires FFmpeg (~30MB). **[Install now]** [Later]
3. Clicking **Install now**:
   - Banner shows a progress bar (needs backend changes — see below).
   - On success, banner turns green: "FFmpeg installed — screen recording ready." Auto-dismisses after a few seconds.
   - On failure, banner stays red with an error + retry button.
4. Clicking **Later** dismisses the banner for the session. Record button still shows the existing minimal-fix flow.
5. Banner doesn't reappear during the same session once dismissed; shows again on next launch if FFmpeg is still missing.

## Nice-to-have: download progress

Currently `download_ffmpeg` in `src-tauri/src/commands/ffmpeg.rs` runs synchronously with no progress reporting. For a progress bar, Rust should emit `"ffmpeg-download-progress"` events with `{ bytesDownloaded, totalBytes }` periodically.

The frontend listens and renders a progress bar in the banner. Without this, the banner can still show an indeterminate spinner — same as the current minimal fix.

## Implementation Sketch

### 1. Frontend: install banner component

`src/components/layout/FfmpegInstallBanner.tsx` — new component that:
- Renders only when `hasFfmpeg === false` and not dismissed for the session.
- Has [Install now] / [Later] buttons.
- On Install: invokes `download_ffmpeg`, listens for progress events, updates bar.
- On success: green state, auto-dismiss.
- On failure: red state with retry.

Rendered in `src/App.tsx` above the `<TitleBar />`.

### 2. Recording store: dismissal state

Add to `recordingStore.ts`:
```ts
ffmpegPromptDismissed: boolean;
dismissFfmpegPrompt: () => void;
```
Dismissal is in-memory only (session-scoped); next launch checks fresh.

### 3. Backend: progress events (optional but recommended)

`src-tauri/src/commands/ffmpeg.rs` `download_ffmpeg`:
- Stream the HTTP response and emit periodic `ffmpeg-download-progress` events with `{ downloaded, total }`.
- Tauri `AppHandle::emit` is the standard way.

## Verification

- [ ] Fresh install, FFmpeg missing: banner appears on launch.
- [ ] Click Install now → banner shows progress, then success state.
- [ ] After install, Record button immediately starts region selector (no prompt, no spinner).
- [ ] Click Later → banner dismisses. Record still prompts as before (shipped minimal fix).
- [ ] Restart app before installing → banner reappears.
- [ ] FFmpeg already present at startup → no banner.
- [ ] Install fails (simulated network error) → banner shows red with retry.

## Dependencies

- Independent from other plans. Can be implemented anytime.
- The shipped minimal fix (spinner on record button, auto-proceed, toast instead of blocking alert) is sufficient; this plan is purely polish.

## Files to Modify

- `src/App.tsx` — mount the banner above `TitleBar`.
- `src/components/layout/FfmpegInstallBanner.tsx` — new.
- `src/stores/recordingStore.ts` — dismissal state.
- `src-tauri/src/commands/ffmpeg.rs` — optional progress emission.

## Out of Scope

- Bundling FFmpeg with Klipp — excluded due to licensing.
- Silent automatic download on first launch with no prompt — user consent matters; we always ask.
