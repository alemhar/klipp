export const APP_NAME = "Klipp";

export const DEFAULT_PEN_COLOR = "#FF0000";
export const DEFAULT_PEN_WIDTH = 3;
export const DEFAULT_HIGHLIGHTER_COLOR = "#FFFF00";
export const DEFAULT_HIGHLIGHTER_WIDTH = 20;
export const DEFAULT_HIGHLIGHTER_OPACITY = 0.4;
export const DEFAULT_SHAPE_COLOR = "#FF0000";
export const DEFAULT_SHAPE_WIDTH = 2;
export const DEFAULT_TEXT_SIZE = 16;
export const DEFAULT_TEXT_FONT = "Inter, sans-serif";
export const DEFAULT_TEXT_COLOR = "#000000";

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;
export const ZOOM_STEP = 0.1;

export const SUPPORTED_FORMATS = ["png", "jpg", "gif", "bmp"] as const;

export const TOOL_SHORTCUTS: Record<string, string> = {
  select: "V",
  pen: "P",
  highlighter: "H",
  eraser: "E",
  shape: "S",
  text: "T",
  crop: "C",
};
