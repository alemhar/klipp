# Plan 08 — Root-Cause Fix: WebView2 Content Drift on First Interaction

> **Status**: 🚧 Deferred for a future release. Current workaround: `OUTLINE_PAD = 10` in [overlay.rs](../../src-tauri/src/commands/overlay.rs) gives enough buffer for the drift to stay outside the captured region.

## Context

After Plan 04 shipped, testing revealed a subtle bug: **when a drawing tool is activated and the user clicks the overlay for the first time, the entire WebView2 content drifts ~8 pixels horizontally**. The window position at the OS level does NOT change (confirmed via `outer_position` / `inner_position` logs), so the drift is internal to WebView2's composition surface.

Consequences:
- The region outline, webcam bubble, and click ripples all shift as a group.
- The outline's edge on one side ends up inside the captured region, so it gets baked into the final video.

The workaround in the shipping build: expand the overlay window's outline pad from 2px to 10px on each side (where screen space permits). The outline now sits ~8px outside the recording by default, so even after the 8px drift it remains in the pad area and isn't captured. Visually, the outline frame sits slightly further from the region boundary than optimal.

## Current Workaround (shipped)

[src-tauri/src/commands/overlay.rs](../../src-tauri/src/commands/overlay.rs):
```rust
const OUTLINE_PAD: i32 = 10;
```

The frontend uses `pad.left + region.width + pad.right` to size the outline div, so the change is automatic end-to-end.

## What We Tried That Didn't Work

### 1. WS_THICKFRAME strip
Removed `WS_THICKFRAME` from the window's base style via `SetWindowLongPtrW` + `SetWindowPos(SWP_FRAMECHANGED)`. Theory: frameless Tauri windows still have an 8px resize border inherited from the thick frame. Logs after strip:
```
before strip_thick_frame: outer=(130,130) inner=(138,130)
after  strip_thick_frame: outer=(130,130) inner=(138,130)  ← unchanged
```
The offset persists — it comes from somewhere other than `WS_THICKFRAME`.

### 2. WndProc subclass with WM_NCCALCSIZE interception
Replaced the window's `WndProc` via `SetWindowLongPtrW(hwnd, GWLP_WNDPROC, ...)`, returning `0` for `WM_NCCALCSIZE` so the client area equals the window area (no chrome).

**Caused the app to hang** because the implementation used `Mutex<Option<isize>>` for the original WndProc pointer, and the hot-path message handler locked that mutex on every single Windows message — thousands per second. Stashed as `stash@{0}` on this investigation branch.

### 3. Re-apply transparency on interactive toggle
Added `apply_webview_transparency()` call after `set_click_through_preserving_layered` to force WebView2 back to transparent. No effect on the drift (drift happens on click, not on tool activation, so re-applying during activation doesn't prevent it).

## Root-Cause Hypotheses (to investigate later)

1. **WebView2 composition surface remapping**: On first mouse interaction, WebView2 may switch its composition surface between window-outer and window-inner coordinate frames, triggering the 8px shift.

2. **DWM frame margin**: Modern Windows always reserves invisible DWM margins around frameless windows for composition. These margins exist regardless of `WS_THICKFRAME`. Only subclassing `WM_NCCALCSIZE` eliminates them.

3. **Focus activation redraw**: When the overlay receives its first mouse event that isn't click-through, Windows promotes it to active status, which may trigger a full frame recomposition with different pixel alignment.

## Proposed Fix Approaches

### Option A: Safer WndProc subclass (high confidence)
Same concept as attempt #2, but use `AtomicIsize` / `AtomicPtr` instead of a Mutex so the hot-path handler is lock-free.

```rust
static ORIGINAL_WNDPROC: AtomicIsize = AtomicIsize::new(0);

unsafe extern "system" fn overlay_wnd_proc(
    hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM
) -> LRESULT {
    if msg == WM_NCCALCSIZE && wparam.0 != 0 {
        return LRESULT(0);
    }
    let orig = ORIGINAL_WNDPROC.load(Ordering::Acquire);
    if orig == 0 { return LRESULT(0); }
    let proc: WNDPROC = std::mem::transmute(orig);
    CallWindowProcW(proc, hwnd, msg, wparam, lparam)
}
```

**Risks**:
- `WM_NCCALCSIZE` returning 0 may break WebView2's internal rendering assumptions (it expects some margin).
- Other messages forwarded through `CallWindowProcW` might have side effects if wry internally subclasses too (chain-of-subclass conflict).

**Validation plan**:
- Before enabling the subclass, capture a baseline of what messages the current window handles.
- After enabling, check that all normal interactions (keyboard, focus, drag, resize) still work.

### Option B: DWM frame extension
Use `DwmExtendFrameIntoClientArea(hwnd, &MARGINS { -1, -1, -1, -1 })` to push the DWM frame margin into the client area, effectively making chrome 0.

Less invasive than subclassing but may still leave some subtle offset depending on Windows version.

### Option C: Eliminate the overlay's reliance on consistent layout
Instead of depending on overlay window position being pixel-perfect, **render the region outline as a separate tiny Win32 layered window** (per edge, or as a single frame window around the region). Native Win32 windows don't have WebView2's composition quirks.

More code but architecturally cleaner and eliminates the class of bugs entirely.

### Option D: Accept the drift, compensate in React
On the frontend, capture the webview origin at mount and again on first mousedown via a native hook. If it changed, apply a compensating CSS `transform: translate(...)` to counter the drift. Keeps the overlay always visible but relies on a potentially fragile measurement.

## Recommended Path

**Option A** first (safer WndProc subclass). If it causes rendering or event-handling regressions, fall back to **Option B** (DWM extend-into-client). **Option C** only if both A and B fail.

Before shipping any of these, the verification from [04-phase-6-region-sizing-and-dpi.md](./04-phase-6-region-sizing-and-dpi.md) should also be re-checked:
- Transparency stays during drawing tool activation
- Outline no longer captured in recording (even at the edge case where the region touches the screen boundary)
- No hang on window creation or on first user interaction

## Files to Modify (when fix is picked up)

- [src-tauri/src/commands/overlay.rs](../../src-tauri/src/commands/overlay.rs) — add WndProc subclass or DWM extension logic; revert `OUTLINE_PAD = 10` back to `2` once drift is eliminated.

## Success Criteria

- `inner_position` equals `outer_position` (no chrome) at `show_overlay done` log point.
- Clicking on the overlay with a drawing tool active produces no visual shift of the outline, webcam, or ripples.
- Recording after activating a drawing tool does NOT contain the outline in the output video.
- App remains responsive and interactive through all recording scenarios.
