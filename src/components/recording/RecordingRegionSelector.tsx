import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save } from "@tauri-apps/plugin-dialog";
import { useRecordingStore } from "../../stores/recordingStore";
import type { CaptureResult } from "../../types/capture";

interface RegionState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isDragging: boolean;
}

export function RecordingRegionSelector() {
  const { setIsSelectingRegion, startRecording } = useRecordingStore();
  const [screenshotBg, setScreenshotBg] = useState<string | null>(null);
  const [region, setRegion] = useState<RegionState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isDragging: false,
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  // Hide window, take screenshot, then go fullscreen with screenshot as background
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      const mainWindow = getCurrentWindow();
      await mainWindow.hide();
      await new Promise((r) => setTimeout(r, 50));

      const result = await invoke<CaptureResult>("capture_fullscreen_fast");
      if (cancelled) return;

      const mime = result.format === "bmp" ? "image/bmp" : "image/png";
      setScreenshotBg(`data:${mime};base64,${result.base64}`);

      await mainWindow.setAlwaysOnTop(true);
      await mainWindow.setFullscreen(true);
      await mainWindow.show();
      await mainWindow.setFocus();
    };
    setup();
    return () => { cancelled = true; };
  }, []);

  // Focus overlay for keyboard events
  useEffect(() => {
    if (screenshotBg && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [screenshotBg]);

  const restoreWindow = async () => {
    const mainWindow = getCurrentWindow();
    await mainWindow.setFullscreen(false);
    await mainWindow.setAlwaysOnTop(false);
    await mainWindow.show();
    await mainWindow.setFocus();
  };

  const handleCancel = useCallback(async () => {
    await restoreWindow();
    setIsSelectingRegion(false);
  }, [setIsSelectingRegion]);

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
      await restoreWindow();
      setIsSelectingRegion(false);
      return;
    }

    await restoreWindow();

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
        handleCancel();
      }
    },
    [handleCancel]
  );

  const selectionX = Math.min(region.startX, region.endX);
  const selectionY = Math.min(region.startY, region.endY);
  const selectionW = Math.abs(region.endX - region.startX);
  const selectionH = Math.abs(region.endY - region.startY);

  // Loading state
  if (!screenshotBg) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9998,
          backgroundColor: "#000",
        }}
      />
    );
  }

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
        backgroundImage: `url(${screenshotBg})`,
        backgroundSize: "100vw 100vh",
        backgroundPosition: "0 0",
      }}
    >
      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          pointerEvents: "none",
        }}
      />

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

      {/* Selection rectangle with clear view */}
      {region.isDragging && selectionW > 0 && selectionH > 0 && (
        <>
          <div
            style={{
              position: "absolute",
              left: selectionX,
              top: selectionY,
              width: selectionW,
              height: selectionH,
              backgroundImage: `url(${screenshotBg})`,
              backgroundSize: `${window.innerWidth}px ${window.innerHeight}px`,
              backgroundPosition: `-${selectionX}px -${selectionY}px`,
              border: "2px solid #FF3B30",
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
