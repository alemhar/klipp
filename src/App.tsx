import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { TitleBar } from "./components/layout/TitleBar";
import { Toolbar } from "./components/layout/Toolbar";
import { StatusBar } from "./components/layout/StatusBar";
import { ToolOptionsBar } from "./components/layout/ToolOptionsBar";
import { AnnotationCanvas } from "./components/canvas/AnnotationCanvas";
import { CaptureOverlay } from "./components/capture/CaptureOverlay";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { EmojiPicker } from "./components/canvas/EmojiPicker";
import { useUIStore } from "./stores/uiStore";
import { useCaptureStore } from "./stores/captureStore";
import { useCanvasStore } from "./stores/canvasStore";
import type { TextObject } from "./types/canvas";
import { useSettingsStore } from "./stores/settingsStore";
import { useGlobalShortcut } from "./hooks/useGlobalShortcut";

function App() {
  const { isCaptureMode, setIsCaptureMode, showSettings, activeTool } = useUIStore();
  const { setCapturedImage } = useCaptureStore();
  const { undo, redo, addObject } = useCanvasStore();

  const handleEmojiSelect = (emoji: string) => {
    const emojiObj: TextObject = {
      id: `obj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "text",
      x: 200,
      y: 200,
      props: {
        text: emoji,
        fontSize: 48,
        fontFamily: "Arial, sans-serif",
        fontStyle: "normal",
        textDecoration: "",
        fill: "#000000",
        align: "left",
      },
    };
    addObject(emojiObj);
    useUIStore.getState().setActiveTool("select");
  };
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
    const { setActiveTool } = useUIStore.getState();
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in any text input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") return;

      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
      } else if (!e.ctrlKey && !e.altKey) {
        // Tool shortcuts
        switch (e.key.toLowerCase()) {
          case "v": setActiveTool("select"); break;
          case "p": setActiveTool("pen"); break;
          case "h": setActiveTool("highlighter"); break;
          case "e": setActiveTool("eraser"); break;
          case "s": setActiveTool("shape"); break;
          case "t": setActiveTool("text"); break;
        }
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
      <ToolOptionsBar />
      <AnnotationCanvas />
      <StatusBar />

      {isCaptureMode && <CaptureOverlay />}
      {showSettings && <SettingsPanel />}
      {activeTool === "emoji" && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => useUIStore.getState().setActiveTool("select")}
        />
      )}
    </div>
  );
}

export default App;
