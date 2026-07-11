
## 2026-07-11 - Composite Key Pattern for Multi-Shift Data
**Learning:** Using a single ID as a Map key in components handling multi-shift data (e.g., HourlyLoadsGrid) leads to data overwriting when both day and night shift records exist for the same entity.
**Action:** Always use a composite key (e.g., `machine_id:shift_type`) when memoizing data lookups in high-density multi-shift grids to ensure data integrity and O(1) retrieval performance.
