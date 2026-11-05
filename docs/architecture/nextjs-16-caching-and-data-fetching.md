# Next.js 16 Frontend-as-Backend: Caching, Data Fetching, Mutations & Security Policy

## 1. Overview

Arch-System (`apps/portal`) runs on **Next.js 16 App Router + React 19** with `cacheComponents: true`, `reactCompiler: true`, and `experimental.taint: true`. Data fetching, caching, mutations, and security follow a unified **Frontend-as-Backend** execution model backed by dual-tier caching (Next.js Data Cache + Redis L1/L2).

---

## 2. Explicit Caching (`'use cache'`, `cacheLife`, `cacheTag`)

### 2.1 Cache Directives & Dynamic API Isolation

- **`'use cache'`**: Used on shared server functions and read-only dashboard loaders (`apps/portal/lib/tools.ts`, `apps/portal/lib/hub-departments.ts`, `apps/portal/app/hub/page.tsx`, `apps/portal/app/hub/executive/page.tsx`, `apps/portal/app/(departments)/drilling/page.tsx`, `apps/portal/app/(departments)/engineering/page.tsx`).
- **No Dynamic Request APIs Inside `'use cache'`**: Functions or files with `'use cache'` must **never** call `cookies()` or `headers()` directly (enforced by `node tools/audits/audit-caching.cjs`). Pass serializable parameters (e.g., `userId`, `deptId`, `today`, or `cookieList`) from outside the cached scope.
- **`'use cache: private'`**: Reserved exclusively for per-request private caches that must read runtime request context and must never be shared across users.

### 2.2 Named `cacheLife` Profiles (`apps/portal/lib/server-cache.ts` & `next.config.mjs`)

| Profile               | `stale` (s) | `revalidate` (s) | `expire` (s) | Primary Use Case                                    |
| --------------------- | ----------- | ---------------- | ------------ | --------------------------------------------------- |
| `realtime`            | `5`         | `15`             | `60`         | Sub-minute live status indicators                   |
| `telemetry`           | `10`        | `10`             | `60`         | Control Room, Drilling, Engineering shift telemetry |
| `minutes`             | `10`        | `60`             | `300`        | Hub live department metrics                         |
| `reports`             | `60`        | `300`            | `3600`       | Shift closeout & reconciliation reports             |
| `hours`               | `60`        | `3600`           | `86400`      | Employee roles, clearance, accessible departments   |
| `departments` / `max` | `300`       | `3600`           | `86400`      | Static department metadata & configuration          |

### 2.3 Canonical Cache Tags (`apps/portal/lib/cache-tags.ts`)

All cache tags are centralized in [`apps/portal/lib/cache-tags.ts`](../../apps/portal/lib/cache-tags.ts) and re-exported from [`apps/portal/lib/server-cache.ts`](../../apps/portal/lib/server-cache.ts):

- `CACHE_TAGS.CONTROL_ROOM` (`'control-room'`), `CACHE_TAGS.SHIFT_CLOSEOUT` (`'shift-closeout'`), `CACHE_TAGS.MACHINE_OPERATIONS` (`'machine-operations'`), `CACHE_TAGS.OFFLINE_MUTATIONS` (`'offline-mutations'`)
- `CACHE_TAGS.TABLE_*` (`'table:machines'`, `'table:machine_operations'`, `'table:breakdowns'`, `'table:employees'`, `'table:departments'`, `'table:personnel'`, `'table:tools'`, `'table:hourly_loads'`, `'table:daily_logs'`, `'table:production_logs'`)
- Scoped tag builders: `tagDepartment(slug, resource)`, `tagTenant(tenantId, resource)`, `tagAuthUser(userId)`, `tagTable(tableName)`, `scopedTag(scope, id)`.

---

## 3. Dual-Tier Redis L1/L2 Cache, Negative Caching & Circuit Breaker

- **`withCache` (`libs/shared/utils/src/cache-utils.ts`)**:
  - Deduplicates concurrent in-flight fetches per key (`activePortalFetches`).
  - **Negative Caching**: Caches `null`/`undefined` results for `negativeCacheTtl` (default `30s`) when `allowNegativeCache: true` to prevent cache-penetration stampedes on missing records.
  - Rethrows `DatabaseError` immediately without caching error states.
- **Circuit Breaker (`packages/redis/src/client.ts`)**:
  - `redisCircuitBreaker` opens after 5 consecutive L2 Redis failures (`cooldownMs: 30_000`), short-circuiting L2 calls and falling back cleanly to L1 memory cache and Supabase read-through.

---

## 4. Mutating Data: Server Functions, Server Actions & Cache Invalidation

### 4.1 Invalidation Primitives Comparison

| Helper (`@/lib/server-cache`)                     | Execution Context                      | Behavior                                                                                                                         |
| ------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `await updateTag(tag)` / `updateTagInAction(tag)` | Server Actions (`'use server'`)        | **Read-your-writes**: Immediately expires Next.js Data Cache in the active request and purges Redis L1/L2 tag sets.              |
| `await revalidateTagInRouteHandler(tag, profile)` | Route Handlers (`app/api/**/route.ts`) | **Stale-While-Revalidate (SWR)**: Calls Next.js 16 `revalidateTag(tag, profile)` and purges Redis L1/L2 tag sets.                |
| `refreshAction()` (`refresh()`)                   | Server Actions (`'use server'`)        | **Dynamic Router Refresh**: Re-renders uncached dynamic RSC slices on the active page without invalidating tagged static caches. |

### 4.2 Mandatory Server Action Lifecycle

1. **Authenticate** via `getAuthenticatedEmployee()`.
2. **Authorize** employee role and `accessible_departments`.
3. **Validate** input payload via `@repo/contract` Zod `.safeParse()`.
4. **Rate-limit** via `@repo/rate-limiter`.
5. **Mutate** via parameterized Kysely / Supabase RPC.
6. **Invalidate Cache** (`await updateTag(...)`) **BEFORE** calling `redirect()` (since `redirect()` throws a control-flow exception).

---

## 5. Streaming, Waterfalls, Data Security & Hybrid SPAs

- **Streaming (`loading.tsx` & `<Suspense>` + `use(promise)`)**: Route segments provide `loading.tsx` skeletons; slow subtrees wrap in `<Suspense>` or stream promises to Client Components unwrapped with React 19 `use(promise)`.
- **Waterfall Elimination**: Independent queries execute in parallel via `Promise.all` / `Promise.allSettled`. Request-scoped lookups (`getDepartmentBySlug`, `getDepartmentContext`) use `React.cache()` + `STATIC_DEPT_UUIDS`.
- **Data Security & Tainting (`experimental.taint: true`)**: DAL modules enforce `import 'server-only'`, map DB rows to minimal DTOs before `'use client'` boundaries, and support `experimental_taintObjectReference` / `experimental_taintUniqueValue`.
- **Hybrid SPA Navigation**: Client components use `usePathname()` and `useSearchParams()` with `window.history.pushState` / `replaceState` for shallow filter/tab state updates, and `<SpeculationRules />` prerenders/prefetches department routes with `eagerness: "moderate"`.
