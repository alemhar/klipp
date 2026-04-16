import { useUIStore } from "../../stores/uiStore";
import type { ShapeType } from "../../types/canvas";

const COLORS = [
  "#FF0000", "#FF6B00", "#FFD500", "#00C853",
  "#0078D4", "#7B1FA2", "#000000", "#FFFFFF",
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

const FONT_SIZES = [10, 12, 14, 16, 20, 24, 32, 48, 64];

const FONT_FAMILIES = [
  "Inter, sans-serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "Courier New, monospace",
  "Comic Sans MS, cursive",
  "Impact, sans-serif",
];

function Separator() {
  return <div style={{ width: 1, height: 20, backgroundColor: "var(--border-color)" }} />;
}

export function ToolOptionsBar() {
  const { activeTool, toolOptions, setToolOptions } = useUIStore();

  if (activeTool === "select" || activeTool === "eraser" || activeTool === "crop") return null;

  const isDrawingTool = activeTool === "pen" || activeTool === "highlighter" || activeTool === "shape";
  const isTextTool = activeTool === "text";

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
        overflowX: "auto",
      }}
    >
      {/* === Drawing tool options === */}
      {isDrawingTool && (
        <>
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

          <Separator />

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
        </>
      )}

      {/* Shape type selector */}
      {activeTool === "shape" && (
        <>
          <Separator />
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

      {/* === Text tool options === */}
      {isTextTool && (
        <>
          {/* Text color */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--text-secondary)", marginRight: 4 }}>Color:</span>
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setToolOptions({ textColor: color })}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  backgroundColor: color,
                  border: toolOptions.textColor === color
                    ? "2px solid var(--accent-color)"
                    : "1px solid var(--border-color)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
            <input
              type="color"
              value={toolOptions.textColor}
              onChange={(e) => setToolOptions({ textColor: e.target.value })}
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

          <Separator />

          {/* Font family */}
          <select
            value={toolOptions.fontFamily}
            onChange={(e) => setToolOptions({ fontFamily: e.target.value })}
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontSize: 11,
              maxWidth: 130,
            }}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font.split(",")[0]}
              </option>
            ))}
          </select>

          {/* Font size */}
          <select
            value={toolOptions.fontSize}
            onChange={(e) => setToolOptions({ fontSize: Number(e.target.value) })}
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontSize: 11,
              width: 50,
            }}
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>

          <Separator />

          {/* Bold */}
          <button
            onClick={() => {
              const current = toolOptions.fontStyle;
              const isBold = current.includes("bold");
              const isItalic = current.includes("italic");
              let next = "normal";
              if (!isBold && isItalic) next = "bold italic";
              else if (!isBold) next = "bold";
              else if (isItalic) next = "italic";
              setToolOptions({ fontStyle: next });
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              backgroundColor: toolOptions.fontStyle.includes("bold")
                ? "var(--accent-color)"
                : "transparent",
              color: toolOptions.fontStyle.includes("bold") ? "#fff" : "var(--text-primary)",
              fontWeight: "bold",
              fontSize: 13,
            }}
          >
            B
          </button>

          {/* Italic */}
          <button
            onClick={() => {
              const current = toolOptions.fontStyle;
              const isBold = current.includes("bold");
              const isItalic = current.includes("italic");
              let next = "normal";
              if (isBold && !isItalic) next = "bold italic";
              else if (!isItalic) next = "italic";
              else if (isBold) next = "bold";
              setToolOptions({ fontStyle: next });
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              backgroundColor: toolOptions.fontStyle.includes("italic")
                ? "var(--accent-color)"
                : "transparent",
              color: toolOptions.fontStyle.includes("italic") ? "#fff" : "var(--text-primary)",
              fontStyle: "italic",
              fontSize: 13,
            }}
          >
            I
          </button>

          {/* Underline */}
          <button
            onClick={() => {
              setToolOptions({
                textDecoration: toolOptions.textDecoration === "underline" ? "" : "underline",
              });
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              backgroundColor: toolOptions.textDecoration === "underline"
                ? "var(--accent-color)"
                : "transparent",
              color: toolOptions.textDecoration === "underline" ? "#fff" : "var(--text-primary)",
              textDecoration: "underline",
              fontSize: 13,
            }}
          >
            U
          </button>
        </>
      )}
    </div>
  );
}
