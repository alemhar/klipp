import { useEffect, useState } from "react";

export type CameraPermission = "granted" | "denied" | "prompt" | "unknown";

/**
 * Observes the camera permission state via the Permissions API.
 *
 * WebView2 (the Chromium runtime Tauri uses on Windows) treats the overlay
 * webview like any other web page and prompts the user for camera access on
 * first `getUserMedia` call. If the user blocks, the permission persists per
 * origin and there's no obvious way to recover from inside the app — this
 * hook lets the UI surface a helpful state instead of silently failing.
 *
 * Returns "unknown" if the browser doesn't support `navigator.permissions`.
 */
export function useCameraPermission(): CameraPermission {
  const [permission, setPermission] = useState<CameraPermission>("unknown");

  useEffect(() => {
    if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
      return;
    }

    let status: PermissionStatus | null = null;
    const handleChange = () => {
      if (status) setPermission(status.state as CameraPermission);
    };

    navigator.permissions
      // "camera" is a widely supported PermissionName but TypeScript's lib may
      // not include it in the narrow union — cast through PermissionName.
      .query({ name: "camera" as PermissionName })
      .then((result) => {
        status = result;
        setPermission(result.state as CameraPermission);
        result.addEventListener("change", handleChange);
      })
      .catch(() => {
        setPermission("unknown");
      });

    return () => {
      if (status) status.removeEventListener("change", handleChange);
    };
  }, []);

  return permission;
}
