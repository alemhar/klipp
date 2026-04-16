import { useEffect } from "react";
import { Circle, Square } from "lucide-react";
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

  // Timer tick
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRecording, tick]);

  if (!isRecording) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        borderRadius: 24,
        zIndex: 9999,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
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
        }}
      />
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <span style={{ color: "#fff", fontSize: 14, fontFamily: "monospace", minWidth: 50 }}>
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
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "2px solid #FF3B30",
          backgroundColor: "transparent",
          cursor: "pointer",
          color: "#FF3B30",
        }}
      >
        <Square size={14} fill="#FF3B30" />
      </button>
    </div>
  );
}
