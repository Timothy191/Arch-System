## 2026-06-30 - Memoize derived Map in HourlyLoadsGrid
**Learning:** Initializing a derived Map or Set directly in the render body of a component that uses heavy data-bound UI (like RevoGrid) causes downstream hooks and components to treat the reference as new on every render. This triggers "render cascades" and prevents effective memoization of heavy computation.
**Action:** Always wrap derived Map/Set initializations in `useMemo` with the source data as a dependency to ensure reference stability and prevent unnecessary re-renders of heavy children.
