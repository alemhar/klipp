import { useCanvasStore } from "../../stores/canvasStore";
import { useCaptureStore } from "../../stores/captureStore";

export function StatusBar() {
  const { zoom } = useCanvasStore();
  const { capturedImage } = useCaptureStore();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "2px 12px",
        backgroundColor: "var(--bg-toolbar)",
        borderTop: "1px solid var(--border-color)",
        height: 24,
        fontSize: 11,
        color: "var(--text-secondary)",
      }}
    >
      <span>
        {capturedImage
          ? `${capturedImage.width} x ${capturedImage.height} px`
          : "No image"}
      </span>
      <span>{Math.round(zoom * 100)}%</span>
    </div>
  );
}
