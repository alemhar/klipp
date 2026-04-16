import { Camera, Settings, Moon, Sun } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { invoke } from "@tauri-apps/api/core";
import type { CaptureResult } from "../../types/capture";
import { useCaptureStore } from "../../stores/captureStore";
import { APP_NAME } from "../../lib/constants";

export function TitleBar() {
  const { resolvedTheme, setTheme, setResolvedTheme, setShowSettings } = useUIStore();
  const { setCapturedImage } = useCaptureStore();

  const toggleTheme = () => {
    const next = resolvedTheme === "light" ? "dark" : "light";
    setTheme(next);
    setResolvedTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleNewCapture = async () => {
    try {
      const result = await invoke<CaptureResult>("capture_fullscreen");
      setCapturedImage(result);
    } catch (e) {
      console.error("Capture failed:", e);
    }
  };

  return (
    <div
      data-tauri-drag-region
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        backgroundColor: "var(--bg-toolbar)",
        borderBottom: "1px solid var(--border-color)",
        height: 36,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{APP_NAME}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          title="New Capture"
          onClick={handleNewCapture}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            backgroundColor: "transparent",
            color: "var(--text-primary)",
          }}
        >
          <Camera size={16} />
        </button>
        <button
          title="Toggle Theme"
          onClick={toggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            backgroundColor: "transparent",
            color: "var(--text-primary)",
          }}
        >
          {resolvedTheme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button
          title="Settings"
          onClick={() => setShowSettings(true)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            backgroundColor: "transparent",
            color: "var(--text-primary)",
          }}
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
