import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

/**
 * Exports the Konva stage to a base64 PNG string.
 * If a stageRef is provided, renders the full annotated canvas.
 * Falls back to the raw capture base64 if no stage is available.
 */
export function getStageBase64(stageRef: React.RefObject<any> | null, fallbackBase64?: string): string | null {
  if (stageRef?.current) {
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 });
    // dataUrl is "data:image/png;base64,..."
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
