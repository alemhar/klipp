import { useState, useCallback, useEffect, useRef } from "react";
import { useRecordingStore } from "../../stores/recordingStore";

interface LiveShape {
  id: number;
  type: "rectangle" | "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function LiveAnnotationOverlay() {
  const { isRecording } = useRecordingStore();
  const [shapes, setShapes] = useState<LiveShape[]>([]);
  const [activeTool, setActiveTool] = useState<"none" | "rectangle" | "arrow">("none");
  const [drawing, setDrawing] = useState<LiveShape | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Listen for hotkeys: R = rectangle, A = arrow, ESC = clear
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r") {
        setActiveTool((prev) => (prev === "rectangle" ? "none" : "rectangle"));
      } else if (e.key.toLowerCase() === "a") {
        setActiveTool((prev) => (prev === "arrow" ? "none" : "arrow"));
      } else if (e.key === "Escape") {
        setShapes([]);
        setActiveTool("none");
        setDrawing(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === "none") return;
      setDrawing({
        id: Date.now(),
        type: activeTool,
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
      });
    },
    [activeTool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return;
      setDrawing((prev) =>
        prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null
      );
    },
    [drawing]
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    const w = Math.abs(drawing.endX - drawing.startX);
    const h = Math.abs(drawing.endY - drawing.startY);
    if (w > 5 || h > 5) {
      setShapes((prev) => [...prev, drawing]);
    }
    setDrawing(null);
  }, [drawing]);

  if (!isRecording) return null;

  return (
    <>
      {/* Tool indicator */}
      {activeTool !== "none" && (
        <div
          style={{
            position: "fixed",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            color: "#fff",
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: 12,
            zIndex: 99998,
            pointerEvents: "none",
          }}
        >
          Drawing: {activeTool} — Click & drag | ESC to clear
        </div>
      )}

      {/* Transparent drawing overlay — only captures mouse when a tool is active */}
      {activeTool !== "none" && (
        <div
          ref={overlayRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 99997,
            cursor: "crosshair",
          }}
        />
      )}

      {/* Render shapes */}
      {shapes.map((shape) => (
        <ShapeRenderer key={shape.id} shape={shape} />
      ))}
      {drawing && <ShapeRenderer shape={drawing} isDraft />}
    </>
  );
}

function ShapeRenderer({
  shape,
  isDraft,
}: {
  shape: LiveShape;
  isDraft?: boolean;
}) {
  const x = Math.min(shape.startX, shape.endX);
  const y = Math.min(shape.startY, shape.endY);
  const w = Math.abs(shape.endX - shape.startX);
  const h = Math.abs(shape.endY - shape.startY);

  if (shape.type === "rectangle") {
    return (
      <div
        style={{
          position: "fixed",
          left: x,
          top: y,
          width: w,
          height: h,
          border: `3px solid #FF3B30`,
          borderStyle: isDraft ? "dashed" : "solid",
          backgroundColor: "rgba(255, 59, 48, 0.1)",
          borderRadius: 4,
          pointerEvents: "none",
          zIndex: 99996,
        }}
      />
    );
  }

  if (shape.type === "arrow") {
    // Render arrow using SVG
    const svgW = Math.abs(shape.endX - shape.startX) || 1;
    const svgH = Math.abs(shape.endY - shape.startY) || 1;
    const left = Math.min(shape.startX, shape.endX);
    const top = Math.min(shape.startY, shape.endY);
    const sx = shape.startX - left;
    const sy = shape.startY - top;
    const ex = shape.endX - left;
    const ey = shape.endY - top;

    return (
      <svg
        style={{
          position: "fixed",
          left: left - 10,
          top: top - 10,
          width: svgW + 20,
          height: svgH + 20,
          pointerEvents: "none",
          zIndex: 99996,
          overflow: "visible",
        }}
      >
        <defs>
          <marker
            id={`arrowhead-${shape.id}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#FF3B30" />
          </marker>
        </defs>
        <line
          x1={sx + 10}
          y1={sy + 10}
          x2={ex + 10}
          y2={ey + 10}
          stroke="#FF3B30"
          strokeWidth={3}
          strokeDasharray={isDraft ? "5,5" : "none"}
          markerEnd={`url(#arrowhead-${shape.id})`}
        />
      </svg>
    );
  }

  return null;
}
