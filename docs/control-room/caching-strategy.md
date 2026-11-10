# Control Room Caching Strategy (`TASK-13.8`)

**Audience:** Platform Engineers, Performance Engineers, Backend Developers  
**Department:** Control Room (`/control-room`)

---

## 1. Dual-Tier Cache Architecture

Control Room read paths use Arch-System's dual-tier caching layer (`apps/portal/lib/cache-utils.ts`, `apps/portal/lib/server-cache.ts`, and `@repo/redis`):

1. **L1 In-Memory / Next.js Data Cache (`cachedRSC`):** Sub-millisecond per-instance request deduplication and short-lived server component caching.
2. **L2 Distributed Redis Cache (`@repo/redis`):** Shared cross-instance cache with tag-based invalidation and deterministic key namespaces.
3. **Client Cache (TanStack Query):** Browser-side query cache with `localStorage` persistence and automatic invalidation via Supabase Realtime CDC (`useSupabaseRealtime`).

---

## 2. Cache Keys, Categories & TTLs

| Domain Surface                 | Cache Key Pattern / Category                                   | TTL                                   | Tags                                                                                                                                                                                               |
| :----------------------------- | :------------------------------------------------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shift Completeness & Sheet** | `CacheCategory.SHIFT` (`shift:<deptId>:<slug>:<date>:<shift>`) | `60s` (live shift) / `3600s` (closed) | `dept:<deptId>`, `table:machines`, `table:machine_operations`, `table:excavator_activity`, `table:dozer_rolls`, `table:hourly_loads`, `table:delay_entries`, `table:breakdowns`, `table:operators` |
| **SCADA Telemetry Fallback**   | `scada:machines:<departmentId>`                                | `300s` (5 mins)                       | `dept:<deptId>`, `scada:telemetry`                                                                                                                                                                 |
| **PIN Attempt Counter**        | `cr:pin:attempts:<userId>`                                     | `300s` (5 mins)                       | Security rate-limit state                                                                                                                                                                          |
| **PIN Lockout State**          | `cr:pin:lockout:<userId>`                                      | `900s` (15 mins)                      | Security lockout state                                                                                                                                                                             |

---

## 3. Cache Invalidation Rules

1. **Zero Partial Caching on Query Failure:**
   - `getShiftCompleteness` invokes `assertQuerySucceeded` on all six underlying table queries before returning. Any Supabase error throws a `DatabaseError` so `withCache` never caches incomplete or degraded shift sheets.
2. **Mutation-Driven Tag Invalidation:**
   - Every Server Action and API route mutating Control Room records calls `updateTagInAction` (before any `redirect()`) for both the scoped department tag (`dept:<departmentId>`) and the affected table tag (`table:machine_operations`, `table:hourly_loads`, etc.).
3. **Realtime Client Sync:**
   - `useSupabaseRealtime` subscribes to Postgres CDC changes on `machine_operations`, `hourly_loads`, `breakdowns`, and `shifts`, invalidating matching TanStack Query keys without manual polling.

---

## 4. Cache Monitoring & Health Verification

- **Health Endpoint:** `GET /api/health/redis` reports Redis connection status, command latency, memory utilization, and cache hit rate.
- **Fallback Behavior:** If Redis is unreachable, `withCache` logs a structured warning via `@repo/logger` and falls back to direct Supabase reads so Control Room operations remain non-blocking.
