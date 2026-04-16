import { useEffect, useCallback } from "react";
import { Square, RectangleHorizontal, MoveUpRight, Trash2 } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import { useRecordingStore } from "../../stores/recordingStore";
import { useGlobalShortcut } from "../../hooks/useGlobalShortcut";

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
      await mainWindow.setSize({ type: "Logical", width: 320, height: 50 });
      await mainWindow.setPosition({
        type: "Logical",
        x: Math.round(screen.width / 2 - 160),
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

  // Global shortcuts for annotation tools (work even when other apps have focus)
  const handleRectangle = useCallback(() => emit("overlay-set-tool", "rectangle"), []);
  const handleArrow = useCallback(() => emit("overlay-set-tool", "arrow"), []);
  const handleClear = useCallback(() => emit("overlay-clear"), []);

  useGlobalShortcut("Ctrl+Shift+R", handleRectangle, isRecording);
  useGlobalShortcut("Ctrl+Shift+A", handleArrow, isRecording);
  useGlobalShortcut("Ctrl+Shift+Z", handleClear, isRecording);

  if (!isRecording) return null;

  const toolBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    borderRadius: 4,
    border: "1px solid rgba(255,255,255,0.3)",
    backgroundColor: "transparent",
    cursor: "pointer",
    color: "#ccc",
    flexShrink: 0,
    padding: 0,
  };

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

      {/* Annotation tool buttons */}
      <button
        onClick={() => emit("overlay-set-tool", "rectangle")}
        title="Rectangle (Ctrl+Shift+R)"
        style={toolBtnStyle}
      >
        <RectangleHorizontal size={14} />
      </button>
      <button
        onClick={() => emit("overlay-set-tool", "arrow")}
        title="Arrow (Ctrl+Shift+A)"
        style={toolBtnStyle}
      >
        <MoveUpRight size={14} />
      </button>
      <button
        onClick={() => emit("overlay-clear")}
        title="Clear (Ctrl+Shift+Z)"
        style={toolBtnStyle}
      >
        <Trash2 size={14} />
      </button>

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
