## 2025-05-10 - O(N * M) Array Filtering in Nested List Cards
**Learning:** In components rendering nested lists or card summaries (e.g., `ExcavatorActivityList`), executing `.filter()` on child collections inside parent mapping loops introduces O(N * M) performance thrashing on re-renders. Pre-indexing child items into a `useMemo` Map keyed by the parent ID replaces repeated linear array scans with O(1) Map lookups.
**Action:** When mapping nested parent-child datasets in list components, construct a memoized `Map<parentId, ChildItem[]>` beforehand.
