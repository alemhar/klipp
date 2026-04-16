import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
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

function App() {
  const { isCaptureMode, setIsCaptureMode, showSettings } = useUIStore();
  const { setCapturedImage } = useCaptureStore();
  const { undo, redo } = useCanvasStore();
  const { settings, isLoaded, loadSettings } = useSettingsStore();

  // Load settings on mount
  useEffect(() => {
    loadSettings();

    // Apply theme
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = settings.theme === "system" ? (prefersDark ? "dark" : "light") : settings.theme;
    document.documentElement.setAttribute("data-theme", theme);
    useUIStore.getState().setResolvedTheme(theme);
  }, []);

  // Handle capture shortcut — opens snipping overlay
  const handleCaptureShortcut = useCallback(() => {
    setIsCaptureMode(true);
  }, [setIsCaptureMode]);

  // Register global shortcut (only after settings are loaded)
  useGlobalShortcut(
    settings.captureShortcut || "Ctrl+Shift+S",
    handleCaptureShortcut,
    isLoaded
  );

  // Listen for tray events
  useEffect(() => {
    const unlisten = listen<string>("start-capture", () => {
      setIsCaptureMode(true);
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
