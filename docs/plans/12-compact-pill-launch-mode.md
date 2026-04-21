# Plan 12 — Compact Pill-Mode Launch

> **Status**: ✅ Shipped 2026-04-21 on branch `feat/pill-mode-launch`. Implementation diverged from the spec in two notable ways: (1) the Options popover and Mode/Delay dropdowns use **native OS popup menus** (via a Tauri `show_pill_menu` command) instead of DOM-based dropdowns — they paint outside the pill window the way Microsoft Snipping Tool does, with no window resize hack. (2) Post-capture window is sized to fit the captured region + chrome (Snipping Tool behaviour) rather than expanding to a fixed full-window size. The TitleBar in window mode was also re-ordered to match the pill's nav sequence (New → Mode → Delay → Record → Cancel) for cross-mode consistency, with CAM/MIC/SYS/Theme/Settings/Collapse appended after.

## Context

Microsoft Snipping Tool launches as a compact horizontal pill containing only the essentials (New, Mode, Delay, Cancel, Options). It's small, draggable, and stays out of the way of whatever the user is about to capture:

```
┌─────────────────────────────────────────────────────────────┐
│  🆕 New  ▾ Mode  ⏱ Delay  ✕ Cancel      ⋯ Options           │
└─────────────────────────────────────────────────────────────┘
```

Klipp currently launches as a full-size window. That's fine once the user is annotating a capture, but at the *start* of the flow — before any capture exists — it:

- Obstructs the very content the user wants to capture or record.
- Forces the user to first resize/move the app window out of the way.
- Feels heavier than it needs to for "I just want to grab a screenshot".

A compact pill-mode launch would mirror Snipping Tool's pattern and give Klipp a much lighter initial footprint.

## Intended Behavior

We follow the Microsoft Snipping Tool's **launch-state navigation layout** almost verbatim — same button order, same grouping (primary actions on the left, options on the right), same helper-text row beneath. Klipp differs only where it must: an extra **Record** primary action, and **CAM/MIC/SYS** toggles tucked into **Options** (not the main row) since they're pre-recording settings, not launch-time actions.

### Pill contents — design target

