# Bolt's Performance Journal

## 2026-07-20 - Memoizing High-Density Component Derived Data structures
**Learning:** Re-instantiating heavy data structures (e.g., Maps or Sets) inside the render body of a component that utilizes heavy UI views (like RevoGrid) breaks React callback/memoization stability. When dependent getter callbacks (like `getHourValue` in `HourlyLoadsGrid.tsx`) are recreated because their dependency on the Map changes on every single render, the entire data grid column template is marked as updated, causing cascading, expensive re-renders and potential layout recalculations.
**Action:** Always wrap any computed/derived lookup structures in `useMemo` so that downstream `useCallback` references remain perfectly stable across renders. Furthermore, use composite keys (`machine_id:shift_type`) instead of raw IDs to avoid multi-shift collision issues in lookup tables.
