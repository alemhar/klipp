import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

export function useGlobalShortcut(
  shortcut: string,
  callback: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    let registered = false;

    const setup = async () => {
      try {
        await register(shortcut, (event) => {
          if (event.state === "Pressed") {
            callback();
          }
        });
        registered = true;
      } catch (e) {
        console.error(`Failed to register shortcut ${shortcut}:`, e);
      }
    };

    setup();

    return () => {
      if (registered) {
        unregister(shortcut).catch(console.error);
      }
    };
  }, [shortcut, callback, enabled]);
}
