# Bolt's Performance Journal

## 2026-07-23 - Heavy Grid Re-renders via Un-memoized Derived Lookup Maps

**Learning:** Heavy data-grid components (such as those using RevoGrid / `DataGrid`) are extremely sensitive to reference changes of their config, source, and cells. In `HourlyLoadsGrid.tsx`, a lookup Map (`loadsByMachine`) was derived from raw props directly inside the render block on every render. Because this un-memoized Map was a dependency for multiple `useCallback` hooks (`getHourValue`, `getMachineTotal`, `getMaterialType`), these callbacks changed references on every single render. This reference instability cascaded into the `source` rows `useMemo` block, causing the grid's underlying data representation to be re-computed and re-rendered completely on every micro-update (such as when incrementing/decrementing load values), negating React's caching benefits.

**Action:** Always memoize derived lookup tables, Maps, and Sets with `useMemo` if they are passed as dependencies to `useCallback` or `useMemo` hooks. Additionally, replace O(N) array searching (`.find()`) inside event handlers with O(1) Map lookups to stabilize event handler references and improve interaction speeds.
