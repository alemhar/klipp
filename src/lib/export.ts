import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

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
