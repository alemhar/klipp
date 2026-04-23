import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRecordingStore } from "../stores/recordingStore";
import { useFfmpegStore } from "../stores/ffmpegStore";
import { useWindowModeStore } from "../stores/windowModeStore";

/**
 * Shared record-flow hook used by the TitleBar (full mode) and the PillModeBar.
 * Handles the FFmpeg-presence check, routes missing-FFmpeg cases through the
 * Klipp-branded install modal, falls back to a friendly webcam-missing prompt,
 * and transitions to the region selector. Both callers get the same behaviour
 * without duplicating the handler.
 *
 * Install-modal state lives in `useFfmpegStore` (not here), so the post-install
 * `proceedToRecordFlow` callback survives the pill → full window-mode remount
 * that happens when we `expandToFull()` to make room for the modal.
 */
export function useRecordFlow() {
  const {
    isRecording,
    checkFfmpeg,
    saveWindowState,
    setIsSelectingRegion,
    webcamEnabled,
    setWebcamEnabled,
  } = useRecordingStore();
  const isInstallingFfmpeg = useFfmpegStore((s) => s.isInstalling);

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
    if (hasFfmpeg) {
      await proceedToRecordFlow();
      return;
    }
    // In pill mode the 560x90 window clips rich React modals — expand to full
    // so the install prompt renders readably. Matches the pattern used for
    // the device-consent modal (see stores/consentStore).
    if (useWindowModeStore.getState().mode === "pill") {
      await useWindowModeStore.getState().expandToFull();
    }
    useFfmpegStore.getState().showPrompt(() => {
      void proceedToRecordFlow();
    });
  }, [isRecording, isInstallingFfmpeg, checkFfmpeg, proceedToRecordFlow]);

  return { onClick, isInstallingFfmpeg, isRecording };
}
