import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

interface ExportRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Exports the Konva stage to a base64 PNG string.
 * Temporarily resets zoom to 1:1 so export matches the actual image dimensions.
 */
export function getStageBase64(
  stageRef: any | null,
  fallbackBase64?: string,
  region?: ExportRegion
): string | null {
  if (stageRef?.current && region) {
    const stage = stageRef.current;

    // Save current scale and temporarily reset to 1:1
    const prevScaleX = stage.scaleX();
    const prevScaleY = stage.scaleY();
    stage.scaleX(1);
    stage.scaleY(1);
    stage.batchDraw();

    const dataUrl = stage.toDataURL({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      pixelRatio: 1,
    });

    // Restore scale
    stage.scaleX(prevScaleX);
    stage.scaleY(prevScaleY);
    stage.batchDraw();

    return dataUrl.split(",")[1] || null;
  }
  if (stageRef?.current) {
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 });
    return dataUrl.split(",")[1] || null;
  }
  return fallbackBase64 || null;
}

export async function saveImageToFile(base64Data: string): Promise<string | null> {
  const filePath = await save({
    filters: [
      { name: "PNG Image", extensions: ["png"] },
      { name: "JPEG Image", extensions: ["jpg", "jpeg"] },
      { name: "GIF Image", extensions: ["gif"] },
      { name: "BMP Image", extensions: ["bmp"] },
    ],
    defaultPath: `screenshot-${Date.now()}.png`,
  });

  if (!filePath) return null;

  await invoke("save_image", { base64Data, filePath });
  return filePath;
}

export async function copyImageToClipboard(base64Data: string): Promise<void> {
  await invoke("copy_image_to_clipboard", { base64Data });
}
