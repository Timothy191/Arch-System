## 2025-05-18 - Pre-indexing Child Assignments in ExcavatorActivityList

**Learning:** In components rendering nested lists or card summaries with parent-child relationships (e.g., activities and dumper assignments), performing `assignments.filter()` per parent item during render creates an $O(N \times M)$ bottleneck. Pre-indexing child records into a `useMemo` `Map<string, Child[]>` keyed by parent ID reduces lookup complexity to $O(1)$ and total render complexity to $O(N + M)$.

**Action:** When rendering parent components with child list props, pre-index child items into a memoized Map before mapping over parent entries.
