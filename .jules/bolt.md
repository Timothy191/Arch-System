## 2026-07-16 - HourlyLoadsGrid Performance & Edge Compatibility
**Learning:**
1. Recreating Maps on every render in high-density components (like HourlyLoadsGrid) invalidates dependent hooks and causes heavy grid components (RevoGrid) to re-render or remount, significantly impacting performance.
2. Composite keys (e.g., 'machine:shift') are essential for maintaining multi-shift data integrity in a single lookup Map.
3. 'prom-client' is not Edge-compatible because it accesses 'process.uptime'; this can crash Next.js middleware if not safely wrapped.

**Action:**
1. Always memoize lookup Maps in render bodies.
2. Use O(1) Map lookups instead of O(N) .find() in event handlers and renderers.
3. Ensure observability libraries are Edge-safe before using them in middleware paths.
