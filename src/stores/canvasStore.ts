import { create } from "zustand";
import { enableMapSet, produce } from "immer";
import type { CanvasObject } from "../types/canvas";

enableMapSet();

interface CanvasState {
  objects: CanvasObject[];
  past: CanvasObject[][];
  future: CanvasObject[][];
  zoom: number;

  addObject: (obj: CanvasObject) => void;
  updateObject: (id: string, changes: Partial<CanvasObject>) => void;
  removeObject: (id: string) => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  setZoom: (zoom: number) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  objects: [],
  past: [],
  future: [],
  zoom: 1,

  addObject: (obj) =>
    set(
      produce((state: CanvasState) => {
        state.past.push([...state.objects]);
        state.future = [];
        state.objects.push(obj);
      })
    ),

  updateObject: (id, changes) =>
    set(
      produce((state: CanvasState) => {
        state.past.push([...state.objects]);
        state.future = [];
        const index = state.objects.findIndex((o) => o.id === id);
        if (index !== -1) {
          state.objects[index] = { ...state.objects[index], ...changes };
        }
      })
    ),

  removeObject: (id) =>
    set(
      produce((state: CanvasState) => {
        state.past.push([...state.objects]);
        state.future = [];
        state.objects = state.objects.filter((o) => o.id !== id);
      })
    ),

  clearAll: () =>
    set(
      produce((state: CanvasState) => {
        state.past.push([...state.objects]);
        state.future = [];
        state.objects = [];
      })
    ),

  undo: () =>
    set(
      produce((state: CanvasState) => {
        if (state.past.length === 0) return;
        const previous = state.past.pop()!;
        state.future.push([...state.objects]);
        state.objects = previous;
      })
    ),

  redo: () =>
    set(
      produce((state: CanvasState) => {
        if (state.future.length === 0) return;
        const next = state.future.pop()!;
        state.past.push([...state.objects]);
        state.objects = next;
      })
    ),

  setZoom: (zoom) => set({ zoom }),
}));
