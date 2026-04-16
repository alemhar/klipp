import { create } from "zustand";
import type { ToolType, ShapeType } from "../types/canvas";
import type { Theme } from "../types/settings";
import {
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_WIDTH,
  DEFAULT_HIGHLIGHTER_COLOR,
  DEFAULT_HIGHLIGHTER_WIDTH,
  DEFAULT_HIGHLIGHTER_OPACITY,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_WIDTH,
  DEFAULT_TEXT_SIZE,
  DEFAULT_TEXT_FONT,
  DEFAULT_TEXT_COLOR,
} from "../lib/constants";

interface ToolOptions {
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  shapeType: ShapeType;
  fillColor: string;
  filled: boolean;
  // Text options
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  textDecoration: string;
  textColor: string;
  textAlign: string;
}

interface UIState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  activeTool: ToolType;
  toolOptions: ToolOptions;
  showSettings: boolean;
  isCaptureMode: boolean;

  setTheme: (theme: Theme) => void;
  setResolvedTheme: (theme: "light" | "dark") => void;
  setActiveTool: (tool: ToolType) => void;
  setToolOptions: (options: Partial<ToolOptions>) => void;
  setShowSettings: (show: boolean) => void;
  setIsCaptureMode: (mode: boolean) => void;
}

const defaultToolOptions: ToolOptions = {
  strokeColor: DEFAULT_PEN_COLOR,
  strokeWidth: DEFAULT_PEN_WIDTH,
  opacity: 1,
  shapeType: "rectangle",
  fillColor: "transparent",
  filled: false,
  fontSize: DEFAULT_TEXT_SIZE,
  fontFamily: DEFAULT_TEXT_FONT,
  fontStyle: "normal",
  textDecoration: "",
  textColor: DEFAULT_TEXT_COLOR,
  textAlign: "left",
};

export const useUIStore = create<UIState>((set) => ({
  theme: "system",
  resolvedTheme: "light",
  activeTool: "select",
  toolOptions: defaultToolOptions,
  showSettings: false,
  isCaptureMode: false,

  setTheme: (theme) => set({ theme }),
  setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
  setActiveTool: (tool) => {
    // Update default options when switching tools
    const overrides: Partial<ToolOptions> = {};
    if (tool === "highlighter") {
      overrides.strokeColor = DEFAULT_HIGHLIGHTER_COLOR;
      overrides.strokeWidth = DEFAULT_HIGHLIGHTER_WIDTH;
      overrides.opacity = DEFAULT_HIGHLIGHTER_OPACITY;
    } else if (tool === "pen") {
      overrides.strokeColor = DEFAULT_PEN_COLOR;
      overrides.strokeWidth = DEFAULT_PEN_WIDTH;
      overrides.opacity = 1;
    } else if (tool === "shape") {
      overrides.strokeColor = DEFAULT_SHAPE_COLOR;
      overrides.strokeWidth = DEFAULT_SHAPE_WIDTH;
      overrides.opacity = 1;
    } else if (tool === "text") {
      overrides.textColor = DEFAULT_TEXT_COLOR;
      overrides.fontSize = DEFAULT_TEXT_SIZE;
      overrides.fontFamily = DEFAULT_TEXT_FONT;
    }
    set((state) => ({
      activeTool: tool,
      toolOptions: { ...state.toolOptions, ...overrides },
    }));
  },
  setToolOptions: (options) =>
    set((state) => ({
      toolOptions: { ...state.toolOptions, ...options },
    })),
  setShowSettings: (showSettings) => set({ showSettings }),
  setIsCaptureMode: (isCaptureMode) => set({ isCaptureMode }),
}));
