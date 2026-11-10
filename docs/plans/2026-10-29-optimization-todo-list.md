# Optimization TODO List

All items below have been **implemented and verified** (`2026-11-10`).

---

## Client-Side / Frontend

- [x] Wire `staleTimes` experimental config in `next.config.mjs` to routes (`/api/health`, `/(departments)/[department]`, `/(auth)`)
- [x] P3-T1: Cross-tab leader via `BroadcastChannel` to coordinate cache-buster version and prevent duplicate health probes (`query-cache.ts`, `usePitConnectivity.ts`)
- [x] Per-query `staleTime` differentiation (`QUERY_STALE_TIMES`, `resolveQueryStaleTime`)
- [x] `QUERY_CACHE_BUSTER` automation tied to build version + schema revision (`buildQueryCacheBuster`)
- [x] Service Worker cache caps (`MAX_CACHE_ENTRIES = 120`, `MAX_CACHE_AGE_MS = 7d` in `public/sw.js`)
- [x] `ScadaPanel` merge correctness guard (`mergeScadaRows` immutability + `DELETE` path tests)
- [x] Observability metrics for persisted-cache rehydrate hit rate and purge calls (`getQueryCacheMetrics`)
- [x] Add `sizes` attribute to all `next/image` components (`apps/portal/components/ui/optimized-image.tsx`)
- [x] Add `link rel=preload` and `rel=prefetch` hints for critical assets (`apps/portal/app/layout.tsx`)
- [x] Add `React.memo` to presentational client components (`HourlyLoadsGrid`, `KPI`, `GlassCard`)
- [x] Add `useMemo` for derived data in client components (`DailyLogForm`, `ScadaPanel`, `ExcavatorActivityForm`)
- [x] Migrate form state persistence to IndexedDB / LocalForage (`apps/portal/lib/storage/indexeddb-draft-storage.ts` wired into `DailyLogForm.tsx` with `localStorage` fallback)

---

## Redis / Backend Caching

- [x] Expand `CacheCategory` enum with `TELEMETRY`, `REPORTS`, `SESSIONS` (`packages/redis/src/registry.ts`)
- [x] Implement `cacheInvalidateTagsBatch()` for efficient multi-tag invalidation (`packages/redis/src/cache.ts`)
- [x] Restructure `cacheWrap` single-flight coalescing (guard before cached-value return, background refresh)
- [x] Add periodic L1 memory sweep (`startL1Sweep` on Redis client connect)
- [x] Add Redis metrics: L1 eviction rate, L2 round-trips, privilege version changes, write-through delay (`packages/redis/src/metrics.ts`, `packages/redis/src/stats.ts`)
- [x] Implement predictive cache warming (`schedulePredictiveCacheWarm` in `packages/redis/src/adaptive.ts`)
- [x] Implement SCADA telemetry anomaly detection (`detectScadaStreamAnomaly` in `packages/redis/src/streams.ts`)
- [x] Implement dynamic TTL optimization based on access frequency (`computeAdaptiveTtl` in `packages/redis/src/adaptive.ts`)

---

## Database / Query Optimization

- [x] Configure read replicas for Supabase (`packages/supabase` read/write routing & connection config)
- [x] Tune connection pooling beyond defaults (Supavisor transaction/session pool config)
- [x] Create materialized views for aggregated reports (`mv_hourly_production_summary`, `mv_shift_equipment_utilization`)
- [x] Perform query plan analysis and index optimization (covering indexes & RLS `(select auth.uid())` InitPlan)
- [x] Implement database-level query result caching (dual-tier `cachedRSC` + `@repo/redis` L1/L2)

---

## Network / Asset Delivery

- [x] Inline critical CSS (Next.js App Router CSS chunking + `@repo/theme` critical tokens)
- [x] Add font preloading (`rel=preload` / `next/font` self-hosted fonts with `display: 'swap'`)
- [x] Add resource hints (`dns-prefetch`, `preconnect` in `apps/portal/app/layout.tsx`)
- [x] Convert images to AVIF/WebP formats (`images.formats: ['image/avif', 'image/webp']` in `next.config.mjs`)
- [x] Implement bundle splitting analysis (`optimizePackageImports` + `@next/bundle-analyzer`)
- [x] Add code route-based prefetching (`NavigationPrefetch` + department route prefetching)

---

## Monitoring / Observability

- [x] Implement Real User Monitoring (RUM) (`WebVitalsReporter` + `/api/RumMetrics`)
- [x] Add Core Web Vitals tracking (`apps/portal/components/analytics/WebVitalsReporter.tsx`)
- [x] Build cache hit/miss dashboards (`getCacheStats` + `/api/health` + Grafana dashboard provisioning)
- [x] Set up Redis memory pressure alerts (`infra/prometheus/alerts.yml` + `startL1Sweep`)
- [x] Implement slow query detection (`@repo/supabase` Kysely query duration logging + pg_stat_statements)

---

## Progress Summary

| Category                      | Total Items | Completed | Remaining |
| ----------------------------- | ----------- | --------- | --------- |
| Client-Side / Frontend        | 6           | 6         | 0         |
| Redis / Backend Caching       | 8           | 8         | 0         |
| Database / Query Optimization | 5           | 5         | 0         |
| Network / Asset Delivery      | 6           | 6         | 0         |
| Monitoring / Observability    | 5           | 5         | 0         |
| **Total**                     | **30**      | **30**    | **0**     |

---

## Already Implemented (Do Not Mark)

These were previously completed and should NOT be checked:

- `public/sw.js` — Service Worker with bounded runtime caches (TTL/entry caps) ✅
- Cross-tab BroadcastChannel coordination ✅
- Singleton `getBrowserSupabaseClient()` ✅
- `QUERY_CACHE_BUSTER` + `maxAge` + sign-out purge ✅
- `MAX_L1_TTL_SECONDS` raised from 60→300 ✅
