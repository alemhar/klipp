# Why Konva.js for the annotation canvas

Klipp's annotation surface (pens, highlighters, shapes, text, images, crop, ruler) runs on [Konva.js](https://konvajs.org/) via [react-konva](https://konvajs.org/docs/react/). This doc explains why that's the right fit for Klipp specifically, and what we gave up.

## What the canvas needs to do

- Render many shapes fast and interactively — draw-as-you-drag
- Each shape is a first-class object: selectable, movable, resizable, rotatable, re-editable (especially for text)
- Serialize the full canvas state cheaply (for undo/redo + save/load)
- Work well inside a React tree with Zustand state
- Scale crisply — annotations have to look sharp when saved at the captured image's native resolution
- Export to a flat raster (PNG/JPG/GIF/BMP)

## Why Konva.js

1. **Scene graph with real event routing.** Konva is essentially a lightweight 2D scene graph on top of `<canvas>`. Each `Line`, `Rect`, `Ellipse`, `Arrow`, `Text`, `Image` is a real node you can attach handlers to. That pays off hugely for the annotator UX: click-to-select, drag-to-move, transformer-to-resize all come for free from the shape layer instead of being implemented on raw canvas coordinates.
2. **Transformer primitive.** Selecting a text box and getting 8 resize handles + a rotate handle + live resize constraints is `<Transformer ref={...} />` + attach. We use this extensively in [`TextNode.tsx`](../../src/components/canvas/TextNode.tsx) and [`ImageOverlayNode.tsx`](../../src/components/canvas/ImageOverlayNode.tsx).
3. **React bindings are idiomatic.** `react-konva` re-renders when props change and reconciles into the Konva scene graph. It plays nicely with our Zustand-backed `canvasStore` — no imperative bridge, no `forwardRef` gymnastics for the happy path.
4. **Layers map to our mental model.** We keep the underlying captured image on one layer and the user's annotations on another. Hit-testing, re-ordering, z-index — all resolved by layer membership. See [`AnnotationCanvas.tsx`](../../src/components/canvas/AnnotationCanvas.tsx).
5. **Serialization is trivial.** Our state is just JSON-serializable objects (`DrawingObject | ShapeObject | TextObject | ImageOverlayObject`), which map 1:1 to Konva nodes on render. Undo/redo is a matter of swapping the array in the store — Konva reconciles.
6. **Good export path.** `stage.toDataURL({ pixelRatio: 2 })` gives us a high-DPI PNG with annotations baked in. Used by [`export.ts`](../../src/lib/export.ts) for save-to-file and copy-to-clipboard.

## Alternatives considered

| Option | Why not |
|---|---|
| **Raw HTML5 canvas** | Too low-level. We'd rewrite selection / transform / hit-testing ourselves. Months of work for things Konva gives on day one. |
| **Fabric.js** | Similar feature set but an older, more imperative API. Less React-friendly; the React wrappers that exist are less actively maintained than `react-konva`. |
| **SVG + React** | Great for a small number of elements but DOM-based hit-testing and rendering don't scale — once you have dozens of pen strokes with thousands of points, performance degrades sharply. Also, rasterizing SVG for PNG export is an extra step. |
| **Pixi.js** | WebGL-first, meant for games / heavy graphics. For a 2D annotation surface this is overkill and makes text/shape editing more complex. |
| **Excalidraw as a library** | Beautiful UX but opinionated styling and a specific shape-language that clashes with Klipp's snipping-tool aesthetic. Also heavyweight for our use. |

## Trade-offs

- **Bundle size.** Konva + react-konva adds ~150KB gzipped. For a desktop app this is a non-issue; for a tiny web widget it might be.
- **Not WebGL.** On massive scenes (thousands of nodes animating at 60fps) Konva can get warm. We're nowhere near that ceiling, but "animated 10,000-pen-stroke background" isn't in our future.
- **TypeScript typings have sharp edges.** The react-konva types sometimes require `any` for event handlers. Mostly fine, occasionally annoying.
- **Text editing.** Konva's `Text` node isn't directly editable — we overlay an HTML `<textarea>` at the node's coords for editing and rehydrate the `Text` on blur. See the text-edit logic in `TextNode.tsx`. This is a common pattern in Konva apps but adds some complexity.

## When to revisit

- If we ever need **real-time multi-user annotation** (tens of concurrent writers), Konva's single-canvas reconciliation becomes a bottleneck and we'd consider a WebGL renderer + CRDT.
- If **export sizes** balloon to cover entire 4K/5K workflows with hundreds of layers, look at `konva`'s cache / offscreen canvas patterns first; only then consider a lower-level renderer.
- If we pivot the annotation surface into something closer to a full vector editor (Boolean ops, path editing, gradients), consider supplementing or replacing Konva with a renderer built on `fabric.js` or a custom SVG/canvas hybrid.

## References

- Konva + react-konva: https://konvajs.org/docs/react/
- Canvas components: [`src/components/canvas/`](../../src/components/canvas/)
- Canvas state store: [`src/stores/canvasStore.ts`](../../src/stores/canvasStore.ts)
- Canvas object types: [`src/types/canvas.ts`](../../src/types/canvas.ts)
- Export logic: [`src/lib/export.ts`](../../src/lib/export.ts)