Two-row pill, ~560×90 logical px:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ✂ New   ▾ Mode   ⏱ Delay   ⏺ Record   ✕ Cancel        ⋯ Options  ⤢  │
│  Select the snip mode using the Mode button or click the New button. │
└──────────────────────────────────────────────────────────────────────┘
```

**Row 1 — actions (Snipping Tool pattern):**

| Button | Behavior | Notes |
|---|---|---|
| **✂ New** | Triggers screenshot in the currently selected Mode | Primary action; accent color |
| **▾ Mode** | Dropdown: Selection / Fullscreen / Window | Same component as today's title-bar dropdown |
| **⏱ Delay** | Dropdown: None / 3s / 5s / 10s | Already exists in Klipp title bar |
| **⏺ Record** | Triggers screen recording in the selected Mode | Klipp-specific; red accent when idle, matches existing Record UX |
| **✕ Cancel** | Cancels in-progress capture/recording | Disabled when idle (greyed) — mirrors Snipping Tool |
| **⋯ Options** | Popover menu — see below | Right-aligned |
| **⤢ Expand** | Switches to full window (annotation canvas) | Right-aligned |

**Row 2 — helper text** (context-aware):

- Idle: *"Select the snip mode using the Mode button or click the New button."*
- During region selection: *"Drag to select the area you want to capture."*
- During recording: *"Recording in progress — press Ctrl+Shift+S to stop."*

**Options popover** contents (`⋯`):

- **Audio sources** (header)
  - ☐ Microphone
  - ☐ System audio
- **Webcam** (header)
  - ☐ Enable webcam overlay
- **Preferences…** (opens Settings in full window)
- **Quit**

This keeps the primary bar clean and Snipping-Tool-like, while preserving every Klipp capability behind a single extra click.

### Flow

1. **On launch**, Klipp opens as the pill above.
2. The pill is **frameless, draggable** (via `data-tauri-drag-region`), and can be positioned anywhere.
3. When the user triggers a capture (**New** / **Record**), the normal flow runs. Pill remains behind the overlay.
4. **After a screenshot is captured**, the window auto-**expands** to full size so the user can annotate on the canvas.
5. **When recording stops**, the window returns to whichever mode it was in pre-recording (pill or full).
6. The user can manually **collapse back to pill mode** via a ⤡ button in the title bar.
7. The **last window state** (pill vs full, position, size) is persisted so re-launching remembers the user's preference.

## Current State

### Window initialization: [src-tauri/tauri.conf.json](../../src-tauri/tauri.conf.json)
The main window currently opens at a default size suitable for the annotation canvas. Nothing special about launch-state handling today — just one size, `decorations: false`, custom title bar.

### Title bar: [src/components/layout/TitleBar.tsx](../../src/components/layout/TitleBar.tsx)
Contains the capture-mode dropdown, CAM/MIC/SYS buttons, and Record button — all of which need to be surfaced in pill mode too. The pill is effectively a **stripped-down variant of the title bar**, not a new set of controls.

### Existing pill precedent: [src/components/recording/RecordingControls.tsx](../../src/components/recording/RecordingControls.tsx)
Klipp already transitions to a **400×50** pill during recording (lines 25–34: `setAlwaysOnTop(true)`, `setSize({ width: 400, height: 50 })`, repositions to top-center). The recording-pill plumbing can be generalized for a launch-time pill — same Tauri APIs, different control set.

### Existing window-state save/restore: [src/stores/recordingStore.ts:107–121](../../src/stores/recordingStore.ts#L107)
`saveWindowState()` already captures inner size + outer position + DPI scale for the recording-pill transition. The same pattern applies for pill ↔ full toggles.

## Implementation Steps

### 1. Decide initial window size & state

Add a boolean preference `launchInPillMode` (default **`true`** for new users) persisted via `tauri-plugin-store` or a small JSON file in `app_data_dir`. On launch:

- Read the stored preference + last window bounds.
- If pill mode: `setSize({ width: 560, height: 90 })`, position near the screen edge (top-center is a reasonable default).
- If full mode: restore the last full-size bounds.

Configure `tauri.conf.json` to start hidden (`"visible": false`), then show the window after the size/position has been applied to avoid a flash.

### 2. Create `PillModeBar.tsx`

New component at `src/components/layout/PillModeBar.tsx`. Two rows:

**Row 1 (actions bar, ~56 px tall):**
- `<div data-tauri-drag-region>` wrapping the whole row (draggable from any non-button area).
- `✂ New` button — triggers screenshot in the selected Mode (accent color).
- `▾ Mode` dropdown — Selection / Fullscreen / Window (reuse existing component + store).
- `⏱ Delay` dropdown — None / 3s / 5s / 10s (reuse existing delay state).
- `⏺ Record` button — starts recording (reuse `useRecordingStore().startRecording`).
- `✕ Cancel` button — disabled when idle, active during an in-flight capture/recording.
- Right side: `⋯ Options` popover button + `⤢ Expand` button.

**Row 2 (helper text, ~28 px tall):**
- Context-aware instruction line that reacts to app state (idle / selecting / recording).

**Options popover** (triggered by `⋯`):
- `☐ Microphone`, `☐ System audio` — same state hooks as today's title-bar toggles (no duplicate stores).
- `☐ Enable webcam overlay` — same.
- `Preferences…` — opens Settings in full window (implies `expandToFull()`).
- `Quit` — exits app.

Visual style: flat, minimal, matches the existing recording-pill aesthetic. No title, no OS chrome. Total height ~90 px.

### 3. Wire the pill↔full toggle

Add a `useWindowModeStore` (Zustand) with state `"pill" | "full"` and actions `expandToFull()`, `collapseToPill()`. Each action:

- Saves the current window bounds (so returning to this mode restores position).
- Calls `setSize` / `setPosition` via `getCurrentWindow()`.
- Persists the new mode to the preference store.

Render conditionally in `App.tsx`:
```tsx
{mode === "pill" ? <PillModeBar /> : <TitleBar /* + canvas + panels */ />}
```

### 4. Auto-expand after a capture

After a screenshot is taken (capture flow resolves with image data), if `mode === "pill"`, call `expandToFull()` so the user lands on the annotation canvas. Already happens implicitly today because the app is always full-size; in pill mode it needs to be explicit.

Recording does **not** auto-expand — the recording-pill overlay takes over, and when recording stops the window should return to whatever mode it was in (pill or full).

### 5. Persist preference across launches

Use `tauri-plugin-store` (or a simple JSON file at `{app_data_dir}/preferences.json`). Keys:

```json
{
  "launchMode": "pill",
  "pillBounds": { "x": 680, "y": 10, "width": 560, "height": 90 },
  "fullBounds": { "x": 200, "y": 100, "width": 1200, "height": 800 }
}
```

Read on startup in the Rust `setup` hook; apply before the window is shown.

## Verification

- [ ] Fresh install → Klipp launches as a compact ~560×90 pill near top of screen, two rows visible (actions + helper text).
- [ ] Button order matches Snipping Tool: **New → Mode → Delay → Record → Cancel**, with **Options + Expand** right-aligned.
- [ ] Helper text updates based on state (idle / selecting / recording).
- [ ] Pill is draggable from any non-button area.
- [ ] `✂ New` triggers a screenshot in the selected Mode.
- [ ] `⏺ Record` starts a recording; `✕ Cancel` becomes active during the flow.
- [ ] `⋯ Options` popover contains Microphone / System audio / Webcam toggles + Preferences + Quit.
- [ ] Taking a screenshot auto-expands to the full annotation canvas.
- [ ] When recording stops, window returns to whichever mode was active pre-recording.
- [ ] Clicking ⤡ in the full title bar collapses back to pill mode.
- [ ] Close and re-open the app → it launches in the last-used mode, at the last-used position.
- [ ] Pill content is not obscured by Windows taskbar / multi-monitor edge cases.

## Out of Scope

- **Custom Snipping-Tool-style "Delay" picker** — Klipp already has a capture delay in the title bar; not re-designed here.
- **Tray-only mode** (app lives entirely in the system tray, no pill on screen) — separate plan if ever wanted.
- **Transparent / floating ghost pill** (opacity on hover, stronger on drag) — visual polish, not blocking.

## Files to Modify (when implemented)

- [src-tauri/tauri.conf.json](../../src-tauri/tauri.conf.json) — initial window size, `visible: false` until mode applied.
- [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs) — read preference file in `setup`, apply size before `show()`.
- `src/components/layout/PillModeBar.tsx` — **new** pill component.
- `src/stores/windowModeStore.ts` — **new** Zustand store for pill/full toggle + bounds persistence.
- [src/components/layout/TitleBar.tsx](../../src/components/layout/TitleBar.tsx) — add a collapse button.
- [src/App.tsx](../../src/App.tsx) — conditional render based on `mode`.
- `src/services/preferences.ts` — **new** wrapper over `tauri-plugin-store`.

## Dependencies

- **Optional**: add `tauri-plugin-store` if not already present (clean way to persist preferences). Could also be done with a hand-rolled JSON file + `serde`.
- No dependency on other pending plans.

## Reference

Screenshot of the Microsoft Snipping Tool launch state (the UX we're matching):

> 🆕 New — ▾ Mode — ⏱ Delay — ✕ Cancel — ⋯ Options
> "Select the snip mode using the Mode button or click the New button."
