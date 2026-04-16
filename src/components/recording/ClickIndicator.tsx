import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useRecordingStore } from "../../stores/recordingStore";

interface MouseClickEvent {
  x: number;
  y: number;
  button: string;
}

export function ClickIndicator() {
  const { isRecording, recordingStartTime, addClickEvent } = useRecordingStore();

  // Start/stop mouse hook with recording
  useEffect(() => {
    if (!isRecording) return;

    invoke("start_mouse_hook").catch(console.error);

    return () => {
      invoke("stop_mouse_hook").catch(console.error);
    };
  }, [isRecording]);

  // Listen for mouse click events and store them
  useEffect(() => {
    if (!isRecording || !recordingStartTime) return;

    const unlisten = listen<MouseClickEvent>("mouse-click", (event) => {
      addClickEvent({
        x: event.payload.x,
        y: event.payload.y,
        button: event.payload.button,
        timeMs: Date.now() - recordingStartTime,
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isRecording, recordingStartTime, addClickEvent]);

  return null;
}
