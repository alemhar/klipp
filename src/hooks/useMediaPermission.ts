import { useEffect, useState } from "react";

export type MediaPermissionState = "granted" | "denied" | "prompt" | "unknown";

/**
 * Observes camera or microphone permission state via the Permissions API.
 *
 * WebView2 (the Chromium runtime Tauri uses on Windows) treats the overlay
 * webview like any other web page and prompts the user for camera/mic access
 * on first `getUserMedia` call. If the user blocks, the permission persists
 * per origin and there's no obvious way to recover from inside the app —
 * this hook lets the UI surface a helpful state instead of silently failing.
 *
 * Returns "unknown" if the browser doesn't support `navigator.permissions`.
 */
export function useMediaPermission(
  name: "camera" | "microphone"
): MediaPermissionState {
  const [permission, setPermission] = useState<MediaPermissionState>("unknown");

  useEffect(() => {
    if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
      return;
    }

    let status: PermissionStatus | null = null;
    const handleChange = () => {
      if (status) setPermission(status.state as MediaPermissionState);
    };

    navigator.permissions
      // "camera"/"microphone" are widely supported but TypeScript's lib narrow
      // union doesn't include them — cast through PermissionName.
      .query({ name: name as PermissionName })
      .then((result) => {
        status = result;
        setPermission(result.state as MediaPermissionState);
        result.addEventListener("change", handleChange);
      })
      .catch(() => {
        setPermission("unknown");
      });

    return () => {
      if (status) status.removeEventListener("change", handleChange);
    };
  }, [name]);

  return permission;
}
