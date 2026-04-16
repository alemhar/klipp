import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "./components/layout/TitleBar";
import { Toolbar } from "./components/layout/Toolbar";
import { StatusBar } from "./components/layout/StatusBar";
import { AnnotationCanvas } from "./components/canvas/AnnotationCanvas";
import { CaptureOverlay } from "./components/capture/CaptureOverlay";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { useUIStore } from "./stores/uiStore";
import { useCaptureStore } from "./stores/captureStore";
import { useCanvasStore } from "./stores/canvasStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useGlobalShortcut } from "./hooks/useGlobalShortcut";
import { copyImageToClipboard } from "./lib/export";
import type { CaptureResult } from "./types/capture";

function App() {
  const { isCaptureMode, setIsCaptureMode, showSettings } = useUIStore();
  const { setCapturedImage } = useCaptureStore();
  const { undo, redo } = useCanvasStore();
  const { settings, loadSettings } = useSettingsStore();

  // Load settings on mount
  useEffect(() => {
    loadSettings();

    // Apply theme
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = settings.theme === "system" ? (prefersDark ? "dark" : "light") : settings.theme;
    document.documentElement.setAttribute("data-theme", theme);
    useUIStore.getState().setResolvedTheme(theme);
  }, []);

  // Handle fullscreen capture via shortcut
  const handleCaptureShortcut = useCallback(async () => {
    try {
      const result = await invoke<CaptureResult>("capture_fullscreen");
      setCapturedImage(result);
      if (settings.autoCopyToClipboard) {
        await copyImageToClipboard(result.base64);
      }
    } catch (e) {
      console.error("Capture failed:", e);
    }
  }, [setCapturedImage, settings.autoCopyToClipboard]);

  // Register global shortcut
  useGlobalShortcut(settings.captureShortcut, handleCaptureShortcut);

  // Listen for tray events
  useEffect(() => {
    const unlisten = listen<string>("start-capture", (event) => {
      if (event.payload === "rectangular") {
        setIsCaptureMode(true);
      } else {
        handleCaptureShortcut();
      }
    });

    const unlistenSettings = listen("open-settings", () => {
      useUIStore.getState().setShowSettings(true);
    });

    return () => {
      unlisten.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
    };
  }, [handleCaptureShortcut, setIsCaptureMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
      }}
    >
      <TitleBar />
      <Toolbar />
      <AnnotationCanvas />
      <StatusBar />

      {isCaptureMode && <CaptureOverlay />}
      {showSettings && <SettingsPanel />}
    </div>
  );
}

export default App;
