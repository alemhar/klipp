import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

type Modal = "prompt" | "error" | null;

interface FfmpegState {
  /** Which modal is currently open, if any. */
  modal: Modal;
  /** True while the download is in flight (button shows spinner, modal closed). */
  isInstalling: boolean;
  /** Last install error message, shown in the error modal. */
  errorMessage: string | null;
  /** Queued after a successful install — fires `proceedToRecordFlow` from useRecordFlow. */
  pendingProceed: (() => void) | null;

  /**
   * Open the install prompt modal and remember what to do once the user
   * grants consent to install. Lives in the store (not a component) so the
   * callback survives the pill ↔ full window-mode remount that occurs when
   * pill-mode Record triggers expandToFull before showing the modal.
   */
  showPrompt: (onReady: () => void) => void;

  /** User clicked Install in the prompt. Runs the download and post-install callback. */
  confirmInstall: () => Promise<void>;

  /** User clicked Try again in the error modal. Same logic as confirmInstall. */
  retryInstall: () => Promise<void>;

  /** User dismissed either modal. Clears pending callback. */
  cancel: () => void;
}

async function runDownload(): Promise<string | null> {
  try {
    await invoke("download_ffmpeg");
    return null;
  } catch (e) {
    return typeof e === "string" ? e : String(e);
  }
}

export const useFfmpegStore = create<FfmpegState>((set, get) => ({
  modal: null,
  isInstalling: false,
  errorMessage: null,
  pendingProceed: null,

  showPrompt: (onReady) => {
    set({ modal: "prompt", errorMessage: null, pendingProceed: onReady });
  },

  confirmInstall: async () => {
    set({ modal: null, isInstalling: true, errorMessage: null });
    const err = await runDownload();
    if (err) {
      set({ isInstalling: false, modal: "error", errorMessage: err });
      return;
    }
    const cb = get().pendingProceed;
    set({ isInstalling: false, pendingProceed: null });
    cb?.();
  },

  retryInstall: async () => {
    // Same flow as the initial confirm — the callback is still queued.
    await get().confirmInstall();
  },

  cancel: () => {
    set({ modal: null, pendingProceed: null, errorMessage: null });
  },
}));
