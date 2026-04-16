import { useUIStore } from "../../stores/uiStore";
import type { ShapeType } from "../../types/canvas";

const COLORS = [
  "#FF0000", "#FF6B00", "#FFD500", "#00C853",
  "#0078D4", "#7B1FA2", "#000000", "#FFFFFF",
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

export function ToolOptionsBar() {
  const { activeTool, toolOptions, setToolOptions } = useUIStore();

  if (activeTool === "select" || activeTool === "eraser") return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "4px 12px",
        backgroundColor: "var(--bg-toolbar)",
        borderBottom: "1px solid var(--border-color)",
        height: 36,
        fontSize: 12,
      }}
    >
      {/* Color picker */}
      {(activeTool === "pen" || activeTool === "highlighter" || activeTool === "shape") && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "var(--text-secondary)", marginRight: 4 }}>Color:</span>
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setToolOptions({ strokeColor: color })}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: color,
                border: toolOptions.strokeColor === color
                  ? "2px solid var(--accent-color)"
                  : "1px solid var(--border-color)",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
          <input
            type="color"
            value={toolOptions.strokeColor}
            onChange={(e) => setToolOptions({ strokeColor: e.target.value })}
            style={{
              width: 18,
              height: 18,
              padding: 0,
              border: "1px solid var(--border-color)",
              borderRadius: "50%",
              cursor: "pointer",
              backgroundColor: "transparent",
            }}
            title="Custom color"
          />
        </div>
      )}

      {/* Separator */}
      {(activeTool === "pen" || activeTool === "highlighter" || activeTool === "shape") && (
        <div style={{ width: 1, height: 20, backgroundColor: "var(--border-color)" }} />
      )}

      {/* Stroke width */}
      {(activeTool === "pen" || activeTool === "highlighter" || activeTool === "shape") && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "var(--text-secondary)", marginRight: 4 }}>Size:</span>
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setToolOptions({ strokeWidth: w })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  toolOptions.strokeWidth === w ? "var(--accent-color)" : "transparent",
                color: toolOptions.strokeWidth === w ? "#fff" : "var(--text-primary)",
                fontSize: 11,
              }}
            >
              {w}
            </button>
          ))}
        </div>
      )}

      {/* Shape type selector */}
      {activeTool === "shape" && (
        <>
          <div style={{ width: 1, height: 20, backgroundColor: "var(--border-color)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--text-secondary)", marginRight: 4 }}>Shape:</span>
            {(["rectangle", "ellipse", "arrow", "line"] as ShapeType[]).map((shape) => (
              <button
                key={shape}
                onClick={() => setToolOptions({ shapeType: shape })}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    toolOptions.shapeType === shape ? "var(--accent-color)" : "transparent",
                  color: toolOptions.shapeType === shape ? "#fff" : "var(--text-primary)",
                  fontSize: 11,
                  textTransform: "capitalize",
                }}
              >
                {shape}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
