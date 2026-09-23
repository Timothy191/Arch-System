## 2026-03-31 - Memoizing Aggregations in Virtualized Scrolling Components
**Learning:** Components using `@tanstack/react-virtual` (`useVirtualizer`) re-render continuously on every scroll event frame (up to 60-120 FPS). Performing array reductions (`reduce`) or calculations directly in the component render body causes significant CPU thrashing during scrolling.
**Action:** Wrap aggregate calculations in `useMemo` dependent on the input data array and combine multi-property aggregations into a single-pass `for` loop to keep scroll frame renders lightweight.
