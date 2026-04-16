import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface RecordingConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  fps: number;
  outputPath: string;
  captureAudio: boolean;
}

export interface ClickEvent {
  x: number;
  y: number;
  button: string;
  timeMs: number; // milliseconds since recording started
}

interface SavedWindowState {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface RecordingState {
  isRecording: boolean;
  isSelectingRegion: boolean;
  hasFfmpeg: boolean | null;
  elapsedSeconds: number;
  config: RecordingConfig | null;
  savedWindowState: SavedWindowState | null;
  clickEvents: ClickEvent[];
  recordingStartTime: number | null;

  checkFfmpeg: () => Promise<boolean>;
  setIsSelectingRegion: (v: boolean) => void;
  saveWindowState: () => Promise<void>;
  addClickEvent: (event: ClickEvent) => void;
  startRecording: (config: RecordingConfig) => Promise<void>;
  stopRecording: () => Promise<void>;
  tick: () => void;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  isRecording: false,
  isSelectingRegion: false,
  hasFfmpeg: null,
  elapsedSeconds: 0,
  config: null,
  savedWindowState: null,
  clickEvents: [],
  recordingStartTime: null,

  checkFfmpeg: async () => {
    try {
      const result = await invoke<boolean>("check_ffmpeg");
      set({ hasFfmpeg: result });
      return result;
    } catch {
      set({ hasFfmpeg: false });
      return false;
    }
  },

  setIsSelectingRegion: (v) => set({ isSelectingRegion: v }),

  addClickEvent: (event) =>
    set((s) => ({ clickEvents: [...s.clickEvents, event] })),

  // Save the current window size/position BEFORE any recording flow starts
  // Only save if we don't already have a saved state (prevent overwriting)
  saveWindowState: async () => {
    if (get().savedWindowState) return;
    const mainWindow = getCurrentWindow();
    const size = await mainWindow.innerSize();
    const pos = await mainWindow.outerPosition();
    const scaleFactor = await mainWindow.scaleFactor();
    const state = {
      width: Math.round(size.width / scaleFactor),
      height: Math.round(size.height / scaleFactor),
      x: Math.round(pos.x / scaleFactor),
      y: Math.round(pos.y / scaleFactor),
    };
    console.log("Saved window state:", state);
    set({ savedWindowState: state });
  },

  startRecording: async (config) => {
    try {
      await invoke("start_recording", { config });
      set({ isRecording: true, elapsedSeconds: 0, config, clickEvents: [], recordingStartTime: Date.now() });
    } catch (e) {
      console.error("Failed to start recording:", e);
      throw e;
    }
  },

  stopRecording: async () => {
    try {
      const { config, clickEvents } = get();
      await invoke("stop_recording");

      // Post-process: add click indicators to the video
      if (config && clickEvents.length > 0) {
        try {
          await invoke("post_process_clicks", {
            videoPath: config.outputPath,
            clicks: clickEvents,
            regionX: config.x,
            regionY: config.y,
          });
        } catch (e) {
          console.error("Click indicator post-processing failed:", e);
        }
      }

      // Restore window
      const saved = get().savedWindowState;
      const mainWindow = getCurrentWindow();
      await mainWindow.setAlwaysOnTop(false);
      if (saved) {
        await mainWindow.setSize({ type: "Logical", width: saved.width, height: saved.height });
        await mainWindow.setPosition({ type: "Logical", x: saved.x, y: saved.y });
      }

      set({ isRecording: false, config: null, savedWindowState: null, clickEvents: [], recordingStartTime: null });
    } catch (e) {
      console.error("Failed to stop recording:", e);
    }
  },

  tick: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
}));
