use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::PathBuf;

#[tauri::command]
pub fn save_image(base64_data: String, file_path: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    let path = PathBuf::from(&file_path);
    let format = match path.extension().and_then(|e| e.to_str()) {
        Some("png") => image::ImageFormat::Png,
        Some("jpg") | Some("jpeg") => image::ImageFormat::Jpeg,
        Some("gif") => image::ImageFormat::Gif,
        Some("bmp") => image::ImageFormat::Bmp,
        _ => image::ImageFormat::Png,
    };

    img.save_with_format(&path, format)
        .map_err(|e| format!("Failed to save image: {}", e))?;

    Ok(())
}
