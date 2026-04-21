export type Theme = "light" | "dark" | "system";

export type LaunchMode = "pill" | "full";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  theme: Theme;
  autoCopyToClipboard: boolean;
  autoSave: boolean;
  autoSavePath: string;
  defaultFormat: string;
  captureShortcut: string;
  snipOutline: boolean;
  snipOutlineColor: string;
  launchMode: LaunchMode;
  pillBounds: WindowBounds | null;
  fullBounds: WindowBounds | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  autoCopyToClipboard: true,
  autoSave: false,
  autoSavePath: "",
  defaultFormat: "png",
  captureShortcut: "Ctrl+Shift+S",
  snipOutline: false,
  snipOutlineColor: "#FF0000",
  launchMode: "pill",
  pillBounds: null,
  fullBounds: null,
};
