import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

interface RecordingConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  fps: number;
  outputPath: string;
  captureAudio: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isSelectingRegion: boolean;
  hasFfmpeg: boolean | null;
  elapsedSeconds: number;
  config: RecordingConfig | null;

  checkFfmpeg: () => Promise<boolean>;
  setIsSelectingRegion: (v: boolean) => void;
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

  startRecording: async (config) => {
    try {
      await invoke("start_recording", { config });
      set({ isRecording: true, elapsedSeconds: 0, config });
    } catch (e) {
      console.error("Failed to start recording:", e);
      throw e;
    }
  },

  stopRecording: async () => {
    try {
      await invoke("stop_recording");
      set({ isRecording: false, config: null });
    } catch (e) {
      console.error("Failed to stop recording:", e);
    }
  },

  tick: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
}));
