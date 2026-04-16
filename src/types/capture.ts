export type CaptureMode = "rectangular" | "freeform" | "window" | "fullscreen";

export type DelayOption = 0 | 3 | 5 | 10;

export interface CaptureResult {
  base64: string;
  width: number;
  height: number;
}

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
