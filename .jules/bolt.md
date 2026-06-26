## 2026-06-26 - [Memoize derived data in heavy components]
**Learning:** High-density components like DataGrid (RevoGrid) are sensitive to prop changes. Creating new object/map instances in the render body causes downstream memoized hooks (useCallback/useMemo) to invalidate, triggering heavy re-renders.
**Action:** Always memoize derived data structures (Maps, Sets, Filtered Arrays) that are used as dependencies for other hooks or passed as props to memoized components.
