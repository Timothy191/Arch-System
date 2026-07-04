# Bolt Performance Journal

## 2026-07-04 - Memoize derived Map in DataGrid wrapper

**Learning:** Derived data structures (like `new Map()`) created in the render body of a component act as unstable references. Even if the underlying data hasn't changed, a new reference triggers re-renders of children that use it as a prop or dependency. In heavy components like `HourlyLoadsGrid` that wrap `DataGrid`, this causes significant overhead.

**Action:** Always memoize derived lookups and maps that are used as dependencies for other hooks or props for memoized child components.
