## 2026-10-15 - Single-Pass Memoized Aggregation for Emergency Roll Call
**Learning:** In real-time dashboard components (e.g. `MusterRollCallView`) that render status summary counters alongside per-category sub-counts, performing multiple separate `records.filter(...)` operations leads to $O(S \times R)$ repeated array iterations across render passes.
**Action:** Consolidate status counters and sub-category Map indexing into a single $O(R)$ `useMemo` loop to optimize render performance and prevent CPU thrashing during live status updates.
