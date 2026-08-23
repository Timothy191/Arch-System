## 2026-08-23: Pre-index Dumper Assignments in ExcavatorActivityList to Optimize Render Performance

### Purpose
Optimize rendering performance in `ExcavatorActivityList.tsx` by replacing redundant nested $O(A \times N)$ array `.filter()` calls with an $O(A + N)$ pre-indexed Map lookup and memoizing site grouping logic.

### Changes Made
1. **`apps/portal/app/(departments)/[department]/excavator-activity/ExcavatorActivityList.tsx`**:
   - Added `useMemo` Map lookup (`assignmentsByActivityId`) to index `todayAssignments` by `excavator_activity_id`.
   - Memoized site grouping logic (`siteEntries`) with `useMemo` to prevent unnecessary grouping calculations when unrelated state triggers re-renders.
   - Replaced linear `.filter()` operations across site aggregate header calculations and individual `ActivityCard` props with $O(1)$ Map lookups (`assignmentsByActivityId.get(...) ?? []`).
2. **`apps/portal/app/(departments)/[department]/excavator-activity/ExcavatorActivityList.test.tsx`**:
   - Created comprehensive unit test suite covering site grouping, shift details, assignment lookup, and aggregate total calculations (BCM/loads).

### Verification
- `pnpm --filter portal test -- ExcavatorActivityList`: PASS (3 tests passed)
- `pnpm --filter portal lint`: PASS (0 warnings)
- `pnpm --filter portal test`: PASS (85 test suites, 659 tests passed)

### What the Next Agent Should Know
- Pre-indexing nested array relations into `Map` structures via `useMemo` is a key performance pattern across high-density portal components (e.g. `ExcavatorActivityList`, `HourlyLoadsGrid`).
- When rendering lists or cards containing child relations, prefer $O(1)$ Map lookups over linear `.filter()` lookups in render iterations.
