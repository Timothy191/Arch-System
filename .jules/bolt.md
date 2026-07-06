# Bolt's Performance Journal

## 2026-07-06 - [Memoize derived data structures in HourlyLoadsGrid]
**Learning:** Creating new Map/Set instances within the render body of a component that feeds props to a heavy third-party grid (like RevoGrid) causes cascading re-renders. This is because dependent hooks (useCallback, useMemo) that use these maps will have their references invalidated on every render.
**Action:** Always memoize derived data structures (e.g., `new Map()`) when they are used as dependencies for other hooks or passed to heavy components.
