# Plan 09 — Window Capture Mode

> **Status**: 🚧 Future release. The UI currently exposes a "Window" option in the capture-mode dropdown but clicking it does nothing useful.

## Context

The title bar's capture-mode dropdown shows three options: **Rectangle**, **Fullscreen**, **Window**. The type definition in [src/types/capture.ts](../../src/types/capture.ts) declares a fourth mode, `"freeform"`, that isn't exposed in the UI.

Of the three visible options:
- **Rectangle** ✅ — user drags a selection rectangle, app captures that area.
- **Fullscreen** ✅ — captures the entire screen immediately.
- **Window** ❌ — **non-functional**. Selecting it shows the capture overlay but the mouse handlers early-return in [CaptureOverlay.tsx:123](../../src/components/capture/CaptureOverlay.tsx#L123) (`if (mode !== "rectangular") return;`). The user has no way to complete the capture except to press Escape.

This plan describes what "Window mode" should do and how to implement it.

## Intended Behavior

Mimics the Windows Snipping Tool's "Window Snip":

1. User opens capture mode with **Window** selected.
2. The capture overlay shows a screenshot of the desktop (as it does for Rectangle mode).
3. As the user moves the mouse, the top-level window **under the cursor** is highlighted with a colored outline.
4. On click, the app captures the rectangular bounds of that window and exits capture mode.
5. Pressing Escape cancels without capturing.

Good to have (could be added later):
- Filter to only highlight windows on the current monitor.
- Exclude SnippingZo's own capture overlay from the window list (it's fullscreen and would always be "the window under cursor").
- Visual feedback for child vs top-level windows (usually we only want top-level).

## Current State

### Frontend: [src/components/capture/CaptureOverlay.tsx](../../src/components/capture/CaptureOverlay.tsx)
- Shows the overlay for rectangular and window modes (line 86).
- Mouse handlers early-return for non-rectangular modes (line 123).
- No highlight overlay, no click-to-capture for window mode.

### Backend: [src-tauri/src/commands/capture.rs](../../src-tauri/src/commands/capture.rs)
- Has commands for `capture_fullscreen`, `capture_fullscreen_fast`, `capture_region`, `crop_image`.
- No command for enumerating windows or capturing by window handle.

### Types: [src/types/capture.ts](../../src/types/capture.ts)
```ts
export type CaptureMode = "rectangular" | "freeform" | "window" | "fullscreen";
```
`"freeform"` is declared but not used anywhere in the UI or capture flow. It can be ignored or removed in this plan (see "Out of Scope").

## Implementation Steps

### 1. New Rust command: `list_top_level_windows`

Returns a list of visible, top-level windows with their bounds and titles.

```rust
#[tauri::command]
pub fn list_top_level_windows() -> Result<Vec<WindowInfo>, String> {
    // Use Win32 EnumWindows with a callback that:
    //   - checks IsWindowVisible(hwnd)
    //   - skips windows without a title or with WS_EX_TOOLWINDOW
    //   - excludes our own overlay window by HWND comparison
    //   - gets bounds via DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)
    //     (preferred over GetWindowRect, which includes shadow)
    // Returns Vec<WindowInfo { hwnd: i64, title: String, x, y, w, h }>
}
```

Exclude the SnippingZo overlay: store its HWND in a `Mutex<Option<isize>>` when `show_overlay` runs (or look up by window label via Tauri's `get_webview_window("overlay").hwnd()`).

### 2. New Rust command: `capture_window_bounds`

Takes bounds from the frontend (after the user clicked a window) and captures that region. Could be a thin wrapper over the existing `capture_region` with the window's bounds.

### 3. Frontend: window overlay behavior

In [CaptureOverlay.tsx](../../src/components/capture/CaptureOverlay.tsx):
- When `mode === "window"`, on mount call `invoke("list_top_level_windows")` to get the list.
- On `onMouseMove`, find which window's bounds contain the cursor (`e.clientX, e.clientY`).
  - Prefer the window with the smallest area containing the point (accounts for z-order only approximately; the list is already in top-to-bottom z-order from `EnumWindows`, so the first match is on top).
- Render a highlight div (semi-transparent colored fill + solid border) at the found window's bounds.
- On click, call `capture_region` with those bounds and finish capture.

### 4. UI visual polish

Highlight style suggestions:
- `background: "rgba(59, 130, 246, 0.2)"` (tailwind blue-500 at 20%)
- `border: "2px solid #3b82f6"` (blue-500)
- Show the window title near the cursor as a small tooltip.

## Verification

- [ ] Open capture in Window mode → overlay appears with screenshot.
- [ ] Move cursor over different windows → highlight follows, outlines visible window bounds.
- [ ] Click a window → capture that window's bounds, not including the shadow.
- [ ] Click on empty desktop → no highlight, no capture (or capture the desktop as fallback — decide during implementation).
- [ ] SnippingZo's own main window doesn't appear as a target while in capture mode.
- [ ] Multi-monitor: highlighting works for windows on secondary monitors too.

## Out of Scope

- **Freeform mode**: the `"freeform"` type variant is currently dead code. It could be implemented separately (drag path to select) or deleted. Not addressed by this plan.
- **Per-element snip**: e.g. capturing a single toolbar or button inside a window. Out of scope; window-level is enough.

## Files to Modify (when implemented)

- [src-tauri/src/commands/capture.rs](../../src-tauri/src/commands/capture.rs) — new commands for enumeration + capture.
- [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs) — register commands.
- [src/components/capture/CaptureOverlay.tsx](../../src/components/capture/CaptureOverlay.tsx) — window-mode handlers + highlight UI.
- [src/types/capture.ts](../../src/types/capture.ts) — add `WindowInfo` interface; consider removing or implementing `"freeform"`.

## Dependencies

None. Can be picked up after the drift root-cause fix (Plan 08) or independently.
