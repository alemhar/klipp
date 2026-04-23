import { X } from "lucide-react";
import { APP_NAME } from "../../lib/constants";

interface PermissionBlockedModalProps {
  device: "camera" | "microphone";
  /** Re-opens the consent modal so the user can grant access. */
  onAllowNow: () => void;
  onClose: () => void;
}

const COPY = {
  camera: {
    title: "Camera access is off",
    intro: `${APP_NAME} can't use your webcam right now.`,
    osStep: "Privacy & Security → Camera",
    osDetails: [
      "Turn on Camera access (for the device)",
      "Turn on Let desktop apps access your camera",
    ],
  },
  microphone: {
    title: "Microphone access is off",
    intro: `${APP_NAME} can't use your microphone right now. The live audio-level indicator and the recording's mic track both depend on it.`,
    osStep: "Privacy & Security → Microphone",
    osDetails: [
      "Turn on Microphone access (for the device)",
      "Turn on Let desktop apps access your microphone",
    ],
  },
} as const;

/**
 * Shown when the user toggles CAM/MIC while access is denied. Covers two
 * recovery paths:
 *   1. App-level: clicking "Allow it now" re-opens the Klipp consent modal
 *      (common case — the user previously picked Don't allow).
 *   2. OS-level: if Windows Privacy & Security has blocked camera/mic
 *      globally, the app-level reset can't fix that — the user must toggle
 *      it in Windows Settings.
 *
 * Note: earlier releases of this modal walked the user through deleting the
 * WebView2 cache folder. That's no longer needed — the Rust-side
 * PermissionRequested handler now authorizes against our own stored consent,
 * so flipping consent back to "unknown" via "Allow it now" is all that's
 * required.
 */
export function PermissionBlockedModal({
  device,
  onAllowNow,
  onClose,
}: PermissionBlockedModalProps) {
  const copy = COPY[device];
  return (
    <div
      onClick={onClose}
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
        aria-labelledby="permission-blocked-title"
        style={{
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          borderRadius: 8,
          padding: 20,
          maxWidth: 480,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
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

        <h2
          id="permission-blocked-title"
          style={{ fontSize: 16, fontWeight: 600, margin: "0 0 10px" }}
        >
          {copy.title}
        </h2>

        <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 14px" }}>
          {copy.intro}
        </p>

        <div
          style={{
            padding: 12,
            borderRadius: 6,
            backgroundColor: "var(--bg-secondary, rgba(0,0,0,0.04))",
            margin: "0 0 14px",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              margin: "0 0 4px",
            }}
          >
            Windows blocking it instead?
          </p>
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
              color: "var(--text-secondary)",
            }}
          >
            If the prompt doesn't reappear after you click Allow it now, open{" "}
            <b>Windows Settings → {copy.osStep}</b> and make sure:
          </p>
          <ul
            style={{
              fontSize: 12,
              lineHeight: 1.55,
              margin: "4px 0 0",
              paddingLeft: 18,
              color: "var(--text-secondary)",
            }}
          >
            {copy.osDetails.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--border-color)",
              backgroundColor: "transparent",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onAllowNow}
            autoFocus
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "1px solid var(--accent-color)",
              backgroundColor: "var(--accent-color)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Allow it now
          </button>
        </div>
      </div>
    </div>
  );
}
