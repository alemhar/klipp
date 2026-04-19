# Plan 06 — Fix: Pill Buttons Blocked by Active Overlay Tool

> **Status**: ✅ Resolved by Plan 04 on 2026-04-19. The region-sized overlay
> (commit `a55459e`) no longer covers the recording pill's screen area for
> typical recordings, so the overlay's interactive state no longer blocks
> clicks on pill buttons. The only remaining case is when the recording
> region explicitly overlaps the pill position (top-center, y≈10); this
> edge case is acceptable for now.

## Context

**Bug observation**: When a drawing tool (rectangle or arrow) is active on the overlay, the recording pill's toolbar buttons (switch tool, clear, webcam, cycle position, stop recording) can't be clicked. The user can still use keyboard shortcuts (`Ctrl+Shift+R/A/Z/W/E`) but not the visible buttons in the pill.

**Why it happens**: When `activeTool !== "none"`, [OverlayApp.tsx](../../src/overlay/OverlayApp.tsx) calls `invoke("set_overlay_interactive", { interactive: true })` so the overlay can capture mouse events for drawing. Under the hood this calls `set_ignore_cursor_events(false)` on the overlay window. Since the overlay is **fullscreen and always-on-top**, and the recording pill is also always-on-top, the overlay sits above the pill in the z-order (or at best competes for it). When interactive, the overlay eats all clicks — including those aimed at the pill's buttons.

**Why keyboard shortcuts still work**: global shortcuts are registered via Tauri's global-shortcut plugin at the OS level. They don't depend on window focus or z-order.

## Repro

1. Start a region recording.
2. Click the rectangle icon in the pill (or press `Ctrl+Shift+R`) — rectangle tool is now active.
3. Draw a rectangle on the overlay.
4. Try to click the **arrow** icon in the pill — nothing happens. Try to click **stop** — nothing happens.
5. Press `Ctrl+Shift+A` — arrow tool activates via global shortcut. Confirms the pill is blocked but hotkeys work.

## Constraint

