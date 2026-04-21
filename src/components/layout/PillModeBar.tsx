import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  Scissors,
  Monitor,
  Maximize,
  Square,
  Clock,
  Video,
  X,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useCaptureStore } from "../../stores/captureStore";
import { useRecordingStore } from "../../stores/recordingStore";
import { useWindowModeStore } from "../../stores/windowModeStore";
import { useRecordFlow } from "../../hooks/useRecordFlow";
import { useMediaPermission } from "../../hooks/useMediaPermission";
import { PermissionBlockedModal } from "../recording/PermissionBlockedModal";
import type { CaptureMode, DelayOption } from "../../types/capture";

const CAPTURE_MODE_ICONS: Record<CaptureMode, React.ReactNode> = {
  rectangular: <Square size={14} />,
  fullscreen: <Maximize size={14} />,
  window: <Monitor size={14} />,
  freeform: <Square size={14} />,
};

const DELAY_LABELS: Record<number, string> = {
  0: "Delay",
  3: "3 s",
  5: "5 s",
  10: "10 s",
};

const ROW1_BTN: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 10px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "var(--text-primary)",
  fontSize: 12,
};

export function PillModeBar() {
  const { setIsCaptureMode, isCaptureMode, setShowSettings } = useUIStore();
  const { mode, delay, setMode, setDelay } = useCaptureStore();
  const {
    isRecording,
    stopRecording,
    webcamEnabled,
    setWebcamEnabled,
    micAudioEnabled,
    setMicAudioEnabled,
  } = useRecordingStore();
  const { expandToFull } = useWindowModeStore();
  const record = useRecordFlow();
  const cameraPermission = useMediaPermission("camera");
  const microphonePermission = useMediaPermission("microphone");
  const [blockedModal, setBlockedModal] = useState<"camera" | "microphone" | null>(null);

  // Keep latest state available to the native-menu event listener, which
  // runs outside React's render cycle.
  const stateRef = useRef({
    setMode,
    setDelay,
    setMicAudioEnabled,
    setWebcamEnabled,
    setShowSettings,
    expandToFull,
    setBlockedModal,
    cameraPermission,
    microphonePermission,
  });
  stateRef.current = {
    setMode,
    setDelay,
    setMicAudioEnabled,
    setWebcamEnabled,
    setShowSettings,
    expandToFull,
    setBlockedModal,
    cameraPermission,
    microphonePermission,
  };

  useEffect(() => {
    const unlistenPromise = listen<string>("pill-menu-selected", (event) => {
      const id = event.payload;
      const s = stateRef.current;
      if (id.startsWith("pill-mode:")) {
        s.setMode(id.substring("pill-mode:".length) as CaptureMode);
      } else if (id.startsWith("pill-delay:")) {
        const n = parseInt(id.substring("pill-delay:".length), 10);
        s.setDelay(n as DelayOption);
      } else if (id === "pill-opts:mic") {
        const currentlyOn = useRecordingStore.getState().micAudioEnabled;
        if (!currentlyOn && s.microphonePermission === "denied") {
          s.setBlockedModal("microphone");
        } else {
          s.setMicAudioEnabled(!currentlyOn);
        }
      } else if (id === "pill-opts:webcam") {
        const currentlyOn = useRecordingStore.getState().webcamEnabled;
        if (!currentlyOn && s.cameraPermission === "denied") {
          s.setBlockedModal("camera");
        } else {
          s.setWebcamEnabled(!currentlyOn);
        }
      } else if (id === "pill-opts:prefs") {
        (async () => {
          await s.expandToFull();
          s.setShowSettings(true);
        })();
      } else if (id === "pill-opts:quit") {
        getCurrentWindow().close();
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  const showPillMenu = async (kind: "mode" | "delay" | "options", btn: HTMLElement) => {
    const rect = btn.getBoundingClientRect();
    await invoke("show_pill_menu", {
      kind,
      x: rect.left,
      y: rect.bottom + 2,
      currentMode: mode,
      currentDelay: delay,
      micEnabled: micAudioEnabled,
      webcamEnabled,
    }).catch((e) => console.error("show_pill_menu failed:", e));
  };

  const handleNew = () => {
    if (isCaptureMode || isRecording) return;
    setIsCaptureMode(true);
  };

  const cancelActive = isCaptureMode || isRecording;
  const handleCancel = () => {
    if (isRecording) stopRecording();
    else if (isCaptureMode) setIsCaptureMode(false);
  };

  const helperText = isRecording
    ? "Recording in progress — press Ctrl+Shift+S to stop."
    : isCaptureMode
    ? "Drag to select the area you want to capture, or press Esc to cancel."
    : "Select the snip mode using the Mode button or click the New button.";

  return (
    <div
      data-tauri-drag-region
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        backgroundColor: "var(--bg-toolbar)",
        borderBottom: "1px solid var(--border-color)",
        userSelect: "none",
      }}
    >
      {/* Row 1 — action bar */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          height: 56,
          gap: 2,
        }}
      >
        {/* ✂ New */}
        <button
          title="New Capture (Ctrl+Shift+S)"
          onClick={handleNew}
          disabled={isCaptureMode || isRecording}
          style={{
            ...ROW1_BTN,
            color: isCaptureMode || isRecording ? "var(--text-secondary)" : "#dc2626",
            fontWeight: 600,
          }}
        >
          <Scissors size={16} />
          <span>New</span>
        </button>

        {/* ▾ Mode — native popup menu */}
        <button
          title="Mode"
          onClick={(e) => showPillMenu("mode", e.currentTarget)}
          style={ROW1_BTN}
        >
          {CAPTURE_MODE_ICONS[mode]}
          <span>Mode</span>
          <ChevronDown size={12} />
        </button>

        {/* ⏱ Delay — native popup menu */}
        <button
          title="Delay"
          onClick={(e) => showPillMenu("delay", e.currentTarget)}
          style={ROW1_BTN}
        >
          <Clock size={14} />
          <span>{DELAY_LABELS[delay] ?? "Delay"}</span>
          <ChevronDown size={12} />
        </button>

        {/* ⏺ Record */}
        <button
          title={
            record.isInstallingFfmpeg
              ? "Installing FFmpeg... (one-time ~30MB download)"
              : isRecording
              ? "Recording..."
              : "Screen Record"
          }
          onClick={record.onClick}
          disabled={record.isInstallingFfmpeg || isCaptureMode}
          style={{
            ...ROW1_BTN,
            color: isRecording
              ? "#FF3B30"
              : record.isInstallingFfmpeg
              ? "#f59e0b"
              : "var(--text-primary)",
            backgroundColor: isRecording
              ? "rgba(255,59,48,0.1)"
              : record.isInstallingFfmpeg
              ? "rgba(251,191,36,0.1)"
              : "transparent",
            cursor: isRecording
              ? "default"
              : record.isInstallingFfmpeg
              ? "wait"
              : "pointer",
          }}
        >
          {record.isInstallingFfmpeg ? (
            <Loader2 size={14} style={{ animation: "klipp-spin 1s linear infinite" }} />
          ) : (
            <Video size={14} />
          )}
          <span>Record</span>
        </button>
        <style>{`@keyframes klipp-spin { to { transform: rotate(360deg); } }`}</style>

        {/* ✕ Cancel */}
        <button
          title={cancelActive ? "Cancel" : "Nothing to cancel"}
          onClick={handleCancel}
          disabled={!cancelActive}
          style={{
            ...ROW1_BTN,
            color: cancelActive ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: cancelActive ? "pointer" : "default",
            opacity: cancelActive ? 1 : 0.5,
          }}
        >
          <X size={14} />
          <span>Cancel</span>
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ⋯ Options — native popup menu */}
        <button
          title="Options"
          onClick={(e) => showPillMenu("options", e.currentTarget)}
          style={{ ...ROW1_BTN, padding: 0, width: 32, justifyContent: "center" }}
        >
          <MoreHorizontal size={16} />
        </button>

        {/* ⤢ Expand */}
        <button
          title="Expand to full window"
          onClick={() => expandToFull()}
          style={{ ...ROW1_BTN, padding: 0, width: 32, justifyContent: "center" }}
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {/* Row 2 — helper text (fixed height so the pill doesn't reflow) */}
      <div
        data-tauri-drag-region
        style={{
          height: 34,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          fontSize: 12,
          color: "var(--text-secondary)",
          borderTop: "1px solid var(--border-color)",
        }}
      >
        {helperText}
      </div>

      {blockedModal && (
        <PermissionBlockedModal
          device={blockedModal}
          onClose={() => setBlockedModal(null)}
        />
      )}
    </div>
  );
}
