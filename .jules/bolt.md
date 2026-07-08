## 2024-07-08 - Optimizing Background Intervals in Visibility-Gated Components
**Learning:** High-frequency UI updates (e.g., 1s intervals) in persistent global components like `SystemClock` cause unnecessary background re-renders when the UI is not visible.
**Action:** Use a visibility state (e.g., `isOpen` for Popovers) to condition high-frequency intervals and immediately sync state upon opening to ensure UI freshness.