The overlay must still be interactive while drawing (otherwise the user can't draw shapes). The pill must still be clickable during drawing (for tool switching and stopping).

## Solution Options

### Option A: On-overlay floating toolbar while drawing (RECOMMENDED)

When a drawing tool is active, hide the pill's tool buttons and show a floating toolbar ON the overlay (which is already interactive). Users click overlay-hosted buttons — no z-order conflict.

**Pros**:
- Cleanest architectural fit: the UI lives on the window that's capturing clicks.
- No polling or coordinate tracking.
- Gives more room for future tool options (color, stroke width).

**Cons**:
- Pill feels less useful while drawing (loses its tool buttons temporarily).
- Need to design a new floating toolbar UI on the overlay.
- Stop button still needs to be reachable — either mirror it on the overlay toolbar, or have the user press a global shortcut (no existing shortcut for stop; would need to add one like `Ctrl+Shift+Q`).

### Option B: Mouse-hook-driven interactivity toggle

Extend the existing Win32 mouse hook to track mouse **movement** (not just clicks). Emit a `mouse-move` event with coordinates. In the overlay, when interactive:
- If cursor enters the pill's screen rect (known: ~top-center, 360×50), call `set_overlay_interactive(false)`.
- When cursor leaves the pill rect, call `set_overlay_interactive(true)`.

The pill rect is computed from `RecordingControls`'s known position (x = `screen.width/2 - 180`, y = 10, w = 360, h = 50). Pass it to the overlay via an event or expand the URL query params.

**Pros**:
- Minimal UI changes — pill stays as-is.
- Generalizes: any window we want to "poke a hole" for can register its rect.

**Cons**:
- Adds a continuous mouse-move event stream (performance — can be throttled).
- Hard-codes knowledge of the pill's position in two places.
- If pill is dragged by the user, rect goes stale unless we re-emit on drag.
- Race conditions: if interactivity toggle lags behind cursor movement, clicks near the edge can be missed.

### Option C: Phase 6 partial fix (region-sized overlay)

After Plan 04 (Phase 6), the overlay is sized to the recording region rather than fullscreen. If the pill is outside the region (almost always true — pill is at top-center, region is user-selected), the overlay no longer covers the pill.

**Pros**:
- Free fix for most recording configurations.
- No extra code needed.

**Cons**:
- Breaks when the region starts at the very top of the screen (pill is at y=10) and the region overlaps the pill area horizontally. In that case we'd need Option A or B anyway.
- Doesn't help today — depends on Plan 04 being done first.

### Option D: Raise pill window above overlay at OS level

Give the pill's Win32 window a topmost priority higher than the overlay. Tauri doesn't expose a z-order priority beyond `always_on_top`, but Win32 has `SetWindowPos(HWND_TOPMOST, ...)`. We could call it on the pill window whenever the overlay becomes interactive.

**Pros**:
- Minimal code — just one Win32 call on transition.

**Cons**:
- `always_on_top` + `SetWindowPos` behavior is unspecified and may not do what we want.
- If we also set the overlay topmost (already the case), we're in an indeterminate state.
- Platform-specific (Windows only).

## Recommended Approach

**Hybrid of A + C**:

1. **Wait for Plan 04 (Phase 6)** to land first. That resolves the bug for most users automatically because the region-sized overlay won't cover the pill.

2. **For the remaining case** (region that overlaps the pill area), implement **Option A**: show a small floating toolbar on the overlay when a drawing tool is active. Buttons: switch tool (R/A), clear, stop recording. The pill's tool buttons are disabled/dimmed while drawing is active to signal the state change.

If Phase 6 doesn't fully resolve it and Option A is too much UI work, fall back to Option B.

## Implementation Sketch (Option A)

### 1. Floating toolbar component on overlay

In [src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx), render a floating toolbar at the top-center when `activeTool !== "none"`:

```tsx
{activeTool !== "none" && (
  <div style={{
    position: "fixed",
    top: 10,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 8,
    background: "rgba(30, 30, 30, 0.95)",
    padding: "6px 12px",
    borderRadius: 24,
    pointerEvents: "auto",
    zIndex: 1001,
  }}>
    <button onClick={() => setActiveTool("rectangle")}>■</button>
    <button onClick={() => setActiveTool("arrow")}>→</button>
    <button onClick={() => { setShapes([]); setDrawing(null); setActiveTool("none"); }}>×</button>
    <button onClick={() => invoke("stop_recording")}>⬛</button>
  </div>
)}
```

The existing tool indicator banner can merge into this toolbar.

### 2. Add stop_recording handler accessible from overlay

The overlay can't directly call `stopRecording` in `recordingStore` (different window). Options:
- Emit an `overlay-request-stop` event; `RecordingControls` (main window) listens and calls `stopRecording()`.
- Or invoke a backend command directly.

### 3. Dim pill buttons during drawing

In [RecordingControls.tsx](../../src/components/recording/RecordingControls.tsx), track `activeTool` state (via listening for `overlay-set-tool` events from overlay). When a tool is active, disable and visually dim the pill's tool/stop buttons.

## Verification

1. Start recording, click rectangle icon in pill — floating toolbar appears on overlay with matching buttons.
2. Click arrow icon in the **floating toolbar** — tool switches to arrow.
3. Click clear in the floating toolbar — shapes clear, tool deactivates, floating toolbar disappears, pill buttons become clickable again.
4. Start recording, activate rectangle, click the stop button in the floating toolbar — recording stops, overlay closes.
5. Test with region that covers the pill area — confirm the floating toolbar is reachable and responsive.

## Dependencies

- **Preferred order**: after Plan 04 (Phase 6) lands. Phase 6 may reduce the severity enough that Option A becomes lower priority.
- If done before Phase 6, the implementation is the same; Phase 6 adaptation later is minimal.

## Files to Modify

- [src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx) — floating toolbar
- [src/components/recording/RecordingControls.tsx](../../src/components/recording/RecordingControls.tsx) — dim buttons while tool active, listen for overlay stop request
- [src-tauri/src/commands/recording.rs](../../src-tauri/src/commands/recording.rs) — potentially a backend event for stop from overlay (or keep in frontend)

## Out of Scope

- Full redesign of the pill (keep its current footprint).
- Stop shortcut (`Ctrl+Shift+Q` or similar) — can be added separately.
- Color/stroke width options in the floating toolbar — future enhancement.

## Commit Message Draft

```
fix: unblock pill buttons while drawing tool is active

Renders a floating toolbar on the overlay (which is already interactive
during drawing) with the same tool buttons as the recording pill.
Dims pill buttons while drawing to signal the state change. Resolves
the issue where active drawing tools blocked all pill button clicks.
```
