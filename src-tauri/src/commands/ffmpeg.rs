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

/// Internal helper to resolve FFmpeg path
pub fn get_ffmpeg_path_internal(app: &AppHandle) -> Result<String, String> {
    let bundled = ffmpeg_exe_path(app)?;
    if bundled.exists() {
        return Ok(bundled.to_string_lossy().to_string());
    }
    Ok("ffmpeg".to_string())
}

/// Check if FFmpeg is available (either bundled in app data or on system PATH)
#[tauri::command]
pub fn check_ffmpeg(app: AppHandle) -> Result<bool, String> {
    let bundled = ffmpeg_exe_path(&app)?;
    if bundled.exists() {
        return Ok(true);
    }
    match Command::new("ffmpeg").arg("-version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Get the path to the FFmpeg executable (bundled or system)
#[tauri::command]
pub fn get_ffmpeg_path(app: AppHandle) -> Result<String, String> {
    get_ffmpeg_path_internal(&app)
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

    // Use BtbN's builds from GitHub — reliable, auto-built, well-maintained
    let url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";

    // Download using PowerShell with progress preference set to silent for speed
    let download_script = format!(
        r#"$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing"#,
        url,
        zip_path.to_string_lossy()
    );

    let download_status = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", &download_script])
        .status()
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if !download_status.success() {
        let _ = fs::remove_file(&zip_path);
        return Err("FFmpeg download failed. Check your internet connection.".into());
    }

    // Verify zip was downloaded
    if !zip_path.exists() {
        return Err("Download completed but zip file not found.".into());
    }

    let zip_size = fs::metadata(&zip_path)
        .map(|m| m.len())
        .unwrap_or(0);
    if zip_size < 1_000_000 {
        let _ = fs::remove_file(&zip_path);
        return Err("Downloaded file is too small, likely an error page.".into());
    }

    // Extract just ffmpeg.exe from the zip
    let extract_script = format!(
        r#"
        $ProgressPreference = 'SilentlyContinue'
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead('{}')
        $entry = $zip.Entries | Where-Object {{ $_.Name -eq 'ffmpeg.exe' -and $_.FullName -like '*/bin/ffmpeg.exe' }} | Select-Object -First 1
        if ($entry) {{
            $stream = $entry.Open()
            $file = [System.IO.File]::Create('{}')
            $stream.CopyTo($file)
            $file.Close()
            $stream.Close()
            Write-Host 'OK'
        }} else {{
            Write-Host 'NOT_FOUND'
        }}
        $zip.Dispose()
        "#,
        zip_path.to_string_lossy(),
        exe_path.to_string_lossy()
    );

    let extract_output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", &extract_script])
        .output()
        .map_err(|e| format!("Failed to extract FFmpeg: {}", e))?;

    let stdout = String::from_utf8_lossy(&extract_output.stdout);

    // Clean up the zip file regardless
    let _ = fs::remove_file(&zip_path);

    if !stdout.contains("OK") {
        let _ = fs::remove_file(&exe_path);
        return Err("Could not find ffmpeg.exe in the downloaded archive.".into());
    }

    // Verify the extracted file exists and works
    if !exe_path.exists() {
        return Err("FFmpeg extraction failed — file not created.".into());
    }

    let verify = Command::new(&exe_path)
        .arg("-version")
        .output()
        .map_err(|e| format!("FFmpeg verification failed: {}", e))?;

    if !verify.status.success() {
        let _ = fs::remove_file(&exe_path);
        return Err("Downloaded FFmpeg binary is invalid.".into());
    }

    Ok(())
}
