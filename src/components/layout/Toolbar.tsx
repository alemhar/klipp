import {
  MousePointer2,
  Pen,
  Highlighter,
  Eraser,
  Square,
  Type,
  Crop,
  Smile,
  Undo2,
  Redo2,
  Save,
  Copy,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { useCaptureStore } from "../../stores/captureStore";
import { saveImageToFile, copyImageToClipboard } from "../../lib/export";
import type { ToolType } from "../../types/canvas";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../../lib/constants";

interface ToolButtonProps {
  tool: ToolType;
  icon: React.ReactNode;
  label: string;
}

function ToolButton({ tool, icon, label }: ToolButtonProps) {
  const { activeTool, setActiveTool } = useUIStore();
  const isActive = activeTool === tool;

  return (
    <button
      title={label}
      onClick={() => setActiveTool(tool)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        backgroundColor: isActive ? "var(--accent-color)" : "transparent",
        color: isActive ? "#ffffff" : "var(--text-primary)",
        transition: "background-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return (
    <div
      style={{
        width: 1,
        height: 24,
        backgroundColor: "var(--border-color)",
        margin: "0 4px",
      }}
    />
  );
}

export function Toolbar() {
  const { undo, redo, past, future, zoom, setZoom } = useCanvasStore();
  const { capturedImage } = useCaptureStore();

  const handleSave = async () => {
    if (!capturedImage) return;
    await saveImageToFile(capturedImage.base64);
  };

  const handleCopy = async () => {
    if (!capturedImage) return;
    await copyImageToClipboard(capturedImage.base64);
  };

  const handleZoomIn = () => setZoom(Math.min(zoom + ZOOM_STEP, ZOOM_MAX));
  const handleZoomOut = () => setZoom(Math.max(zoom - ZOOM_STEP, ZOOM_MIN));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "4px 8px",
        backgroundColor: "var(--bg-toolbar)",
        borderBottom: "1px solid var(--border-color)",
        height: 44,
      }}
    >
      <ToolButton tool="select" icon={<MousePointer2 size={18} />} label="Select (V)" />
      <ToolButton tool="pen" icon={<Pen size={18} />} label="Pen (P)" />
      <ToolButton tool="highlighter" icon={<Highlighter size={18} />} label="Highlighter (H)" />
      <ToolButton tool="eraser" icon={<Eraser size={18} />} label="Eraser (E)" />

      <Separator />

      <ToolButton tool="shape" icon={<Square size={18} />} label="Shapes (S)" />
      <ToolButton tool="text" icon={<Type size={18} />} label="Text (T)" />
      <ToolButton tool="crop" icon={<Crop size={18} />} label="Crop (C)" />
      <ToolButton tool="emoji" icon={<Smile size={18} />} label="Emoji" />

      <Separator />

      <button
        title="Undo (Ctrl+Z)"
        onClick={undo}
        disabled={past.length === 0}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 6,
          border: "none",
          cursor: past.length > 0 ? "pointer" : "default",
          backgroundColor: "transparent",
          color: past.length > 0 ? "var(--text-primary)" : "var(--border-color)",
        }}
      >
        <Undo2 size={18} />
      </button>
      <button
        title="Redo (Ctrl+Y)"
        onClick={redo}
        disabled={future.length === 0}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 6,
          border: "none",
          cursor: future.length > 0 ? "pointer" : "default",
          backgroundColor: "transparent",
          color: future.length > 0 ? "var(--text-primary)" : "var(--border-color)",
        }}
      >
        <Redo2 size={18} />
      </button>

      <div style={{ flex: 1 }} />

      <button
        title="Zoom Out"
        onClick={handleZoomOut}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          backgroundColor: "transparent",
          color: "var(--text-primary)",
        }}
      >
        <ZoomOut size={16} />
      </button>
      <span
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          minWidth: 40,
          textAlign: "center",
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        title="Zoom In"
        onClick={handleZoomIn}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          backgroundColor: "transparent",
          color: "var(--text-primary)",
        }}
      >
        <ZoomIn size={16} />
      </button>

      <Separator />

      <button
        title="Copy (Ctrl+C)"
        onClick={handleCopy}
        disabled={!capturedImage}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 6,
          border: "none",
          cursor: capturedImage ? "pointer" : "default",
          backgroundColor: "transparent",
          color: capturedImage ? "var(--text-primary)" : "var(--border-color)",
        }}
      >
        <Copy size={18} />
      </button>
      <button
        title="Save (Ctrl+S)"
        onClick={handleSave}
        disabled={!capturedImage}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 6,
          border: "none",
          cursor: capturedImage ? "pointer" : "default",
          backgroundColor: "transparent",
          color: capturedImage ? "var(--text-primary)" : "var(--border-color)",
        }}
      >
        <Save size={18} />
      </button>
    </div>
  );
}
