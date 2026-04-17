# Plan 01 — Webcam Position Cycling Hotkey

## Context

The overlay has a draggable circular webcam bubble that defaults to the bottom-right of the recording region. Users want a keyboard shortcut to quickly snap the webcam to one of the four corners of the recording region without manual dragging.

**Trigger**: `Ctrl+Shift+E` global shortcut (registered only while recording).

**Cycle order**: Bottom-right (default) → Bottom-left → Top-left → Top-right → back to Bottom-right.

**Constants**: 25px margin from region edges (matches current default); bubble is 150px diameter (already set).

## Current State

The overlay is currently **fullscreen**. Region coordinates are passed via URL query params (`?x=...&y=...&w=...&h=...`). The webcam default position is computed in screen coordinates and sits **25px from the right/bottom edges** of the region (bubble top-left at `region.x + region.width - 175`; bubble is 150px wide, so right edge = `region.x + region.width - 25`):

```tsx
// src/overlay/OverlayApp.tsx:39-42 (current default)
const [webcamPos, setWebcamPos] = useState({
  x: region.x + region.width - 175,
  y: region.y + region.height - 175,
});
```

Manual drag already works via a mouse-hook click detection path (overlay is click-through, so OS-level mouse events start the drag and document-level mousemove/mouseup handle the rest).

Global shortcuts for other tools are registered in `src/components/recording/RecordingControls.tsx`:

```tsx
const handleRectangle = useCallback(() => emit("overlay-set-tool", "rectangle"), []);
useGlobalShortcut("Ctrl+Shift+R", handleRectangle, isRecording);
// ...Ctrl+Shift+A, Ctrl+Shift+Z, Ctrl+Shift+W already registered
```

The overlay listens for these emitted events:

```tsx
// src/overlay/OverlayApp.tsx
const unlistenTool = listen<string>("overlay-set-tool", (event) => { ... });
```

## Implementation Steps

### 1. Update [src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx)

Add a `webcamCorner` state that drives the position. Manual drag clears it to `null` (freeform).

```tsx
type Corner = "br" | "bl" | "tl" | "tr";

const [webcamCorner, setWebcamCorner] = useState<Corner | null>("br");

// Derive position from corner (25px margin, 150px bubble — matches current default)
const MARGIN = 25;
const BUBBLE = 150;
const cornerToPos = (corner: Corner) => {
  switch (corner) {
    case "br": return { x: region.x + region.width - BUBBLE - MARGIN, y: region.y + region.height - BUBBLE - MARGIN };
    case "bl": return { x: region.x + MARGIN, y: region.y + region.height - BUBBLE - MARGIN };
    case "tl": return { x: region.x + MARGIN, y: region.y + MARGIN };
    case "tr": return { x: region.x + region.width - BUBBLE - MARGIN, y: region.y + MARGIN };
  }
};

// Existing webcamPos state keeps working for manual drag
// When corner is set, sync webcamPos from corner
useEffect(() => {
  if (webcamCorner) setWebcamPos(cornerToPos(webcamCorner));
}, [webcamCorner]);

// Listen for cycle event
useEffect(() => {
  const unlisten = listen("overlay-cycle-webcam-position", () => {
    setWebcamCorner((prev) => {
      const order: Corner[] = ["br", "bl", "tl", "tr"];
      if (prev === null) return "br"; // if freeform, reset to br
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  });
  return () => { unlisten.then((fn) => fn()); };
}, []);
```

**Where manual drag happens** (the mouse-hook detection path): when drag starts, set `setWebcamCorner(null)` so the cycle resets from br next time:

```tsx
// Inside the mouse-click handler where drag is initiated
setWebcamCorner(null);
// ...existing drag setup
```

### 2. Update [src/components/recording/RecordingControls.tsx](../../src/components/recording/RecordingControls.tsx)

Register the global shortcut alongside the existing ones:

```tsx
const handleCyclePos = useCallback(() => emit("overlay-cycle-webcam-position"), []);
useGlobalShortcut("Ctrl+Shift+E", handleCyclePos, isRecording);
```

Optional: add a small icon button next to the existing camera button in the recording pill for discoverability. Use a lucide icon like `RotateCw` or similar.

## Verification

1. Start a region recording.
2. Press `Ctrl+Shift+W` to show the webcam bubble (defaults to bottom-right).
3. Press `Ctrl+Shift+E` — webcam jumps to bottom-left.
4. Press again — top-left.
5. Press again — top-right.
6. Press again — back to bottom-right.
7. Manually drag the webcam to a custom location.
8. Press `Ctrl+Shift+E` — webcam jumps to bottom-right (resets from freeform).
9. Confirm the webcam stays within the recording region at each corner position.
10. Confirm FFmpeg captures the webcam in the final video at each corner.

## Dependencies

- **None.** Works with the current fullscreen overlay (uses region screen coords from URL params).
- **Will be revisited during Phase 6** (Plan 04) because the region-sized overlay changes the coordinate system from screen-coords to window-local. At that time, `cornerToPos` switches from `region.x + ...` to `0 + ...` and uses the logical scaled dimensions.

## Files to Modify

- [src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx)
- [src/components/recording/RecordingControls.tsx](../../src/components/recording/RecordingControls.tsx)

## Out of Scope

- Customizable margin (hardcoded 25px — matches current default)
- Customizable bubble size (hardcoded 150px)
- Remembering corner preference across recording sessions

## Commit Message Draft

```
feat: webcam position cycling hotkey (Ctrl+Shift+E)

Adds global shortcut to cycle webcam bubble through four corners
of the recording region: bottom-right → bottom-left → top-left →
top-right → bottom-right. Manual drag resets cycle to freeform.
```
