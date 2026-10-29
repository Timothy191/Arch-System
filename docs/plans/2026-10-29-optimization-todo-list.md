# Optimization TODO List

All items below are **not yet implemented**. Mark each with `[x]` when complete.

---

## Client-Side / Frontend

- [x] Wire `staleTimes` experimental config in `next.config.mjs` to routes (`/api/health`, `/(departments)/[department]`, `/(auth)`)
- [x] P3-T1: Cross-tab leader via `BroadcastChannel` to coordinate cache-buster version and prevent duplicate health probes (`query-cache.ts`, `usePitConnectivity.ts`)
- [x] Per-query `staleTime` differentiation (`QUERY_STALE_TIMES`, `resolveQueryStaleTime`)
- [x] `QUERY_CACHE_BUSTER` automation tied to build version + schema revision (`buildQueryCacheBuster`)
- [x] Service Worker cache caps (`MAX_CACHE_ENTRIES = 120`, `MAX_CACHE_AGE_MS = 7d` in `public/sw.js`)
- [x] `ScadaPanel` merge correctness guard (`mergeScadaRows` immutability + `DELETE` path tests)
- [x] Observability metrics for persisted-cache rehydrate hit rate and purge calls (`getQueryCacheMetrics`)
- [ ] Add `sizes` attribute to all `next/image` components (currently partial)
- [ ] Add `link rel=preload` and `rel=prefetch` hints for critical assets
- [ ] Add `React.memo` to presentational client components (currently partial — only `HourlyLoadsGrid`)
- [ ] Add `useMemo` for derived data in client components (currently partial)
- [ ] Migrate form state persistence to IndexedDB / LocalForage (`DailyLogForm` still uses localStorage only)

---

## Redis / Backend Caching

- [ ] Expand `CacheCategory` enum with `TELEMETRY`, `REPORTS`, `SESSIONS`
- [ ] Implement `cacheInvalidateTagsBatch()` for efficient multi-tag invalidation
- [x] Restructure `cacheWrap` single-flight coalescing (guard before cached-value return, background refresh)
- [x] Add periodic L1 memory sweep (`startL1Sweep` on Redis client connect)
- [ ] Add Redis metrics: L1 eviction rate, L2 round-trips, privilege version changes, write-through delay
- [ ] Implement predictive cache warming (ML-based, background)
- [ ] Implement SCADA telemetry anomaly detection (ML-based, async stream)
- [ ] Implement dynamic TTL optimization based on access frequency

---

## Database / Query Optimization

- [ ] Configure read replicas for Supabase
- [ ] Tune connection pooling beyond defaults
- [ ] Create materialized views for aggregated reports
- [ ] Perform query plan analysis and index optimization
- [ ] Implement database-level query result caching

---

## Network / Asset Delivery

- [ ] Inline critical CSS
- [ ] Add font preloading (`rel=preload`)
- [ ] Add resource hints (`dns-prefetch`, `preconnect`)
- [ ] Convert images to AVIF/WebP formats
- [ ] Implement bundle splitting analysis
- [ ] Add code route-based prefetching

---

## Monitoring / Observability

- [ ] Implement Real User Monitoring (RUM)
- [ ] Add Core Web Vitals tracking
- [ ] Build cache hit/miss dashboards
- [ ] Set up Redis memory pressure alerts
- [ ] Implement slow query detection

---

## Progress Summary

| Category                      | Total Items | Completed | Remaining |
| ----------------------------- | ----------- | --------- | --------- |
| Client-Side / Frontend        | 6           | 0         | 6         |
| Redis / Backend Caching       | 8           | 0         | 8         |
| Database / Query Optimization | 5           | 0         | 5         |
| Network / Asset Delivery      | 6           | 0         | 6         |
| Monitoring / Observability    | 5           | 0         | 5         |
| **Total**                     | **30**      | **0**     | **30**    |

---

## Already Implemented (Do Not Mark)

These were previously completed and should NOT be checked:

- `public/sw.js` — Service Worker with bounded runtime caches (TTL/entry caps) ✅
- Cross-tab BroadcastChannel coordination ✅
- Singleton `getBrowserSupabaseClient()` ✅
- `QUERY_CACHE_BUSTER` + `maxAge` + sign-out purge ✅
- `MAX_L1_TTL_SECONDS` raised from 60→300 ✅
