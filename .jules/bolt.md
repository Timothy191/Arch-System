## 2026-06-25 - Hourly Loads Map Keys and Re-renders Optimization

**Learning:** Creating a new `Map` inside the render body of a heavy data component like `HourlyLoadsGrid.tsx` causes cascading re-renders because dependent hook references (like `useCallback` or `useMemo`) change on every single render. Additionally, mapping hourly load data needs to use a composite key of `machine_id:shift_type` in the lookup Map to prevent day and night shift records for the same machine from overwriting each other.

**Action:** Memoize any derived data structures (like maps or sets) created in the render body using `useMemo` so dependent hooks have stable references. Always use composite keys (`machine_id:shift_type`) for mapping records where multiple shifts can coexist for the same entity.
