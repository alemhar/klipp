import { Download, AlertTriangle, X } from "lucide-react";
import { useFfmpegStore } from "../../stores/ffmpegStore";
import { APP_NAME } from "../../lib/constants";

/**
 * Klipp-branded modal shown when a recording attempt needs FFmpeg installed.
 * Replaces the unbranded `confirm()` / `alert()` dialogs that the previous
 * minimal-fix flow used.
 *
 * Renders two states driven by `useFfmpegStore`:
 *   - "prompt": first-run explanation + Install / Not now
 *   - "error":  install failed, shows message + `winget` fallback + Try again
 *
 * During the download itself the modal is closed and the Record button shows
 * its existing amber spinner state (isInstalling).
 */
export function FfmpegInstallModal() {
  const modal = useFfmpegStore((s) => s.modal);
  const errorMessage = useFfmpegStore((s) => s.errorMessage);
  const confirmInstall = useFfmpegStore((s) => s.confirmInstall);
  const retryInstall = useFfmpegStore((s) => s.retryInstall);
  const cancel = useFfmpegStore((s) => s.cancel);

  if (modal === null) return null;

  const isPrompt = modal === "prompt";

  return (
    <div
      onClick={cancel}
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
        aria-labelledby="ffmpeg-install-title"
        style={{
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          borderRadius: 10,
          padding: 22,
          maxWidth: 460,
          width: "90%",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        <button
          onClick={cancel}
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
              backgroundColor: isPrompt
                ? "rgba(0, 120, 212, 0.12)"
                : "rgba(220, 38, 38, 0.12)",
              color: isPrompt ? "var(--accent-color)" : "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isPrompt ? <Download size={24} /> : <AlertTriangle size={24} />}
          </div>
          <h2
            id="ffmpeg-install-title"
            style={{
              fontSize: 15,
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {isPrompt
              ? `${APP_NAME} needs FFmpeg to record your screen`
              : `${APP_NAME} couldn't install FFmpeg`}
          </h2>
        </div>

        {isPrompt ? (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 8px" }}>
              FFmpeg is a free, open-source video encoder that powers screen
              recording. {APP_NAME} will download it automatically — a one-time
              install, about 30&nbsp;MB.
            </p>
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                margin: "0 0 18px",
                color: "var(--text-secondary)",
              }}
            >
              This may take up to a minute. Once it's done, {APP_NAME} will
              continue to the region selector automatically.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px" }}>
              {errorMessage ??
                "The download didn't complete. Check your internet connection and try again."}
            </p>
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                margin: "0 0 6px",
                color: "var(--text-secondary)",
              }}
            >
              Still stuck? You can install it manually with:
            </p>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                backgroundColor: "var(--bg-secondary, rgba(0,0,0,0.05))",
                padding: "6px 8px",
                borderRadius: 4,
                margin: "0 0 18px",
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              winget install Gyan.FFmpeg
            </div>
          </>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={cancel}
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
            {isPrompt ? "Not now" : "Dismiss"}
          </button>
          <button
            onClick={isPrompt ? confirmInstall : retryInstall}
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
            {isPrompt ? "Install FFmpeg" : "Try again"}
          </button>
        </div>
      </div>
    </div>
  );
}
