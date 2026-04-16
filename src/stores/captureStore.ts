import { create } from "zustand";
import type {
  CaptureMode,
  CaptureRegion,
  CaptureResult,
  DelayOption,
} from "../types/capture";

interface CaptureState {
  mode: CaptureMode;
  delay: DelayOption;
  region: CaptureRegion | null;
  capturedImage: CaptureResult | null;
  isCapturing: boolean;

  setMode: (mode: CaptureMode) => void;
  setDelay: (delay: DelayOption) => void;
  setRegion: (region: CaptureRegion | null) => void;
  setCapturedImage: (image: CaptureResult | null) => void;
  setIsCapturing: (capturing: boolean) => void;
  reset: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  mode: "rectangular",
  delay: 0,
  region: null,
  capturedImage: null,
  isCapturing: false,

  setMode: (mode) => set({ mode }),
  setDelay: (delay) => set({ delay }),
  setRegion: (region) => set({ region }),
  setCapturedImage: (capturedImage) => set({ capturedImage }),
  setIsCapturing: (isCapturing) => set({ isCapturing }),
  reset: () =>
    set({
      region: null,
      capturedImage: null,
      isCapturing: false,
    }),
}));
