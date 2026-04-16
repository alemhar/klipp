use base64::{engine::general_purpose::STANDARD, Engine};
use image::ImageFormat;
use std::io::Cursor;

use crate::capture;

fn image_to_base64_png(img: &image::RgbaImage) -> Result<String, String> {
    let mut buf = Cursor::new(Vec::new());
    img.write_to(&mut buf, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;
    Ok(STANDARD.encode(buf.into_inner()))
}

fn image_to_base64_bmp(img: &image::RgbaImage) -> Result<String, String> {
    let mut buf = Cursor::new(Vec::new());
    img.write_to(&mut buf, ImageFormat::Bmp)
        .map_err(|e| format!("Failed to encode BMP: {}", e))?;
    Ok(STANDARD.encode(buf.into_inner()))
}

#[derive(serde::Serialize)]
pub struct CaptureResult {
    pub base64: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

/// Fast fullscreen capture using BMP (no compression overhead).
/// Used for the snipping overlay preview where speed matters.
#[tauri::command]
pub fn capture_fullscreen_fast() -> Result<CaptureResult, String> {
    let (img, width, height) = capture::capture_screen()?;
    let base64 = image_to_base64_bmp(&img)?;
    Ok(CaptureResult {
        base64,
        width,
        height,
        format: "bmp".into(),
    })
}

/// Standard fullscreen capture using PNG (smaller file, used for saving).
#[tauri::command]
pub fn capture_fullscreen() -> Result<CaptureResult, String> {
    let (img, width, height) = capture::capture_screen()?;
    let base64 = image_to_base64_png(&img)?;
    Ok(CaptureResult {
        base64,
        width,
        height,
        format: "png".into(),
    })
}

#[tauri::command]
pub fn capture_region(x: i32, y: i32, width: i32, height: i32) -> Result<CaptureResult, String> {
    let (img, w, h) = capture::capture_region(x, y, width, height)?;
    let base64 = image_to_base64_png(&img)?;
    Ok(CaptureResult {
        base64,
        width: w,
        height: h,
        format: "png".into(),
    })
}

/// Crops a region from an existing base64-encoded image (no new screenshot)
#[tauri::command]
pub fn crop_image(
    base64_data: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<CaptureResult, String> {
    let bytes = STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    let cropped = img.crop_imm(x, y, width, height).to_rgba8();
    let (w, h) = cropped.dimensions();
    let base64 = image_to_base64_png(&cropped)?;

    Ok(CaptureResult {
        base64,
        width: w,
        height: h,
        format: "png".into(),
    })
}
