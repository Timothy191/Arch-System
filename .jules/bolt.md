## 2026-08-22 - ExcavatorActivityList O(1) Assignment Lookup
**Learning:** Nested array `.filter()` inside React list rendering components causes quadratic $O(N \times M)$ runtime overhead during render cycles when dealing with multi-site, multi-shift dumper assignment lists.
**Action:** Index nested child records into a memoized Map (`useMemo`) keyed by parent ID before rendering loops to achieve $O(1)$ lookups and $O(N + M)$ complexity.
