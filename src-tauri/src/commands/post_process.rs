use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::AppHandle;

use super::ffmpeg;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickEventData {
    pub x: i32,
    pub y: i32,
    pub button: String,
    pub time_ms: i64,
}

/// Post-process a recorded video to add click indicator circles.
/// Uses FFmpeg's drawbox filter to draw circles at click positions.
#[tauri::command]
pub async fn post_process_clicks(
    app: AppHandle,
    video_path: String,
    clicks: Vec<ClickEventData>,
    region_x: i32,
    region_y: i32,
) -> Result<(), String> {
    if clicks.is_empty() {
        return Ok(());
    }

    let ffmpeg_path = ffmpeg::get_ffmpeg_path_internal(&app)?;

    // Build a filter chain that draws circles at each click position
    // FFmpeg doesn't have a native "draw circle" filter, but we can use drawbox
    // with small dimensions to approximate, or use the geq filter.
    // The most practical approach: use drawtext with a Unicode circle character,
    // or overlay a generated circle image.
    //
    // Simplest approach: use drawbox filter to draw a highlight square at each click
    // that appears for 0.5 seconds.
    let mut filters = Vec::new();

    for click in &clicks {
        let time_sec = click.time_ms as f64 / 1000.0;
        let end_time = time_sec + 0.5;
        // Convert screen coordinates to video coordinates
        let vx = click.x - region_x;
        let vy = click.y - region_y;
        // Draw a highlighted box around the click position
        let color = match click.button.as_str() {
            "left" => "yellow@0.5",
            "right" => "blue@0.5",
            _ => "orange@0.5",
        };
        let size = 30;
        let x = (vx - size / 2).max(0);
        let y = (vy - size / 2).max(0);

        filters.push(format!(
            "drawbox=x={}:y={}:w={}:h={}:color={}:t=3:enable='between(t,{:.3},{:.3})'",
            x, y, size, size, color, time_sec, end_time
        ));
    }

    if filters.is_empty() {
        return Ok(());
    }

    let filter_chain = filters.join(",");

    // Create temp output path
    let temp_path = format!("{}.tmp.mp4", video_path);

    let status = Command::new(&ffmpeg_path)
        .args([
            "-y",
            "-i",
            &video_path,
            "-vf",
            &filter_chain,
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "23",
            "-c:a",
            "copy",
            &temp_path,
        ])
        .status()
        .map_err(|e| format!("FFmpeg post-processing failed: {}", e))?;

    if !status.success() {
        let _ = std::fs::remove_file(&temp_path);
        return Err("FFmpeg post-processing returned non-zero exit code".into());
    }

    // Replace original with processed version
    std::fs::remove_file(&video_path)
        .map_err(|e| format!("Failed to remove original video: {}", e))?;
    std::fs::rename(&temp_path, &video_path)
        .map_err(|e| format!("Failed to rename processed video: {}", e))?;

    Ok(())
}
