import {
  Scissors,
  Settings,
  Moon,
  Sun,
  Square,
  Maximize,
  Monitor,
  Minimize2,
  Clock,
  ChevronDown,
  Video,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useUIStore } from "../../stores/uiStore";
import { useCaptureStore } from "../../stores/captureStore";
import { useRecordingStore } from "../../stores/recordingStore";
import { useWindowModeStore } from "../../stores/windowModeStore";
import { useRecordFlow } from "../../hooks/useRecordFlow";
import { AudioLevelIndicator } from "../recording/AudioLevelIndicator";
import { PermissionBlockedModal } from "../recording/PermissionBlockedModal";
import { useMediaPermission } from "../../hooks/useMediaPermission";
import { APP_NAME } from "../../lib/constants";
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

const NAV_BTN: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  height: 30,
  padding: "0 10px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "var(--text-primary)",
  fontSize: 12,
};

const ICON_BTN: React.CSSProperties = {
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
};

export function TitleBar() {
  const { resolvedTheme, setTheme, setResolvedTheme, setShowSettings, setIsCaptureMode, isCaptureMode } =
    useUIStore();
  const { mode, delay, setMode, setDelay } = useCaptureStore();
  const {
    isRecording,
    stopRecording,
    webcamEnabled,
    setWebcamEnabled,
    // System audio is deferred to a future release — see SYS button TODO below.
    micAudioEnabled,
    setMicAudioEnabled,
    hasMicrophone,
  } = useRecordingStore();
  const record = useRecordFlow();
  const isInstallingFfmpeg = record.isInstallingFfmpeg;
  const handleRecordClick = record.onClick;

  const [blockedModal, setBlockedModal] = useState<"camera" | "microphone" | null>(null);
  const cameraPermission = useMediaPermission("camera");
  const microphonePermission = useMediaPermission("microphone");
  const cameraBlocked = cameraPermission === "denied";
  const microphoneBlocked = microphonePermission === "denied";

  // Native pill-menu events arrive via Tauri emit. Listen here so the same
  // Mode/Delay dropdowns work in full mode exactly like in pill mode.
  const handlersRef = useRef({
    setMode,
    setDelay,
    setMicAudioEnabled,
    setWebcamEnabled,
    setBlockedModal,
    microphonePermission,
    cameraPermission,
  });
  handlersRef.current = {
    setMode,
    setDelay,
    setMicAudioEnabled,
    setWebcamEnabled,
    setBlockedModal,
    microphonePermission,
    cameraPermission,
  };

  useEffect(() => {
    const unlistenPromise = listen<string>("pill-menu-selected", (event) => {
      const id = event.payload;
      const h = handlersRef.current;
      if (id.startsWith("pill-mode:")) {
        h.setMode(id.substring("pill-mode:".length) as CaptureMode);
      } else if (id.startsWith("pill-delay:")) {
        const n = parseInt(id.substring("pill-delay:".length), 10);
        h.setDelay(n as DelayOption);
      } else if (id === "pill-opts:mic") {
        const currentlyOn = useRecordingStore.getState().micAudioEnabled;
        if (!currentlyOn && h.microphonePermission === "denied") {
          h.setBlockedModal("microphone");
        } else {
          h.setMicAudioEnabled(!currentlyOn);
        }
      } else if (id === "pill-opts:webcam") {
        const currentlyOn = useRecordingStore.getState().webcamEnabled;
        if (!currentlyOn && h.cameraPermission === "denied") {
          h.setBlockedModal("camera");
        } else {
          h.setWebcamEnabled(!currentlyOn);
        }
      } else if (id === "pill-opts:prefs") {
        useUIStore.getState().setShowSettings(true);
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  const showPillMenu = (kind: "mode" | "delay", btn: HTMLElement) => {
    const rect = btn.getBoundingClientRect();
    invoke("show_pill_menu", {
      kind,
      x: rect.left,
      y: rect.bottom + 2,
      currentMode: mode,
      currentDelay: delay,
      micEnabled: micAudioEnabled,
      webcamEnabled,
    }).catch((e) => console.error("show_pill_menu failed:", e));
  };

  const toggleTheme = () => {
    const next = resolvedTheme === "light" ? "dark" : "light";
    setTheme(next);
    setResolvedTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleNewCapture = () => {
    if (isCaptureMode || isRecording) return;
    setIsCaptureMode(true);
  };

  const cancelActive = isCaptureMode || isRecording;
  const handleCancel = () => {
    if (isRecording) stopRecording();
    else if (isCaptureMode) setIsCaptureMode(false);
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
        height: 38,
      }}
    >
      {/* App name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{APP_NAME}</span>
      </div>

      {/* Standard navs — same sequence as pill: New → Mode → Delay → Record → Cancel */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {/* ✂ New */}
        <button
          title="New Capture (Ctrl+Shift+S)"
          onClick={handleNewCapture}
          disabled={isCaptureMode || isRecording}
          style={{
            ...NAV_BTN,
            color: isCaptureMode || isRecording ? "var(--text-secondary)" : "#dc2626",
            fontWeight: 600,
          }}
        >
          <Scissors size={16} />
          <span>New</span>
        </button>

        {/* ▾ Mode */}
        <button
          title="Mode"
          onClick={(e) => showPillMenu("mode", e.currentTarget)}
          style={NAV_BTN}
        >
          {CAPTURE_MODE_ICONS[mode]}
          <span>Mode</span>
          <ChevronDown size={12} />
        </button>

        {/* ⏱ Delay */}
        <button
          title="Delay"
          onClick={(e) => showPillMenu("delay", e.currentTarget)}
          style={NAV_BTN}
        >
          <Clock size={14} />
          <span>{DELAY_LABELS[delay] ?? "Delay"}</span>
          <ChevronDown size={12} />
        </button>

        {/* ⏺ Record */}
        <button
          title={
            isInstallingFfmpeg
              ? "Installing FFmpeg... (one-time ~30MB download)"
              : isRecording
              ? "Recording..."
              : "Screen Record"
          }
          onClick={handleRecordClick}
          disabled={isInstallingFfmpeg || isCaptureMode}
          style={{
            ...NAV_BTN,
            color: isRecording
              ? "#FF3B30"
              : isInstallingFfmpeg
              ? "#f59e0b"
              : "var(--text-primary)",
            backgroundColor: isRecording
              ? "rgba(255,59,48,0.1)"
              : isInstallingFfmpeg
              ? "rgba(251,191,36,0.1)"
              : "transparent",
            cursor: isRecording
              ? "default"
              : isInstallingFfmpeg
              ? "wait"
              : "pointer",
          }}
        >
          {isInstallingFfmpeg ? (
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
            ...NAV_BTN,
            color: cancelActive ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: cancelActive ? "pointer" : "default",
            opacity: cancelActive ? 1 : 0.5,
          }}
        >
          <X size={14} />
          <span>Cancel</span>
        </button>
      </div>

      {/* Window-mode extras — placed after the standard navs */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {/* Webcam toggle */}
        <button
          title={
            cameraBlocked
              ? "Camera blocked — click for help re-enabling"
              : webcamEnabled
              ? "Webcam: ON"
              : "Webcam: OFF"
          }
          onClick={() => {
            if (cameraBlocked) {
              setBlockedModal("camera");
              return;
            }
            setWebcamEnabled(!webcamEnabled);
          }}
          style={{
            ...ICON_BTN,
            backgroundColor: cameraBlocked
              ? "rgba(245, 158, 11, 0.15)"
              : webcamEnabled
              ? "rgba(0,120,212,0.15)"
              : "transparent",
            color: cameraBlocked
              ? "#f59e0b"
              : webcamEnabled
              ? "var(--accent-color)"
              : "var(--text-secondary)",
            fontSize: 11,
            fontWeight: 600,
            width: 36,
          }}
        >
          CAM
        </button>

        {/* System audio toggle — deferred to a future release.
            TODO(next release): re-enable once we implement system-audio capture
            without requiring the third-party "virtual-audio-capturer" DirectShow
            driver (e.g. via native WASAPI loopback). See Plan 03 doc. */}
        <button
          title="System Audio — coming in a future release"
          onClick={() => { /* intentionally disabled until next release */ }}
          disabled
          style={{
            ...ICON_BTN,
            color: "var(--text-secondary)",
            fontSize: 11,
            fontWeight: 600,
            width: 36,
            cursor: "not-allowed",
            opacity: 0.5,
          }}
        >
          SYS
        </button>

        {/* Microphone toggle */}
        <button
          title={
            microphoneBlocked
              ? "Microphone blocked — click for help re-enabling"
              : !hasMicrophone
              ? "No microphone detected"
              : micAudioEnabled
              ? "Microphone: ON"
              : "Microphone: OFF"
          }
          onClick={() => {
            if (microphoneBlocked) {
              setBlockedModal("microphone");
              return;
            }
            if (!hasMicrophone) return;
            setMicAudioEnabled(!micAudioEnabled);
          }}
          disabled={!hasMicrophone && !microphoneBlocked}
          style={{
            ...ICON_BTN,
            backgroundColor: microphoneBlocked
              ? "rgba(245, 158, 11, 0.15)"
              : micAudioEnabled
              ? "rgba(0,120,212,0.15)"
              : "transparent",
            color: microphoneBlocked
              ? "#f59e0b"
              : !hasMicrophone
              ? "var(--text-secondary)"
              : micAudioEnabled
              ? "var(--accent-color)"
              : "var(--text-secondary)",
            opacity: !hasMicrophone && !microphoneBlocked ? 0.4 : 1,
            cursor: !hasMicrophone && !microphoneBlocked ? "not-allowed" : "pointer",
            fontSize: 11,
            fontWeight: 600,
            width: 36,
          }}
        >
          MIC
        </button>

        {/* Audio level indicator — visible when MIC is enabled */}
        {micAudioEnabled && hasMicrophone && (
          <AudioLevelIndicator active={micAudioEnabled} width={44} height={20} />
        )}

        <div style={{ width: 1, height: 20, backgroundColor: "var(--border-color)", margin: "0 4px" }} />

        {/* Theme toggle */}
        <button title="Toggle Theme" onClick={toggleTheme} style={ICON_BTN}>
          {resolvedTheme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Settings */}
        <button title="Settings" onClick={() => setShowSettings(true)} style={ICON_BTN}>
          <Settings size={16} />
        </button>

        {/* Collapse to pill */}
        <button
          title="Collapse to compact pill"
          onClick={() => useWindowModeStore.getState().collapseToPill()}
          style={ICON_BTN}
        >
          <Minimize2 size={16} />
        </button>
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
