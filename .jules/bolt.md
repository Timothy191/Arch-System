## 2026-08-05 - Hourly Loads Shift Map Overwrites and O(N) Array Search Bottleneck

**Learning:**
Creating non-memoized map structures within the render body of heavy data components (e.g., `HourlyLoadsGrid.tsx`) triggers expensive O(N) map creations on every render cycle. Additionally, because the grid maps dump truck load data across both Day and Night shifts, using a plain `machine_id` as the map key causes records from different shifts to overwrite each other. When mapping or updating such high-frequency data, a composite key such as `machine_id:shift_type` (e.g., `'m1:day'`) is required.

Furthermore, event handlers like `handleCellChange`, `handleMaterialToggle`, and `handleAfterEdit` previously used `hourlyLoads.find(...)`, resulting in O(N) array scans during high-frequency user interactions. Replacing these with O(1) lookups via the memoized composite-keyed Map minimizes processing overhead and ensures rapid, stable responsiveness during editing.

**Action:**
1. Memoize any map-like data structures derived from props or dynamic state within heavy data grids using `useMemo`.
2. Construct composite keys when indexing entities with overlapping properties across different categories/shifts (e.g., `${machine_id}:${shift_type}`).
3. Leverage the memoized Map inside useCallback event handlers to replace slow `array.find()` / `array.filter()` O(N) operations with O(1) key lookups.
