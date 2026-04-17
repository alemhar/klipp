# Plan 02 — Recording Region Outline

> **Status**: ✅ Completed 2026-04-17 — commit `7c6a75b`

## Context

During recording, the user can't see the bounds of the selected region because the overlay is transparent. They need a visible outline around the recording region so they know what's being captured.

**Visual**: 2px red dashed border around the region. Should be subtle enough not to distract but visible enough to reference while demonstrating.

**Constraint**: The outline must be visible in the final FFmpeg recording (since FFmpeg captures the overlay as part of the screen). This is desired behavior — the outline becomes part of the video, helping viewers understand the focus area. If undesired, we'd need a different approach (discussed in "Out of Scope").

## Current State

The overlay is **fullscreen** and **transparent** (via WebView2 COM API). Region coordinates are passed via URL query params (`?x=...&y=...&w=...&h=...`) and parsed in `OverlayApp.tsx`:

```tsx
const params = new URLSearchParams(window.location.search);
const region = {
  x: parseInt(params.get("x") || "0"),
  y: parseInt(params.get("y") || "0"),
  width: parseInt(params.get("w") || String(window.innerWidth)),
  height: parseInt(params.get("h") || String(window.innerHeight)),
};
```

The overlay main container is:

```tsx
<div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", ... }}>
```

Inside it: tool indicator banner, click ripples, drawing SVG (shapes), and (as a sibling) the webcam bubble.

## Implementation Steps

### Update [src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx)

Add an absolute-positioned div inside the main overlay container, above the ripples but below any drawing tool indicators. Place it right after the tool indicator.

```tsx
{/* Recording region outline — always visible unless a drawing tool is active */}
{activeTool === "none" && (
  <div
    style={{
      position: "absolute",
      left: region.x,
      top: region.y,
      width: region.width,
      height: region.height,
      border: "2px dashed #ef4444",
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: 1,
    }}
  />
)}
```

**Design decisions**:
- **Hide when tool active**: when the user is drawing a rectangle/arrow, the outline adds visual noise. Toggle off while `activeTool !== "none"`.
- **Dashed instead of solid**: less visually heavy, recognizable as "selection marker" pattern.
- **Red (#ef4444)**: matches the existing shape color and recording indicator theme.
- **z-index 1**: below any UI banners (z 1000) but above the default content.

### Optional Enhancement: Animated Dashed Border

Add a subtle "marching ants" animation for classic selection-border feel. Add a CSS keyframe near the existing `ripple-expand`:

```tsx
<style>{`
  @keyframes ripple-expand { ... existing ... }
  @keyframes marching-ants {
    to { background-position: 100% 0, 0 100%, -100% 0, 0 -100%; }
  }
`}</style>
```

And for the outline div, replace `border` with a `background` of dashed lines that animate. This is optional and can be deferred.

## Verification

1. Start a region recording with a 400×300 selection in the middle of the screen.
2. Verify a red dashed rectangle appears exactly around the selected region.
3. Press `Ctrl+Shift+R` to activate rectangle tool — outline disappears.
4. Press `Ctrl+Shift+Z` to clear — outline reappears.
5. Move webcam with `Ctrl+Shift+W` — it should sit inside the outlined region.
6. Stop recording and play back the video — the dashed outline should be visible in the final recording (confirming FFmpeg captured it).

## Dependencies

- **None.** Works with the current fullscreen overlay.
- **Will be revisited during Phase 6** (Plan 04): once the overlay window is sized to match the region, the outline becomes `inset: 0` (full window border) instead of computed coords.

## Files to Modify

- [src/overlay/OverlayApp.tsx](../../src/overlay/OverlayApp.tsx)

## Out of Scope

- **Customizable color/style**: hardcoded red dashed. Could be a setting later.
- **Hiding the outline from the recording**: if the user wants the outline visible on-screen but NOT in the final video, we'd need to either (a) remove the outline briefly while FFmpeg captures each frame (impractical) or (b) use a separate non-captured overlay window. Deferred.
- **Animated "marching ants"**: optional enhancement, not required.

## Commit Message Draft

```
feat: red dashed outline around recording region

Renders a 2px dashed red border at the region coordinates on the
overlay so users can see exactly what's being captured. Outline
hides automatically while a drawing tool is active.
```
