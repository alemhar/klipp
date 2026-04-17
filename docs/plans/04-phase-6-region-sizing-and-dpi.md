# Plan 04 — Phase 6: Region-Sized Overlay + DPI + Multi-Monitor

## Context

Phase 6 of the overlay feature bundles four tightly-coupled polish items from [docs/OVERLAY-TODO.md](../OVERLAY-TODO.md):

1. **Size overlay to recording region** (not fullscreen)
2. **DPI scaling** — physical-vs-logical pixel translation
3. **Ripple cap + GPU animation**
4. **Multi-monitor support**

They're coupled because changing the overlay from fullscreen to region-sized changes the coordinate system that ripples, webcam positioning, annotations, and the region outline all rely on. Doing them together avoids a broken intermediate state.

This plan also resolves a **latent DPI bug** in the region selector that currently only works correctly at 100% DPI.

**Important**: This is the LAST implementation task because the Good-to-Have plans (01, 02) build features on top of the current fullscreen overlay. This plan revisits and adapts those features to the new coordinate system.

## Current State

### Overlay window creation ([src-tauri/src/commands/overlay.rs](../../src-tauri/src/commands/overlay.rs))

```rust
overlay.set_fullscreen(true).map_err(...)?;  // ← fullscreen
overlay.set_ignore_cursor_events(true)?;
overlay.show()?;
```

### Mouse hook coordinates

`MSLLHOOKSTRUCT.pt.x/y` returns **physical screen pixels**. Emitted as-is to React:

```rust
let event = ClickEvent {
    x: mouse_struct.pt.x,  // physical px
    y: mouse_struct.pt.y,
    button: button.to_string(),
};
```

### React consumption ([src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx))

Uses the hook-emitted coords directly for ripple placement and webcam hit-testing. This only works because the overlay is fullscreen and React also receives events in screen-relative coordinates at 100% DPI.

**At 150% DPI**: hook emits physical (e.g. 1500) but React CSS positions in logical px (1000). Ripples render 1.5x further down-right than the actual cursor.

### Region selector ([src/components/recording/RecordingRegionSelector.tsx](../../src/components/recording/RecordingRegionSelector.tsx))

Reads `e.clientX/Y` (logical px) and passes to `startRecording` config. Config flows to:
- `gdigrab -offset_x/y` in FFmpeg — **wants physical px** (latent bug at non-100% DPI)
- Overlay URL params — React uses them for webcam positioning

### URL params for overlay region

```rust
let url = format!(
    "overlay.html?x={}&y={}&w={}&h={}",
    x.unwrap_or(0), y.unwrap_or(0),
    width.unwrap_or(1920), height.unwrap_or(1080),
);
```

These are passed as-is from `RecordingConfig` (which came from the selector in logical px — the latent bug).

## Design

### New coordinate contract

1. **Overlay window** is positioned and sized to match the recording region exactly, in **physical pixels**. Use Tauri's `PhysicalPosition` and `PhysicalSize`.
2. **Region coordinates in `RecordingConfig`** are physical pixels. This matches FFmpeg's `gdigrab` expectation.
3. **Mouse hook** continues emitting physical screen-relative coords.
4. **React code in OverlayApp** converts hook coords to window-local logical px using:
   ```
   localX = (event.payload.x - region.x) / scaleFactor
   localY = (event.payload.y - region.y) / scaleFactor
   ```
5. **React mouse events** (`e.clientX/Y`) are already window-local logical px — no conversion needed for drawing, webcam drag, etc.
6. **Region selector** captures logical px from `e.clientX/Y` then multiplies by `scaleFactor` before passing to `startRecording`.

## Implementation Steps

### Step 1: Update `show_overlay` in [overlay.rs](../../src-tauri/src/commands/overlay.rs)

Replace the fullscreen call with explicit position+size:

```rust
// Before show(), set position and size to match the region
overlay
    .set_position(tauri::PhysicalPosition::new(
        x.unwrap_or(0),
        y.unwrap_or(0),
    ))
    .map_err(|e: tauri::Error| e.to_string())?;

overlay
    .set_size(tauri::PhysicalSize::new(
        width.unwrap_or(1920) as u32,
        height.unwrap_or(1080) as u32,
    ))
    .map_err(|e: tauri::Error| e.to_string())?;

// DO NOT call set_fullscreen
overlay.set_ignore_cursor_events(true).map_err(...)?;
overlay.show().map_err(...)?;
```

**Verify**: WebView2 transparency still works after the resize. If not, the `with_webview()` COM call may need to be re-applied after the resize.

### Step 2: DPI scaling in [OverlayApp.tsx](../../src/overlay/OverlayApp.tsx)

On mount:
```tsx
import { getCurrentWindow } from "@tauri-apps/api/window";

const [scaleFactor, setScaleFactor] = useState(1);

useEffect(() => {
  getCurrentWindow().scaleFactor().then(setScaleFactor);
}, []);
```

In the `mouse-click` listener:
```tsx
const localX = (event.payload.x - region.x) / scaleFactor;
const localY = (event.payload.y - region.y) / scaleFactor;
// Use localX/localY for ripple positioning and webcam hit-test
```

### Step 3: Adapt webcam positioning

Since the overlay window now IS the region, React uses window-local logical coords. Webcam default and corner positions become (assuming Plan 01 was implemented first):

```tsx
// Region is the window itself; use scaled dimensions in logical px
// 25px margin, 150px bubble (matches Plan 01 constants)
const scaledW = region.width / scaleFactor;
const scaledH = region.height / scaleFactor;
const MARGIN = 25;
const BUBBLE = 150;

const cornerToPos = (corner: Corner) => {
  switch (corner) {
    case "br": return { x: scaledW - BUBBLE - MARGIN, y: scaledH - BUBBLE - MARGIN };
    case "bl": return { x: MARGIN, y: scaledH - BUBBLE - MARGIN };
    case "tl": return { x: MARGIN, y: MARGIN };
    case "tr": return { x: scaledW - BUBBLE - MARGIN, y: MARGIN };
  }
};
```

