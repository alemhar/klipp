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
  webcamEnabled: boolean;
  webcamSize: number;
  webcamPosition: string;
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
  webcamEnabled: boolean;
  checkFfmpeg: () => Promise<boolean>;
  setIsSelectingRegion: (v: boolean) => void;
  setWebcamEnabled: (v: boolean) => void;
  saveWindowState: () => Promise<void>;
  startRecording: (config: RecordingConfig) => Promise<void>;
  stopRecording: () => Promise<void>;
  tick: () => void;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  isRecording: false,
  isSelectingRegion: false,
  hasFfmpeg: null,
  elapsedSeconds: 0,
  webcamEnabled: false,
  config: null,
  savedWindowState: null,

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
  setWebcamEnabled: (v) => set({ webcamEnabled: v }),

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
      // Show overlay and start mouse hook for click indicators
      await invoke("show_overlay").catch(console.error);
      set({ isRecording: true, elapsedSeconds: 0, config });
    } catch (e) {
      console.error("Failed to start recording:", e);
      throw e;
    }
  },

  stopRecording: async () => {
    try {
      await invoke("stop_recording");
      // Clean up overlay and mouse hook
      await invoke("hide_overlay").catch(console.error);

      // Restore window
      const saved = get().savedWindowState;
      const mainWindow = getCurrentWindow();
      await mainWindow.setAlwaysOnTop(false);
      if (saved) {
        await mainWindow.setSize({ type: "Logical", width: saved.width, height: saved.height });
        await mainWindow.setPosition({ type: "Logical", x: saved.x, y: saved.y });
      }

      set({ isRecording: false, config: null, savedWindowState: null });
    } catch (e) {
      console.error("Failed to stop recording:", e);
    }
  },

  tick: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
}));
