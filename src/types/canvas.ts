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
  type: "pen" | "highlighter" | "shape";
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  props: Record<string, unknown>;
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

export interface ShapeObject extends CanvasObject {
  type: "shape";
  props: {
    shapeType: ShapeType;
    stroke: string;
    strokeWidth: number;
    fill: string;
    opacity: number;
    // For arrow/line: start and end points relative to x,y
    points?: number[];
  };
}
