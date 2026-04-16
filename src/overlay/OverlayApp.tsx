import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface ClickRipple {
  id: number;
  x: number;
  y: number;
  button: string;
}

export default function OverlayApp() {
  const [ripples, setRipples] = useState<ClickRipple[]>([]);

  useEffect(() => {
    // Start the mouse hook when overlay mounts
    invoke("start_mouse_hook").catch(console.error);

    const unlisten = listen<{ x: number; y: number; button: string }>(
      "mouse-click",
      (event) => {
        const { x, y, button } = event.payload;
        const id = Date.now() + Math.random();

        setRipples((prev) => [...prev.slice(-9), { id, x, y, button }]);

        // Auto-remove after animation completes
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
      }
    );

    return () => {
      invoke("stop_mouse_hook").catch(console.error);
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "transparent",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          style={{
            position: "absolute",
            left: ripple.x - 20,
            top: ripple.y - 20,
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `3px solid ${ripple.button === "left" ? "#facc15" : "#60a5fa"}`,
            background:
              ripple.button === "left"
                ? "rgba(250, 204, 21, 0.3)"
                : "rgba(96, 165, 250, 0.3)",
            pointerEvents: "none",
            animation: "ripple-expand 0.6s ease-out forwards",
          }}
        />
      ))}

      <style>{`
        @keyframes ripple-expand {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
