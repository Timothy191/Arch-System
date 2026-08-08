# Bolt's Performance Journal

## 2026-08-08 - Composite Key Memoization in High-Density Grids
**Learning:** High-density components (like `HourlyLoadsGrid.tsx`) that handle large sets of data across multiple shifts (day/night) can suffer from severe rendering performance degradation. Memoizing the derived map using `useMemo` stabilizes dependent hooks (`useCallback` / `useMemo` for rows/columns). However, a simple map key is insufficient because data for different shifts under the same machine ID will overwrite each other. Using a composite key (`machine_id:shift_type`) is crucial to guarantee correct behavior.
**Action:** Always use composite keys for multi-shift/multi-dimensional lookups when creating memoized maps, and replace array `.find()` lookups with O(1) lookups on the memoized map to prevent O(R * M) rendering bottlenecks.
