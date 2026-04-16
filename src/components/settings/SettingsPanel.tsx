import { X } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Theme } from "../../types/settings";

export function SettingsPanel() {
  const { setShowSettings } = useUIStore();
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={() => setShowSettings(false)}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: 12,
          width: 480,
          maxHeight: "80vh",
          overflow: "auto",
          padding: 24,
          border: "1px solid var(--border-color)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-primary)",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Theme */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: "block" }}>
              Theme
            </label>
            <select
              value={settings.theme}
              onChange={(e) => {
                const theme = e.target.value as Theme;
                updateSettings({ theme });
                const resolved = theme === "system"
                  ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
                  : theme;
                document.documentElement.setAttribute("data-theme", resolved);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          {/* Auto-copy to clipboard */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Auto-copy to clipboard</label>
            <input
              type="checkbox"
              checked={settings.autoCopyToClipboard}
              onChange={(e) => updateSettings({ autoCopyToClipboard: e.target.checked })}
            />
          </div>

          {/* Auto-save */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Auto-save screenshots</label>
            <input
              type="checkbox"
              checked={settings.autoSave}
              onChange={(e) => updateSettings({ autoSave: e.target.checked })}
            />
          </div>

          {/* Default format */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: "block" }}>
              Default format
            </label>
            <select
              value={settings.defaultFormat}
              onChange={(e) => updateSettings({ defaultFormat: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            >
              <option value="png">PNG</option>
              <option value="jpg">JPEG</option>
              <option value="gif">GIF</option>
              <option value="bmp">BMP</option>
            </select>
          </div>

          {/* Capture shortcut */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: "block" }}>
              Capture shortcut
            </label>
            <input
              type="text"
              value={settings.captureShortcut}
              readOnly
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
