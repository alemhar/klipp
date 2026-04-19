import {
  Camera,
  Settings,
  Moon,
  Sun,
  Square,
  Maximize,
  Timer,
  ChevronDown,
  Video,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useCaptureStore } from "../../stores/captureStore";
import { useRecordingStore } from "../../stores/recordingStore";
import { AudioLevelIndicator } from "../recording/AudioLevelIndicator";
import { CameraBlockedModal } from "../recording/CameraBlockedModal";
import { useCameraPermission } from "../../hooks/useCameraPermission";
import { APP_NAME } from "../../lib/constants";
import type { CaptureMode, DelayOption } from "../../types/capture";

const CAPTURE_MODES: {
  mode: CaptureMode;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}[] = [
  { mode: "rectangular", label: "Selection", icon: <Square size={14} /> },
  { mode: "fullscreen", label: "Fullscreen", icon: <Maximize size={14} /> },
  {
    mode: "window",
    label: "Window",
    icon: <Square size={14} />,
    disabled: true,
    disabledReason:
      "Window capture — coming in a future release.",
  },
];

const DELAY_OPTIONS: { value: DelayOption; label: string }[] = [
  { value: 0, label: "No delay" },
  { value: 3, label: "3 seconds" },
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
];

function DropdownButton({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        title={label}
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          height: 28,
          padding: "0 6px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          backgroundColor: "transparent",
          color: "var(--text-primary)",
          fontSize: 12,
        }}
      >
        {icon}
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              padding: 4,
              minWidth: 140,
              zIndex: 100,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export function TitleBar() {
  const { resolvedTheme, setTheme, setResolvedTheme, setShowSettings, setIsCaptureMode } =
    useUIStore();
  const { mode, delay, setMode, setDelay } = useCaptureStore();
  const {
    isRecording,
    setIsSelectingRegion,
    checkFfmpeg,
    saveWindowState,
    webcamEnabled,
    setWebcamEnabled,
    // System audio is deferred to a future release — see SYS button TODO below.
    // Store fields `systemAudioEnabled`, `setSystemAudioEnabled`, `hasSystemAudioCapture`
    // remain available; re-destructure them when re-enabling the feature.
    micAudioEnabled,
    setMicAudioEnabled,
    hasMicrophone,
  } = useRecordingStore();

  const toggleTheme = () => {
    const next = resolvedTheme === "light" ? "dark" : "light";
    setTheme(next);
    setResolvedTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleNewCapture = () => {
    setIsCaptureMode(true);
  };

  const [isInstallingFfmpeg, setIsInstallingFfmpeg] = useState(false);
  const [showCameraBlockedModal, setShowCameraBlockedModal] = useState(false);
  const cameraPermission = useCameraPermission();
  const cameraBlocked = cameraPermission === "denied";

  // Check webcam availability and fall back gracefully if the user's camera
  // permission is off. Called after FFmpeg is confirmed present.
  const proceedToRecordFlow = async () => {
    if (webcamEnabled) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const webcams = await invoke<string[]>("list_webcams");
        if (webcams.length === 0) {
          alert(
            "No webcam detected.\n\n" +
            "If you have a camera, make sure:\n" +
            "1. Go to Windows Settings > Privacy > Camera\n" +
            "2. Turn ON 'Allow desktop apps to access your camera'\n\n" +
            "Recording will continue without webcam."
          );
          setWebcamEnabled(false);
        }
      } catch {
        setWebcamEnabled(false);
      }
    }
    await saveWindowState();
    setIsSelectingRegion(true);
  };

  const handleRecordClick = async () => {
    if (isRecording || isInstallingFfmpeg) return;
    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) {
      const shouldDownload = confirm(
        "Screen recording requires FFmpeg (a free, open-source video encoder).\n\n" +
        "Klipp will download it automatically (one-time only, ~30MB).\n" +
        "This may take a minute depending on your internet speed.\n\n" +
        "When the install finishes, Klipp will continue to the region selector."
      );
      if (!shouldDownload) return;
      setIsInstallingFfmpeg(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("download_ffmpeg");
      } catch (e) {
        setIsInstallingFfmpeg(false);
        alert(
          `Failed to download FFmpeg: ${e}\n\n` +
          "You can install it manually via:\n  winget install Gyan.FFmpeg"
        );
        return;
      }
      setIsInstallingFfmpeg(false);
      // Auto-proceed so the user's original intent (start recording) completes
      // without a second click.
    }
    await proceedToRecordFlow();
  };

  const currentModeInfo = CAPTURE_MODES.find((m) => m.mode === mode) || CAPTURE_MODES[0];

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

      {/* Capture controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {/* Capture mode selector */}
        <DropdownButton label="Capture Mode" icon={currentModeInfo.icon}>
          {CAPTURE_MODES.map((m) => (
            <button
              key={m.mode}
              onClick={() => !m.disabled && setMode(m.mode)}
              disabled={m.disabled}
              title={m.disabled ? m.disabledReason : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: "none",
                cursor: m.disabled ? "not-allowed" : "pointer",
                backgroundColor:
                  mode === m.mode && !m.disabled
                    ? "var(--accent-color)"
                    : "transparent",
                color: m.disabled
                  ? "var(--text-tertiary, #999)"
                  : mode === m.mode
                  ? "#fff"
                  : "var(--text-primary)",
                fontSize: 12,
                textAlign: "left",
                opacity: m.disabled ? 0.55 : 1,
              }}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </DropdownButton>

        {/* Delay selector */}
        <DropdownButton
          label="Capture Delay"
          icon={
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Timer size={14} />
              {delay > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600 }}>{delay}s</span>
              )}
            </div>
          }
        >
          {DELAY_OPTIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDelay(d.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                backgroundColor: delay === d.value ? "var(--accent-color)" : "transparent",
                color: delay === d.value ? "#fff" : "var(--text-primary)",
                fontSize: 12,
                textAlign: "left",
              }}
            >
              {d.label}
            </button>
          ))}
        </DropdownButton>

        {/* Capture button */}
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
              setShowCameraBlockedModal(true);
              return;
            }
            setWebcamEnabled(!webcamEnabled);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
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
          }}
        >
          CAM
        </button>

        {/* System audio toggle — deferred to a future release.
            TODO(next release): re-enable once we implement system-audio capture
            without requiring the third-party "virtual-audio-capturer" DirectShow
            driver (e.g. via native WASAPI loopback). See Plan 03 doc. The state,
            store fields (hasSystemAudioCapture, systemAudioEnabled) and Rust
            backend support are already wired — just remove this override. */}
        <button
          title="System Audio — coming in a future release"
          onClick={() => { /* intentionally disabled until next release */ }}
          disabled
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "none",
            cursor: "not-allowed",
            backgroundColor: "transparent",
            color: "var(--text-tertiary, #999)",
            fontSize: 11,
            fontWeight: 600,
            opacity: 0.5,
          }}
        >
          SYS
        </button>

        {/* Microphone toggle — disabled if no audio input device exists */}
        <button
          title={
            !hasMicrophone
              ? "No microphone detected"
              : micAudioEnabled
              ? "Microphone: ON"
              : "Microphone: OFF"
          }
          onClick={() => hasMicrophone && setMicAudioEnabled(!micAudioEnabled)}
          disabled={!hasMicrophone}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "none",
            cursor: hasMicrophone ? "pointer" : "not-allowed",
            backgroundColor:
              micAudioEnabled && hasMicrophone ? "rgba(0,120,212,0.15)" : "transparent",
            color: !hasMicrophone
              ? "var(--text-tertiary, #999)"
              : micAudioEnabled
              ? "var(--accent-color)"
              : "var(--text-secondary)",
            fontSize: 11,
            fontWeight: 600,
            opacity: hasMicrophone ? 1 : 0.5,
          }}
        >
          MIC
        </button>

        {/* Audio level indicator — visible when MIC is enabled */}
        {micAudioEnabled && hasMicrophone && (
          <AudioLevelIndicator active={micAudioEnabled} width={44} height={20} />
        )}

        {/* Record button */}
        <button
          title={
            isInstallingFfmpeg
              ? "Installing FFmpeg... (one-time ~30MB download)"
              : isRecording
              ? "Recording..."
              : "Screen Record"
          }
          onClick={handleRecordClick}
          disabled={isInstallingFfmpeg}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "none",
            cursor: isRecording
              ? "default"
              : isInstallingFfmpeg
              ? "wait"
              : "pointer",
            backgroundColor: isRecording
              ? "rgba(255,59,48,0.15)"
              : isInstallingFfmpeg
              ? "rgba(251, 191, 36, 0.15)"
              : "transparent",
            color: isRecording
              ? "#FF3B30"
              : isInstallingFfmpeg
              ? "#f59e0b"
              : "var(--text-primary)",
          }}
        >
          {isInstallingFfmpeg ? (
            <Loader2
              size={16}
              style={{ animation: "klipp-spin 1s linear infinite" }}
            />
          ) : (
            <Video size={16} />
          )}
        </button>
        <style>{`@keyframes klipp-spin { to { transform: rotate(360deg); } }`}</style>

        <div style={{ width: 1, height: 20, backgroundColor: "var(--border-color)", margin: "0 2px" }} />

        {/* Theme toggle */}
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

        {/* Settings */}
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

      {showCameraBlockedModal && (
        <CameraBlockedModal onClose={() => setShowCameraBlockedModal(false)} />
      )}
    </div>
  );
}
