# Bolt's Performance Journal

## 2026-06-26 - Stabilizing High-Density Telemetry Grid Renders via Memoized Composite Map Lookups
**Learning:** Recreating derived Map structures inside the render body of heavy, high-density data components (like `HourlyLoadsGrid.tsx` which wraps RevoGrid) breaks React's dependency tracking for dependent `useCallback` and `useMemo` hooks. This completely bypasses rendering optimization and triggers cascading re-renders on every minor user action. Furthermore, failing to account for composite keys (e.g. `machine_id:shift_type`) leads to data overwrites when multiple shifts' records exist in the prop array.
**Action:** Always memoize derived collection structures (Maps, Sets) created from props. Use a unique composite key representing all dimensions of the row/cell (e.g., `machine_id:shift_type`) to stabilize the Map reference and downstream hook dependencies, while avoiding O(N) linear scans (`.find()`) in high-frequency event handlers.
