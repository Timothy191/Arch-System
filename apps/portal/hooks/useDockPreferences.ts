"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DockPreferencesState {
  autoHide: boolean;
  toggleAutoHide: () => void;
  setAutoHide: (_enabled: boolean) => void;
}

export const useDockPreferences = create<DockPreferencesState>()(
  persist(
    (set) => ({
      autoHide: true,
      toggleAutoHide: () => set((state) => ({ autoHide: !state.autoHide })),
      setAutoHide: (autoHide) => set({ autoHide }),
    }),
    {
      name: "arch-dock-preferences",
    },
  ),
);

