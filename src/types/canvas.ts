export type ToolType =
  | "select"
  | "pen"
  | "highlighter"
  | "eraser"
  | "shape"
  | "text"
  | "crop"
  | "emoji"
  | "image-overlay"
  | "ruler"
  | "protractor";

export type ShapeType = "rectangle" | "ellipse" | "arrow" | "line";

export type CanvasObject = DrawingObject | ShapeObject | TextObject | ImageOverlayObject;

export interface BaseObject {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface DrawingObject extends BaseObject {
  type: "pen" | "highlighter";
  props: {
    points: number[];
    stroke: string;
    strokeWidth: number;
    opacity: number;
  };
}

export interface ShapeObject extends BaseObject {
  type: "shape";
  props: {
    shapeType: ShapeType;
    stroke: string;
    strokeWidth: number;
    fill: string;
    opacity: number;
    points?: number[];
  };
}

export interface TextObject extends BaseObject {
  type: "text";
  props: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontStyle: string; // "normal", "bold", "italic", "bold italic"
    textDecoration: string; // "", "underline"
    fill: string;
    align: string;
  };
}

export interface ImageOverlayObject extends BaseObject {
  type: "image-overlay";
  props: {
    src: string; // data URL of the imported image
  };
}
