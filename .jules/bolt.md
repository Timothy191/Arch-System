## 2026-06-26 - High-Frequency Timer Gating via Popover Visibility

**Learning:** High-frequency clock updates (e.g. 1-second intervals for analog hands) in globally mounted components like `SystemClock` cause massive, continuous rendering cycles on the main thread across the entire application even when the UI is closed. Gating these intervals on the visibility state (like `isOpen` of the Popover) completely eliminates this idle overhead.
**Action:** When designing timer-based or real-time UI components, restrict high-frequency intervals (<= 1s) to run only when the specific UI is visible/open. Immediately synchronize state on opening to prevent any visible latency from slower background sync intervals.
