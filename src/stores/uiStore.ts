import { create } from "zustand";
import type { ToolType } from "../types/canvas";
import type { Theme } from "../types/settings";

interface UIState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  activeTool: ToolType;
  showSettings: boolean;
  isCaptureMode: boolean;

  setTheme: (theme: Theme) => void;
  setResolvedTheme: (theme: "light" | "dark") => void;
  setActiveTool: (tool: ToolType) => void;
  setShowSettings: (show: boolean) => void;
  setIsCaptureMode: (mode: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: "system",
  resolvedTheme: "light",
  activeTool: "select",
  showSettings: false,
  isCaptureMode: false,

  setTheme: (theme) => set({ theme }),
  setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setShowSettings: (showSettings) => set({ showSettings }),
  setIsCaptureMode: (isCaptureMode) => set({ isCaptureMode }),
}));
