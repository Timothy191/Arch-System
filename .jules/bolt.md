## 2025-05-15 - [Memoize derived data structures in render]
**Learning:** Instantiating a `new Map()` or `new Set()` directly in the render body of a component causes dependent hooks (`useCallback`, `useMemo`) to re-run on every render because the object reference is never stable. In high-density components like `HourlyLoadsGrid.tsx`, this can trigger cascading re-renders of heavy components like `DataGrid`.
**Action:** Always wrap derived data structure creation in `useMemo` when they are used as dependencies in other hooks.
