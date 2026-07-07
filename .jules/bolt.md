## 2026-07-07 - [Composite Map Key Performance Pattern]
**Learning:** High-density grids in this monorepo often derive data lookups in every render. This invalidates `useCallback` and `useMemo` hooks, causing cascading re-renders of heavy components like RevoGrid. Additionally, simple keys (like `machine_id`) can cause data loss when a machine has multiple records (e.g., across shifts).
**Action:** Always memoize lookup data structures using `useMemo`. Use composite keys (e.g., `machine_id:shift_type`) for lookups to ensure data integrity and O(1) performance.
