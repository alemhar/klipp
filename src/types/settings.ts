export type Theme = "light" | "dark" | "system";

export interface AppSettings {
  theme: Theme;
  autoCopyToClipboard: boolean;
  autoSave: boolean;
  autoSavePath: string;
  defaultFormat: string;
  captureShortcut: string;
  snipOutline: boolean;
  snipOutlineColor: string;
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
};
