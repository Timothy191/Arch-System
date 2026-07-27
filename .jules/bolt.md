# Bolt's Performance Journal

## 2026-07-27 - High-Density Data Grid Re-Render and Shift Collision Safeguards
**Learning:** Instantiating standard lookup Maps inside the component render body (e.g., `loadsByMachine`) breaks `useCallback` hook dependency stability. This causes dependent hooks to regenerate on every single render, causing cascading re-renders down the heavy RevoGrid tree. Additionally, mapping hourly load data by only machine ID leads to data collisions between day and night shift records.
**Action:** Always wrap lookup Maps in `useMemo` to stabilize their reference. Ensure that composite keys like `${machine_id}:${shift_type}` are used in lookup Maps for grids that handle multi-shift telemetry. Optimize nested loops in bulk processing/spreadsheet imports by pre-mapping lookup arrays to memoized Maps to drop lookup complexity from $O(N)$ to $O(1)$.