Webcam drag uses `e.clientX/Y` directly (already logical, window-local) — no change.

### Step 4: Adapt region outline (Plan 02)

The outline now spans the whole window:

```tsx
<div style={{
  position: "absolute",
  inset: 0,
  border: "2px dashed #ef4444",
  boxSizing: "border-box",
  pointerEvents: "none",
  zIndex: 1,
}} />
```

### Step 5: Resolve latent DPI bug in region selector

In [RecordingRegionSelector.tsx](../../src/components/recording/RecordingRegionSelector.tsx) `handleMouseUp`, multiply the logical coords by scale factor:

```tsx
const scaleFactor = await getCurrentWindow().scaleFactor();
const config: RecordingConfig = {
  x: Math.round(startX * scaleFactor),   // physical px for gdigrab
  y: Math.round(startY * scaleFactor),
  width: Math.round(width * scaleFactor),
  height: Math.round(height * scaleFactor),
  // ...
};
```

**Verify**: FFmpeg recordings at 150% DPI now capture the correct region (not offset or cropped).

### Step 6: Ripple cap + GPU polish

In [OverlayApp.tsx](../../src/overlay/OverlayApp.tsx):

```tsx
const MAX_RIPPLES = 10;

setRipples((prev) => [...prev.slice(-(MAX_RIPPLES - 1)), { id, x, y, button }]);
```

Add `willChange: "transform, opacity"` to the ripple div style for GPU layer promotion:

```tsx
style={{
  // ...existing...
  willChange: "transform, opacity",
  animation: "ripple-expand 0.6s ease-out forwards",
}}
```

Verify with Chromium DevTools paint flashing (Rendering panel → "Paint flashing") that ripples don't cause full-frame repaints.

### Step 7: Multi-monitor testing

Test matrix:
| Config | Primary DPI | Secondary DPI | Region placement |
|---|---|---|---|
| Single monitor | 100% | — | center |
| Single monitor hiDPI | 150% | — | center |
| Dual, both 100% | 100% | 100% | on secondary |
| Dual, mixed DPI | 100% | 150% | on secondary (to the right) |
| Dual, mixed DPI, right-to-left | 150% | 100% | on secondary (to the left, negative x) |

For each: verify overlay window appears on the correct monitor, ripples land under the cursor, FFmpeg output matches the visible overlay.

**Key consideration**: `PhysicalPosition` can have negative `x` for monitors to the left of primary. Ensure all Rust integer types used in the pipeline are signed (`i32`, not `u32`) up to the Tauri API boundary.

## Verification

End-to-end scenarios:

1. **100% DPI, single monitor, centered region**:
   - Select a 400×300 region in the center.
   - Overlay window snaps to exactly that rect.
   - Click indicators land under cursor.
   - Rectangle annotation tracks cursor precisely.
   - Webcam bubble sits inside the region; cycling moves between corners within the region.
   - Region outline is a full window border (inset: 0).
   - FFmpeg output matches visible overlay content.

2. **150% DPI**: repeat all of the above, verify no 1.5× offset anywhere.

3. **Multi-monitor with mixed DPI**: select region on secondary monitor at different DPI — overlay appears on correct monitor, sized correctly, all interactions work.

4. **Start/stop cycle**: start recording, stop, start again with a different region. Verify overlay repositions correctly each time.

## Dependencies

This plan is the LAST implementation task. It depends on (and will modify):

- Plan 01 (webcam cycling): webcam corner math changes from `region.x + ...` (screen coords) to `0 + ...` (window-local).
- Plan 02 (region outline): changes from computed coords to `inset: 0`.
- Plan 03 (microphone): independent, no coordinate changes needed.

## Files to Modify

- [src-tauri/src/commands/overlay.rs](../../src-tauri/src/commands/overlay.rs) — replace `set_fullscreen` with `set_position`+`set_size`
- [src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx) — scaleFactor, coord translation, webcam corner math, region outline inset, ripple cap
- [src/components/recording/RecordingRegionSelector.tsx](../../src/components/recording/RecordingRegionSelector.tsx) — multiply by scaleFactor before passing config

## Risks

- **WebView2 transparency + resize**: COM call for `SetDefaultBackgroundColor` was made once after window creation. If `set_size` breaks transparency, re-apply the COM call after resize or find an alternative (e.g., construct window with correct size from the start using `.inner_size()` in the builder).
- **Tauri `set_size` behavior on Windows**: may round to DPI-aware dimensions. Use `PhysicalSize` explicitly and verify the applied size matches the request.
- **Negative coords for secondary monitors**: ensure all Rust types are signed.
- **Dev server URL**: in dev mode, the overlay loads from `http://localhost:1420/overlay.html?x=...` — no change needed, but verify URL params still arrive after the window resizes.

## Out of Scope

- **Dynamic region change during recording** (user resizes region mid-recording).
- **Per-monitor color correction** (HDR/SDR handling).

## Commit Message Draft

```
feat(phase-6): region-sized overlay with DPI-aware coordinates

Replaces fullscreen overlay with region-sized window positioned at
recording region coordinates. Adds scaleFactor lookup and translates
physical mouse-hook coords to window-local logical coords. Fixes
latent DPI bug in region selector where gdigrab received logical
instead of physical pixels. Caps ripples at 10 with GPU layer hint.
Tested on multi-monitor with mixed DPI.
```
