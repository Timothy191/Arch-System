# Bolt Performance Learnings

## 2026-10-15 - Single-Pass Memoized Aggregation for Emergency Roll Call

**Learning:** In real-time dashboard components (e.g. `MusterRollCallView`) that render status summary counters alongside per-category sub-counts, performing multiple separate `records.filter(...)` operations leads to $O(S \times R)$ repeated array iterations across render passes.
**Action:** Consolidate status counters and sub-category Map indexing into a single $O(R)$ `useMemo` loop to optimize render performance and prevent CPU thrashing during live status updates.

## 2026-10-30 - Production Command Center & High-Frequency Render Aggregations

**Learning:** Chained `.reduce()` calls on daily/monthly production ledgers and inline `.reduce()` traversals inside JSX `<tfoot>` rows cause redundant array iterations on every state transition or filter change.
**Action:** Consolidate multi-metric rollups in `getProductionDepartmentData` (`actions.ts`) into a single $O(N)$ accumulator pass and memoize `monthlyShiftTotals` via `useMemo` in `ProductionCommandCenterClient.tsx`.

## 2026-11-03 - Single-Pass Archive Rollups in Reports Analytics Helpers

**Learning:** `computeArchivedReportData` in `reports-analytics-helpers.ts` is invoked on every filter/search change in `ReportsDashboardClient` to supply toolbar badge counts (`monthlyRollups.length`, `historicalRows.length`). Chaining `filterShiftReportRows` + `for..of` + `.filter(r => r.date < todayStr)` performs 3 passes and allocates intermediate arrays.
**Action:** Combine row filtering, `monthlyRollups` Map accumulation, and `priorDaysRows` extraction into a single $O(N)$ loop.
