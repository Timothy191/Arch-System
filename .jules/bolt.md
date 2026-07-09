## 2025-05-22 - Composite Key for Hourly Loads
**Learning:** When mapping hourly load data for grid components, use a composite key of `machine_id:shift_type` (e.g., 'm1:day') in the lookup Map to prevent day and night shift records for the same machine from overwriting each other.
**Action:** Always prefer composite keys when indexing multi-dimensional data (e.g., entity + time/shift/category) in memoized Maps to ensure data integrity and O(1) retrieval.

## 2025-05-22 - Stabilizing RevoGrid Columns
**Learning:** RevoGrid `cellTemplate` often captures stale closures if the `columns` definition doesn't include all external dependencies (like `machines` or `sites` props) in its `useMemo` dependency array.
**Action:** Ensure all props and state variables used within column templates are explicitly listed in the dependency array of the `columns` memoization to prevent rendering bugs.
