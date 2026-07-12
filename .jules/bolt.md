## 2026-06-25 - Stable Derived Data Structures for High-Density Grids

**Learning:** Creating new Map or Set instances within the render body of heavy data components (like `HourlyLoadsGrid.tsx`) causes cascading re-renders because every render produces a fresh object reference. This is especially impactful when these structures are used as dependencies in `useCallback` or `useMemo` hooks, or as props for optimized components like RevoGrid.

**Action:** Always memoize derived data structures using `useMemo`. When mapping multi-shift data for a single entity, use composite keys (e.g., `machine_id:shift_type`) to ensure data integrity and enable O(1) lookups in high-frequency event handlers, replacing O(N) linear searches.
