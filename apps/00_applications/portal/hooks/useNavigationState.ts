import { create } from "zustand";

interface NavigationState {
  scrollY: number;
  activeSection: "function" | "content";
  hoveredElement: string | null;
  activeDepartment: string | null;
  setScrollY: (_y: number) => void;
  setActiveSection: (_section: "function" | "content") => void;
  setHoveredElement: (_element: string | null) => void;
  setActiveDepartment: (_dept: string | null) => void;
}

export const useNavigationState = create<NavigationState>((set) => ({
  scrollY: 0,
  activeSection: "function",
  hoveredElement: null,
  activeDepartment: null,
  setScrollY: (y) => set({ scrollY: y }),
  setActiveSection: (section) => set({ activeSection: section }),
  setHoveredElement: (element) => set({ hoveredElement: element }),
  setActiveDepartment: (dept) => set({ activeDepartment: dept }),
}));
