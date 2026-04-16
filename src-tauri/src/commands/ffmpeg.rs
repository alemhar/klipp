use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

fn ffmpeg_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let ffmpeg_dir = data_dir.join("ffmpeg");
    fs::create_dir_all(&ffmpeg_dir)
        .map_err(|e| format!("Failed to create ffmpeg dir: {}", e))?;
    Ok(ffmpeg_dir)
}

fn ffmpeg_exe_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(ffmpeg_dir(app)?.join("ffmpeg.exe"))
}

/// Check if FFmpeg is available (either bundled in app data or on system PATH)
#[tauri::command]
pub fn check_ffmpeg(app: AppHandle) -> Result<bool, String> {
    // First check our bundled copy
    let bundled = ffmpeg_exe_path(&app)?;
    if bundled.exists() {
        return Ok(true);
    }
    // Then check system PATH
    match Command::new("ffmpeg").arg("-version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Internal helper (non-command) to resolve FFmpeg path
pub fn get_ffmpeg_path_internal(app: &AppHandle) -> Result<String, String> {
    let bundled = ffmpeg_exe_path(app)?;
    if bundled.exists() {
        return Ok(bundled.to_string_lossy().to_string());
    }
    Ok("ffmpeg".to_string())
}

/// Get the path to the FFmpeg executable (bundled or system)
#[tauri::command]
pub fn get_ffmpeg_path(app: AppHandle) -> Result<String, String> {
    let bundled = ffmpeg_exe_path(&app)?;
    if bundled.exists() {
        return Ok(bundled.to_string_lossy().to_string());
    }
    // Fall back to system PATH
    Ok("ffmpeg".to_string())
}

/// Download FFmpeg to the app's data directory
#[tauri::command]
pub async fn download_ffmpeg(app: AppHandle) -> Result<(), String> {
    let dir = ffmpeg_dir(&app)?;
    let zip_path = dir.join("ffmpeg.zip");
    let exe_path = dir.join("ffmpeg.exe");

    if exe_path.exists() {
        return Ok(());
    }

    // Download FFmpeg essentials build from gyan.dev (widely used, reliable)
    // This is the "essentials" build — smallest usable FFmpeg (~30MB zip)
    let url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";

    // Use PowerShell to download (available on all Windows)
    let download_status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
                url,
                zip_path.to_string_lossy()
            ),
        ])
        .status()
        .map_err(|e| format!("Failed to download FFmpeg: {}", e))?;

    if !download_status.success() {
        return Err("FFmpeg download failed".into());
    }

    // Extract just ffmpeg.exe from the zip using PowerShell
    let extract_status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                r#"
                Add-Type -AssemblyName System.IO.Compression.FileSystem;
                $zip = [System.IO.Compression.ZipFile]::OpenRead('{}');
                $entry = $zip.Entries | Where-Object {{ $_.Name -eq 'ffmpeg.exe' -and $_.FullName -like '*/bin/ffmpeg.exe' }} | Select-Object -First 1;
                if ($entry) {{
                    $stream = $entry.Open();
                    $file = [System.IO.File]::Create('{}');
                    $stream.CopyTo($file);
                    $file.Close();
                    $stream.Close();
                }};
                $zip.Dispose();
                "#,
                zip_path.to_string_lossy(),
                exe_path.to_string_lossy()
            ),
        ])
        .status()
        .map_err(|e| format!("Failed to extract FFmpeg: {}", e))?;

    if !extract_status.success() {
        return Err("FFmpeg extraction failed".into());
    }

    // Clean up the zip file
    let _ = fs::remove_file(&zip_path);

    // Verify the extracted file works
    let verify = Command::new(&exe_path)
        .arg("-version")
        .output()
        .map_err(|e| format!("FFmpeg verification failed: {}", e))?;

    if !verify.status.success() {
        let _ = fs::remove_file(&exe_path);
        return Err("Downloaded FFmpeg binary is invalid".into());
    }

    Ok(())
}
