import { useState, useCallback, useRef } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { useRecordingStore } from "../../stores/recordingStore";

interface RegionState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isDragging: boolean;
}

export function RecordingRegionSelector() {
  const { setIsSelectingRegion, startRecording } = useRecordingStore();
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

    if (width < 50 || height < 50) {
      setIsSelectingRegion(false);
      return;
    }

    // Ask where to save the recording
    const outputPath = await save({
      filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
      defaultPath: `recording-${Date.now()}.mp4`,
    });

    if (!outputPath) {
      setIsSelectingRegion(false);
      return;
    }

    setIsSelectingRegion(false);

    // Ensure dimensions are even (required for h264)
    const evenW = Math.floor(width / 2) * 2;
    const evenH = Math.floor(height / 2) * 2;

    try {
      await startRecording({
        x: Math.round(x),
        y: Math.round(y),
        width: evenW,
        height: evenH,
        fps: 30,
        outputPath,
        captureAudio: false,
      });
    } catch (e) {
      alert(`Failed to start recording: ${e}`);
    }
  }, [region, setIsSelectingRegion, startRecording]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSelectingRegion(false);
      }
    },
    [setIsSelectingRegion]
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
        zIndex: 9998,
        backgroundColor: "rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Instructions */}
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
          zIndex: 10,
        }}
      >
        Drag to select recording region — Press ESC to cancel
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
              border: "2px solid #FF3B30",
              backgroundColor: "rgba(255, 59, 48, 0.1)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
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
              zIndex: 10,
            }}
          >
            {Math.round(selectionW)} x {Math.round(selectionH)}
          </div>
        </>
      )}
    </div>
  );
}
