import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRecordingStore } from "../stores/recordingStore";

/**
 * Shared record-flow hook used by the TitleBar (full mode) and the PillModeBar.
 * Centralises the FFmpeg-presence check, one-time download-with-spinner flow,
 * webcam availability fallback, and transition to the region selector. Both
 * callers get the same behaviour without duplicating the ~40-line handler.
 */
export function useRecordFlow() {
  const [isInstallingFfmpeg, setIsInstallingFfmpeg] = useState(false);
  const {
    isRecording,
    checkFfmpeg,
    saveWindowState,
    setIsSelectingRegion,
    webcamEnabled,
    setWebcamEnabled,
  } = useRecordingStore();

  const proceedToRecordFlow = useCallback(async () => {
    if (webcamEnabled) {
      try {
        const webcams = await invoke<string[]>("list_webcams");
        if (webcams.length === 0) {
          alert(
            "No webcam detected.\n\n" +
              "If you have a camera, make sure:\n" +
              "1. Go to Windows Settings > Privacy > Camera\n" +
              "2. Turn ON 'Allow desktop apps to access your camera'\n\n" +
              "Recording will continue without webcam."
          );
          setWebcamEnabled(false);
        }
      } catch {
        setWebcamEnabled(false);
      }
    }
    await saveWindowState();
    setIsSelectingRegion(true);
  }, [webcamEnabled, setWebcamEnabled, saveWindowState, setIsSelectingRegion]);

  const onClick = useCallback(async () => {
    if (isRecording || isInstallingFfmpeg) return;
    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) {
      const shouldDownload = confirm(
        "Screen recording requires FFmpeg (a free, open-source video encoder).\n\n" +
          "Klipp will download it automatically (one-time only, ~30MB).\n" +
          "This may take a minute depending on your internet speed.\n\n" +
          "When the install finishes, Klipp will continue to the region selector."
      );
      if (!shouldDownload) return;
      setIsInstallingFfmpeg(true);
      try {
        await invoke("download_ffmpeg");
      } catch (e) {
        setIsInstallingFfmpeg(false);
        alert(
          `Failed to download FFmpeg: ${e}\n\n` +
            "You can install it manually via:\n  winget install Gyan.FFmpeg"
        );
        return;
      }
      setIsInstallingFfmpeg(false);
    }
    await proceedToRecordFlow();
  }, [isRecording, isInstallingFfmpeg, checkFfmpeg, proceedToRecordFlow]);

  return { onClick, isInstallingFfmpeg, isRecording };
}
