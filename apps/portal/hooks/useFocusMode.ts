"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FocusModeState {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (_enabled: boolean) => void;
}

export const useFocusMode = create<FocusModeState>()(
  persist(
    (set) => ({
      enabled: false,
      toggle: () => set((state) => ({ enabled: !state.enabled })),
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: "arch-focus-mode",
    },
  ),
);
