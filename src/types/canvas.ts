export type ToolType =
  | "select"
  | "pen"
  | "highlighter"
  | "eraser"
  | "shape"
  | "text"
  | "crop"
  | "emoji"
  | "ruler"
  | "protractor";

export type ShapeType = "rectangle" | "ellipse" | "arrow" | "line";

export interface CanvasObject {
  id: string;
  type: ToolType | ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  props: Record<string, unknown>;
}

export interface TextObject extends CanvasObject {
  type: "text";
  props: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontStyle: string;
    fill: string;
    width: number;
  };
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingObject extends CanvasObject {
  type: "pen" | "highlighter";
  props: {
    points: number[];
    stroke: string;
    strokeWidth: number;
    opacity: number;
  };
}
