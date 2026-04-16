use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::image::Image;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
pub fn copy_image_to_clipboard(app: AppHandle, base64_data: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let raw_pixels = rgba.into_raw();

    let tauri_img = Image::new_owned(raw_pixels, w, h);

    app.clipboard()
        .write_image(&tauri_img)
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;

    Ok(())
}
