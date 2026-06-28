## 2025-05-15 - [Memoization of Lookup Maps]
**Learning:** High-density dashboards in Next.js/React can suffer from performance degradation when large lookup maps or filter results are recreated on every render, especially when they are dependencies for other hooks or heavy components like RevoGrid.
**Action:** Always memoize derived data structures (Maps, Sets, filtered arrays) using `useMemo` when they are used in the render body or passed as dependencies.
