import { create } from "zustand";
import type { CanvasObject } from "../types/canvas";

interface CanvasState {
  objects: CanvasObject[];
  past: CanvasObject[][];
  future: CanvasObject[][];
  zoom: number;
  stageRef: any | null;

  addObject: (obj: CanvasObject) => void;
  updateObject: (id: string, changes: Partial<CanvasObject>) => void;
  removeObject: (id: string) => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  setZoom: (zoom: number) => void;
  setStageRef: (ref: any) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  objects: [],
  past: [],
  future: [],
  zoom: 1,
  stageRef: null,

  addObject: (obj) => {
    const { objects, past } = get();
    set({
      past: [...past, objects],
      future: [],
      objects: [...objects, obj],
    });
  },

  updateObject: (id, changes) => {
    const { objects, past } = get();
    set({
      past: [...past, objects],
      future: [],
      objects: objects.map((o) =>
        o.id === id ? { ...o, ...changes } : o
      ),
    });
  },

  removeObject: (id) => {
    const { objects, past } = get();
    set({
      past: [...past, objects],
      future: [],
      objects: objects.filter((o) => o.id !== id),
    });
  },

  clearAll: () => {
    const { objects, past } = get();
    set({
      past: [...past, objects],
      future: [],
      objects: [],
    });
  },

  undo: () => {
    const { objects, past, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [...future, objects],
      objects: previous,
    });
  },

  redo: () => {
    const { objects, past, future } = get();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    set({
      past: [...past, objects],
      future: future.slice(0, -1),
      objects: next,
    });
  },

  setZoom: (zoom) => set({ zoom }),
  setStageRef: (ref) => set({ stageRef: ref }),
}));
