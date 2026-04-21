import { create } from "zustand";
import { getCurrentWindow, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { useSettingsStore } from "./settingsStore";
import type { LaunchMode, WindowBounds } from "../types/settings";

const PILL_DEFAULT: WindowBounds = { x: 0, y: 10, width: 560, height: 90 };
const FULL_DEFAULT: WindowBounds = { x: 100, y: 100, width: 1200, height: 800 };

// Vertical chrome stacked above/below the annotation canvas when in "full"
// mode: TitleBar (36) + Toolbar (36) + ToolOptionsBar (36) + StatusBar (24) +
// an OS-chrome safety buffer. Tuned so a captured region appears at native
// size inside the canvas without getting cropped.
const FULL_MODE_CHROME_HEIGHT = 170;
const POST_CAPTURE_MIN_WIDTH = 560;
const POST_CAPTURE_MIN_HEIGHT = 400;

interface WindowModeState {
  mode: LaunchMode;
  initFromSettings: () => void;
  expandToFull: () => Promise<void>;
  expandToCaptureSize: (captureWidth: number, captureHeight: number) => Promise<void>;
  collapseToPill: () => Promise<void>;
}

async function readCurrentBounds(): Promise<WindowBounds> {
  const win = getCurrentWindow();
  const size = await win.innerSize();
  const pos = await win.outerPosition();
  const scale = await win.scaleFactor();
  return {
    x: Math.round(pos.x / scale),
    y: Math.round(pos.y / scale),
    width: Math.round(size.width / scale),
    height: Math.round(size.height / scale),
  };
}

async function applyBounds(bounds: WindowBounds, resizable: boolean) {
  const win = getCurrentWindow();
  await win.setResizable(resizable);
  await win.setSize(new LogicalSize(bounds.width, bounds.height));
  await win.setPosition(new LogicalPosition(bounds.x, bounds.y));
}

function centeredPillBounds(): WindowBounds {
  const w = PILL_DEFAULT.width;
  const screenW = typeof window !== "undefined" ? window.screen.width : 1920;
  return { ...PILL_DEFAULT, x: Math.max(0, Math.round(screenW / 2 - w / 2)) };
}

export const useWindowModeStore = create<WindowModeState>((set, get) => ({
  mode: "pill",

  initFromSettings: () => {
    const { settings } = useSettingsStore.getState();
    set({ mode: settings.launchMode });
  },

  expandToFull: async () => {
    if (get().mode === "full") return;
    const { updateSettings, settings } = useSettingsStore.getState();
    const pillBounds = await readCurrentBounds().catch(() => null);
    const target = settings.fullBounds ?? FULL_DEFAULT;
    try {
      await applyBounds(target, true);
    } catch (e) {
      console.error("expandToFull failed:", e);
      return;
    }
    set({ mode: "full" });
    await updateSettings({
      launchMode: "full",
      pillBounds: pillBounds ?? settings.pillBounds,
    });
  },

  /**
   * Called after a screenshot capture: resize the window to fit the captured
   * region + annotation chrome, centered on screen. Mirrors Snipping Tool's
   * post-capture UX — the window becomes just big enough to show the capture
   * without obscuring the rest of the desktop. Clamped to sensible
   * min (so toolbar fits) and max (90% of screen) bounds.
   *
   * Importantly, this does NOT persist `launchMode: "full"` to settings.
   * A capture-driven expand is transient — the user's *preferred* launch
   * state is set only by the manual ⤢ Expand / ⤡ Collapse buttons. Without
   * this guarded behaviour, every screenshot would flip the next-launch
   * state to "full", which is not the Snipping-Tool-like experience we want.
   */
  expandToCaptureSize: async (captureW, captureH) => {
    const screenW = typeof window !== "undefined" ? window.screen.width : 1920;
    const screenH = typeof window !== "undefined" ? window.screen.height : 1080;
    const maxW = Math.round(screenW * 0.9);
    const maxH = Math.round(screenH * 0.9);

    const targetW = Math.max(POST_CAPTURE_MIN_WIDTH, Math.min(maxW, captureW));
    const targetH = Math.max(
      POST_CAPTURE_MIN_HEIGHT,
      Math.min(maxH, captureH + FULL_MODE_CHROME_HEIGHT)
    );

    const x = Math.max(0, Math.round(screenW / 2 - targetW / 2));
    const y = Math.max(30, Math.round(screenH / 2 - targetH / 2));

    try {
      await applyBounds({ x, y, width: targetW, height: targetH }, true);
    } catch (e) {
      console.error("expandToCaptureSize failed:", e);
      return;
    }
    // Update in-memory mode only so App.tsx re-renders into the full layout,
    // but leave settings.launchMode untouched (stays "pill" for next launch).
    set({ mode: "full" });
  },

  collapseToPill: async () => {
    if (get().mode === "pill") return;
    const { updateSettings, settings } = useSettingsStore.getState();
    const fullBounds = await readCurrentBounds().catch(() => null);
    const target = settings.pillBounds ?? centeredPillBounds();
    try {
      await applyBounds(target, false);
    } catch (e) {
      console.error("collapseToPill failed:", e);
      return;
    }
    set({ mode: "pill" });
    await updateSettings({
      launchMode: "pill",
      fullBounds: fullBounds ?? settings.fullBounds,
    });
  },
}));
