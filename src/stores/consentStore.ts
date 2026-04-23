import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type Device = "camera" | "microphone";
export type ConsentValue = "unknown" | "allowed" | "denied";

interface ConsentState {
  camera: ConsentValue;
  microphone: ConsentValue;

  // Which device currently needs a consent or blocked prompt. Null when no
  // modal is open. These live in the store (not in a component) so the state
  // survives the pill ↔ full window-mode transition, which unmounts and
  // remounts PillModeBar/TitleBar.
  consentPrompt: Device | null;
  blockedPrompt: Device | null;

  /** Queued to fire after the user clicks Allow. Cleared on Deny/close. */
  pendingAllowed: (() => void) | null;

  loadFromBackend: () => Promise<void>;
  request: (device: Device, onAllowed: () => void) => void;
  handleAllow: () => Promise<void>;
  handleDeny: () => Promise<void>;
  handleBlockedReset: () => Promise<void>;
  closeBlocked: () => void;
}

const persist = async (device: Device, value: ConsentValue) => {
  try {
    await invoke("set_device_consent", { device, consent: value });
  } catch (e) {
    console.error(`set_device_consent(${device}, ${value}) failed:`, e);
  }
};

export const useConsentStore = create<ConsentState>((set, get) => ({
  camera: "unknown",
  microphone: "unknown",
  consentPrompt: null,
  blockedPrompt: null,
  pendingAllowed: null,

  loadFromBackend: async () => {
    try {
      const [cam, mic] = await Promise.all([
        invoke<string>("get_device_consent", { device: "camera" }),
        invoke<string>("get_device_consent", { device: "microphone" }),
      ]);
      set({
        camera: cam as ConsentValue,
        microphone: mic as ConsentValue,
      });
    } catch (e) {
      console.error("loadFromBackend consent failed:", e);
    }
  },

  request: (device, onAllowed) => {
    const value = get()[device];
    if (value === "allowed") {
      onAllowed();
      return;
    }
    if (value === "denied") {
      set({ blockedPrompt: device, pendingAllowed: onAllowed });
    } else {
      set({ consentPrompt: device, pendingAllowed: onAllowed });
    }
  },

  handleAllow: async () => {
    const device = get().consentPrompt;
    if (!device) return;
    set({ consentPrompt: null });
    await persist(device, "allowed");
    set({ [device]: "allowed" } as Partial<ConsentState>);
    const cb = get().pendingAllowed;
    set({ pendingAllowed: null });
    cb?.();
  },

  handleDeny: async () => {
    const device = get().consentPrompt;
    if (!device) return;
    set({ consentPrompt: null, pendingAllowed: null });
    await persist(device, "denied");
    set({ [device]: "denied" } as Partial<ConsentState>);
  },

  handleBlockedReset: async () => {
    const device = get().blockedPrompt;
    if (!device) return;
    // Flip back to unknown so the consent modal re-opens. Preserve the pending
    // callback so recovery is one click, not a restart of the flow.
    set({ blockedPrompt: null });
    await persist(device, "unknown");
    set({ [device]: "unknown", consentPrompt: device } as Partial<ConsentState>);
  },

  closeBlocked: () => {
    set({ blockedPrompt: null, pendingAllowed: null });
  },
}));
