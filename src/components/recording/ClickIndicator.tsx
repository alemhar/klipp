import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useRecordingStore } from "../../stores/recordingStore";

interface ClickRipple {
  id: number;
  x: number;
  y: number;
  button: string;
  timestamp: number;
}

interface MouseClickEvent {
  x: number;
  y: number;
  button: string;
}

export function ClickIndicator() {
  const { isRecording } = useRecordingStore();
  const [ripples, setRipples] = useState<ClickRipple[]>([]);

  // Start/stop mouse hook with recording
  useEffect(() => {
    if (!isRecording) return;

    invoke("start_mouse_hook").catch(console.error);

    return () => {
      invoke("stop_mouse_hook").catch(console.error);
    };
  }, [isRecording]);

  // Listen for mouse click events
  useEffect(() => {
    if (!isRecording) return;

    const unlisten = listen<MouseClickEvent>("mouse-click", (event) => {
      const ripple: ClickRipple = {
        id: Date.now() + Math.random(),
        x: event.payload.x,
        y: event.payload.y,
        button: event.payload.button,
        timestamp: Date.now(),
      };
      setRipples((prev) => [...prev, ripple]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
      }, 600);
    });

    return () => {
      unlisten.then((fn) => fn());
      setRipples([]);
    };
  }, [isRecording]);

  if (!isRecording || ripples.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes click-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0.3);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          style={{
            position: "fixed",
            left: ripple.x,
            top: ripple.y,
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `3px solid ${ripple.button === "left" ? "#FFD500" : ripple.button === "right" ? "#0078D4" : "#FF6B00"}`,
            backgroundColor: `${ripple.button === "left" ? "rgba(255,213,0,0.2)" : ripple.button === "right" ? "rgba(0,120,212,0.2)" : "rgba(255,107,0,0.2)"}`,
            pointerEvents: "none",
            zIndex: 99999,
            animation: "click-ripple 0.6s ease-out forwards",
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </>
  );
}
