import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useCaptureStore } from "../../stores/captureStore";
import { useUIStore } from "../../stores/uiStore";
import type { CaptureResult } from "../../types/capture";

interface RegionState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isDragging: boolean;
}

export function CaptureOverlay() {
  const { setIsCaptureMode } = useUIStore();
  const { setCapturedImage, mode } = useCaptureStore();
  const [region, setRegion] = useState<RegionState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isDragging: false,
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setRegion({
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY,
      isDragging: true,
    });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!region.isDragging) return;
      setRegion((prev) => ({ ...prev, endX: e.clientX, endY: e.clientY }));
    },
    [region.isDragging]
  );

  const handleMouseUp = useCallback(async () => {
    if (!region.isDragging) return;

    const x = Math.min(region.startX, region.endX);
    const y = Math.min(region.startY, region.endY);
    const width = Math.abs(region.endX - region.startX);
    const height = Math.abs(region.endY - region.startY);

    setRegion((prev) => ({ ...prev, isDragging: false }));
    setIsCaptureMode(false);

    if (width < 5 || height < 5) return;

    try {
      const result = await invoke<CaptureResult>("capture_region", {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
      setCapturedImage(result);
    } catch (e) {
      console.error("Region capture failed:", e);
    }
  }, [region, setCapturedImage, setIsCaptureMode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCaptureMode(false);
      }
    },
    [setIsCaptureMode]
  );

  const selectionX = Math.min(region.startX, region.endX);
  const selectionY = Math.min(region.startY, region.endY);
  const selectionW = Math.abs(region.endX - region.startX);
  const selectionH = Math.abs(region.endY - region.startY);

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        cursor: "crosshair",
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Mode indicator */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          color: "#fff",
          padding: "6px 16px",
          borderRadius: 8,
          fontSize: 13,
          pointerEvents: "none",
        }}
      >
        {mode === "rectangular"
          ? "Drag to select region - Press ESC to cancel"
          : "Click to capture - Press ESC to cancel"}
      </div>

      {/* Selection rectangle */}
      {region.isDragging && selectionW > 0 && selectionH > 0 && (
        <>
          <div
            style={{
              position: "absolute",
              left: selectionX,
              top: selectionY,
              width: selectionW,
              height: selectionH,
              border: "2px solid var(--accent-color, #0078d4)",
              backgroundColor: "transparent",
              pointerEvents: "none",
            }}
          />
          {/* Dimension label */}
          <div
            style={{
              position: "absolute",
              left: selectionX,
              top: selectionY + selectionH + 4,
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              pointerEvents: "none",
            }}
          >
            {Math.round(selectionW)} x {Math.round(selectionH)}
          </div>
        </>
      )}
    </div>
  );
}
