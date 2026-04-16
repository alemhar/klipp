import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCaptureStore } from "../../stores/captureStore";
import { useUIStore } from "../../stores/uiStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { copyImageToClipboard } from "../../lib/export";
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
  const { settings } = useSettingsStore();
  const [screenshotBg, setScreenshotBg] = useState<string | null>(null);
  const [fullCapture, setFullCapture] = useState<CaptureResult | null>(null);
  const [region, setRegion] = useState<RegionState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isDragging: false,
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  // On mount: hide main window, take fullscreen screenshot, then go fullscreen
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const mainWindow = getCurrentWindow();
        await mainWindow.hide();

        // Small delay to let the window fully hide
        await new Promise((r) => setTimeout(r, 150));

        const result = await invoke<CaptureResult>("capture_fullscreen");
        if (cancelled) return;

        setFullCapture(result);
        setScreenshotBg(`data:image/png;base64,${result.base64}`);

        // Show main window as fullscreen transparent overlay
        await mainWindow.setDecorations(false);
        await mainWindow.setAlwaysOnTop(true);
        await mainWindow.setFullscreen(true);
        await mainWindow.show();
        await mainWindow.setFocus();
      } catch (e) {
        console.error("Capture setup failed:", e);
        if (!cancelled) {
          await restoreMainWindow();
          setIsCaptureMode(false);
        }
      }
    };

    setup();
    return () => { cancelled = true; };
  }, []);

  // Focus the overlay on mount for keyboard events
  useEffect(() => {
    if (screenshotBg && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [screenshotBg]);

  const restoreMainWindow = async () => {
    const mainWindow = getCurrentWindow();
    await mainWindow.setFullscreen(false);
    await mainWindow.setDecorations(true);
    await mainWindow.setAlwaysOnTop(false);
    await mainWindow.show();
    await mainWindow.setFocus();
  };

  const handleCancel = useCallback(async () => {
    await restoreMainWindow();
    setIsCaptureMode(false);
  }, [setIsCaptureMode]);

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
    if (!region.isDragging || !fullCapture) return;

    const x = Math.min(region.startX, region.endX);
    const y = Math.min(region.startY, region.endY);
    const width = Math.abs(region.endX - region.startX);
    const height = Math.abs(region.endY - region.startY);

    setRegion((prev) => ({ ...prev, isDragging: false }));

    if (width < 5 || height < 5) return;

    try {
      // Crop the region from the pre-captured fullscreen screenshot (no overlay in it)
      const result = await invoke<CaptureResult>("crop_image", {
        base64Data: fullCapture.base64,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });

      await restoreMainWindow();
      setIsCaptureMode(false);
      useCanvasStore.getState().clearAll();
      setCapturedImage(result);

      if (settings.autoCopyToClipboard) {
        await copyImageToClipboard(result.base64);
      }
    } catch (e) {
      console.error("Region capture failed:", e);
      await restoreMainWindow();
      setIsCaptureMode(false);
    }
  }, [region, fullCapture, setCapturedImage, setIsCaptureMode, settings.autoCopyToClipboard]);

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

  // Show nothing until screenshot is ready
  if (!screenshotBg) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        backgroundColor: "#000",
      }} />
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
        zIndex: 9999,
        backgroundImage: `url(${screenshotBg})`,
        backgroundSize: "100vw 100vh",
        backgroundPosition: "0 0",
      }}
    >
      {/* Dark overlay on unselected area */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          pointerEvents: "none",
        }}
      />

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
          zIndex: 10,
        }}
      >
        {mode === "rectangular"
          ? "Drag to select region — Press ESC to cancel"
          : "Click to capture — Press ESC to cancel"}
      </div>

      {/* Selection rectangle — shows the clear screenshot underneath */}
      {region.isDragging && selectionW > 0 && selectionH > 0 && (
        <>
          {/* Clear area (punched through the dark overlay) */}
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
              border: "2px solid #0078d4",
              pointerEvents: "none",
              zIndex: 5,
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
