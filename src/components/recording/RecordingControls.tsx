import { useEffect } from "react";
import { Square } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRecordingStore } from "../../stores/recordingStore";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function RecordingControls() {
  const { isRecording, elapsedSeconds, stopRecording, tick } = useRecordingStore();

  // On mount: shrink window to small pill, always on top
  useEffect(() => {
    if (!isRecording) return;

    const setup = async () => {
      const mainWindow = getCurrentWindow();
      await mainWindow.setAlwaysOnTop(true);
      await mainWindow.setSize({ type: "Logical", width: 220, height: 50 });
      await mainWindow.setPosition({
        type: "Logical",
        x: Math.round(screen.width / 2 - 110),
        y: 10,
      });
      await mainWindow.setFocus();
    };

    setup();
  }, [isRecording]);

  // Timer tick
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRecording, tick]);

  if (!isRecording) return null;

  return (
    <div
      data-tauri-drag-region
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: "rgba(30, 30, 30, 0.95)",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      {/* Recording indicator */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: "#FF3B30",
          animation: "blink 1s infinite",
          flexShrink: 0,
        }}
      />
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <span
        data-tauri-drag-region
        style={{ color: "#fff", fontSize: 14, fontFamily: "monospace", minWidth: 50 }}
      >
        {formatTime(elapsedSeconds)}
      </span>

      {/* Stop button */}
      <button
        onClick={stopRecording}
        title="Stop Recording"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "2px solid #FF3B30",
          backgroundColor: "transparent",
          cursor: "pointer",
          color: "#FF3B30",
          flexShrink: 0,
        }}
      >
        <Square size={12} fill="#FF3B30" />
      </button>
    </div>
  );
}
