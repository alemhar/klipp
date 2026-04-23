import { Camera, Mic, X } from "lucide-react";
import { APP_NAME } from "../../lib/constants";

type Device = "camera" | "microphone";

interface PermissionConsentModalProps {
  device: Device;
  onAllow: () => void;
  onDeny: () => void;
}

const COPY: Record<
  Device,
  { title: string; body: string; icon: React.ReactNode; purpose: string }
> = {
  camera: {
    icon: <Camera size={28} />,
    title: `${APP_NAME} would like to use your camera`,
    purpose: "the picture-in-picture webcam bubble during screen recording",
    body:
      `${APP_NAME} needs access to your webcam to show the picture-in-picture bubble on top of your recording. ` +
      "The feed stays on your device — we don't send it anywhere.",
  },
  microphone: {
    icon: <Mic size={28} />,
    title: `${APP_NAME} would like to use your microphone`,
    purpose: "narrating your recording and showing the live audio level",
    body:
      `${APP_NAME} needs access to your microphone to mix your voice into the recording and power the live ` +
      "audio-level indicator next to the MIC toggle. Audio stays on your device.",
  },
};

/**
 * First-use consent prompt shown when the user toggles CAM/MIC for the first
 * time. Intentionally branded as Klipp (not the Chromium WebView2 dialog) so
 * the user understands what they're granting and why.
 *
 * Replaces the default WebView2 "localhost wants to use your camera/microphone"
 * prompt, which the Rust-side PermissionRequested handler suppresses.
 */
export function PermissionConsentModal({
  device,
  onAllow,
  onDeny,
}: PermissionConsentModalProps) {
  const copy = COPY[device];
  return (
    <div
      onClick={onDeny}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-consent-title"
        style={{
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          borderRadius: 10,
          padding: 22,
          maxWidth: 440,
          width: "90%",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        <button
          onClick={onDeny}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            padding: 4,
            display: "flex",
          }}
        >
          <X size={16} />
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: "rgba(0, 120, 212, 0.12)",
              color: "var(--accent-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {copy.icon}
          </div>
          <h2
            id="permission-consent-title"
            style={{
              fontSize: 15,
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {copy.title}
          </h2>
        </div>

        <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 14px" }}>
          {copy.body}
        </p>

        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            margin: "0 0 18px",
            color: "var(--text-secondary)",
          }}
        >
          You can change your mind any time from the {device === "camera" ? "CAM" : "MIC"} toggle.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onDeny}
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: "1px solid var(--border-color)",
              backgroundColor: "transparent",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Don't allow
          </button>
          <button
            onClick={onAllow}
            autoFocus
            style={{
              padding: "7px 16px",
              borderRadius: 6,
              border: "1px solid var(--accent-color)",
              backgroundColor: "var(--accent-color)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Allow {device === "camera" ? "camera" : "microphone"}
          </button>
        </div>

        <p
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            margin: "14px 0 0",
            color: "var(--text-secondary)",
          }}
          title={`Used for ${copy.purpose}`}
        >
          Only used for {copy.purpose}.
        </p>
      </div>
    </div>
  );
}
