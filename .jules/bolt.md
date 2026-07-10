## 2026-07-10 - [Memoize High-Density Grid Data Lookups]
**Learning:** High-density components like HourlyLoadsGrid that transform arrays into lookup Maps on every render cause significant overhead and can lead to cascading re-renders of heavy components like RevoGrid. Using a simple machine_id as a key was also an anti-pattern that caused data overwriting when multiple shifts were present.
**Action:** Always memoize derived data structures (Maps/Sets) in heavy components and use composite keys (e.g., machine_id:shift_type) for uniqueness across the full dataset.
