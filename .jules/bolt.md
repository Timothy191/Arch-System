## 2025-07-01 - Memoization of Map in render body

**Learning:** Instantiating a `new Map()` or `new Set()` inside a component's render body without `useMemo` creates a new reference on every render. This causes any dependent `useCallback` or `useMemo` hooks to also re-run, leading to cascading re-renders of heavy components like `DataGrid`.
**Action:** Always wrap data structure transformations (like grouping into a Map) in `useMemo`, especially when they are used as dependencies in other hooks or passed to memoized components.
