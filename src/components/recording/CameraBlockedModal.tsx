import { X } from "lucide-react";

interface CameraBlockedModalProps {
  onClose: () => void;
}

/**
 * Modal shown when the user clicks the CAM toggle while camera access is
 * blocked in WebView2. Explains two recovery paths:
 *   1. Windows-level camera access (Settings → Privacy & Security → Camera)
 *   2. WebView2-level permission (clearing the per-origin Block decision)
 */
export function CameraBlockedModal({ onClose }: CameraBlockedModalProps) {
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
        style={{
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          borderRadius: 8,
          padding: 20,
          maxWidth: 520,
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

        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>
          Camera access is blocked
        </h2>

        <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 12px" }}>
          Klipp can't use your webcam because access was denied. Try the steps
          below to re-enable it.
        </p>

        <h3 style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 6px" }}>
          1. Allow camera at the Windows level
        </h3>
        <ol style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px", paddingLeft: 20 }}>
          <li>Open <b>Windows Settings → Privacy &amp; Security → Camera</b></li>
          <li>Turn on <b>Camera access</b> (for the device)</li>
          <li>Turn on <b>Let desktop apps access your camera</b></li>
        </ol>

        <h3 style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 6px" }}>
          2. Reset the in-app permission
        </h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 8px" }}>
          If Windows settings are fine but the camera is still blocked, WebView2
          remembered your earlier <i>Block</i> decision. Reset it by:
        </p>
        <ol style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px", paddingLeft: 20 }}>
          <li>Close Klipp completely</li>
          <li>
            Delete the WebView2 cache folder at:
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                backgroundColor: "var(--bg-secondary, rgba(0,0,0,0.05))",
                padding: "6px 8px",
                borderRadius: 4,
                margin: "4px 0",
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              %LOCALAPPDATA%\com.fuselabs.klipp\EBWebView\
            </div>
          </li>
          <li>Relaunch Klipp and click <b>Allow</b> when the camera prompt appears</li>
        </ol>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--accent-color)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
