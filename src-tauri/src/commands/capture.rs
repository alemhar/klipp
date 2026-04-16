use base64::{engine::general_purpose::STANDARD, Engine};
use image::ImageFormat;
use std::io::Cursor;

use crate::capture;

fn image_to_base64(img: &image::RgbaImage) -> Result<String, String> {
    let mut buf = Cursor::new(Vec::new());
    img.write_to(&mut buf, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;
    Ok(STANDARD.encode(buf.into_inner()))
}

#[derive(serde::Serialize)]
pub struct CaptureResult {
    pub base64: String,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub fn capture_fullscreen() -> Result<CaptureResult, String> {
    let (img, width, height) = capture::capture_screen()?;
    let base64 = image_to_base64(&img)?;
    Ok(CaptureResult {
        base64,
        width,
        height,
    })
}

#[tauri::command]
pub fn capture_region(x: i32, y: i32, width: i32, height: i32) -> Result<CaptureResult, String> {
    let (img, w, h) = capture::capture_region(x, y, width, height)?;
    let base64 = image_to_base64(&img)?;
    Ok(CaptureResult {
        base64,
        width: w,
        height: h,
    })
}
