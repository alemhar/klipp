import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { useCaptureStore } from "../../stores/captureStore";

export function AnnotationCanvas() {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const { zoom } = useCanvasStore();
  const { capturedImage } = useCaptureStore();

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!capturedImage) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = `data:image/png;base64,${capturedImage.base64}`;
  }, [capturedImage]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "hidden",
        backgroundColor: "var(--bg-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {capturedImage && image ? (
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          scaleX={zoom}
          scaleY={zoom}
          style={{ cursor: "crosshair" }}
        >
          <Layer>
            <KonvaImage
              image={image}
              x={(containerSize.width / zoom - capturedImage.width) / 2}
              y={(containerSize.height / zoom - capturedImage.height) / 2}
              width={capturedImage.width}
              height={capturedImage.height}
            />
          </Layer>
          {/* Annotation layers will be added here in Phase 2 */}
          <Layer name="annotations" />
        </Stage>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            color: "var(--text-secondary)",
          }}
        >
          <Camera size={48} />
          <p style={{ fontSize: 14 }}>
            Press <kbd style={{ padding: "2px 6px", backgroundColor: "var(--bg-toolbar)", borderRadius: 4, border: "1px solid var(--border-color)" }}>Ctrl+Shift+S</kbd> to capture
          </p>
          <p style={{ fontSize: 12 }}>or click the camera icon above</p>
        </div>
      )}
    </div>
  );
}

// Import for the empty state icon
import { Camera } from "lucide-react";
