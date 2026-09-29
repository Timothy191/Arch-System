---
name: next-caching
description: "Next.js 16 Caching and Cache Components runbook: 'use cache' directives, cacheLife profiles, cacheTag on-demand invalidation, dynamic API isolation, static App Shell optimization, and audit compliance."
version: '1.0.0'
---

# Next.js 16 Caching & Cache Components Runbook

**Governing Mandate:** Arch-System enforces Next.js 16 Cache Components (`cacheComponents: true` in `apps/portal/next.config.mjs`) alongside two-tier L1/L2 Redis caching (`@repo/redis`). Data fetching and UI computations must declare clear caching intent using the `'use cache'` directive paired with explicit `cacheLife()` profiles (`telemetry`, `departments`, `reports`, etc.). Dynamic runtime APIs (`cookies()`, `headers()`) must be isolated behind `<Suspense>` boundaries to preserve static prerendering of the App Shell.

---

## 1. Core Invariants & Architectural Rules

1. **Rule CACHE-001 (Cache Components Invariant)**:
   - Next.js 16 Cache Components is enabled via `cacheComponents: true` in `apps/portal/next.config.mjs`.
   - Use `'use cache'` at the **data-level** (inside async data fetching functions) or **UI-level** (inside async component functions or page shells).
   - Functions with `'use cache'` serialize arguments into the cache key; arguments and captured closure values must be serializable.

2. **Rule CACHE-002 (Explicit Profile Invariant)**:
   - Every `'use cache'` directive SHOULD be explicitly paired with a `cacheLife()` profile (e.g. `cacheLife('telemetry')`, `cacheLife('departments')`, `cacheLife('reports')`, or built-in `'seconds'`, `'minutes'`, `'hours'`, `'days'`, `'weeks'`, `'max'`).
   - Unprofiled caches fall back to implicit `default`, which may not match mission-critical telemetry latency needs.
   - Profile constraints in `next.config.mjs`: `stale <= revalidate <= expire`.

3. **Rule CACHE-003 (Tag-Based Invalidation Parity)**:
   - Cache entries should be tagged with `cacheTag('prefix_' + id)` for targeted on-demand invalidation.
   - Any mutating Server Action or Route Handler (`POST`, `PATCH`, `DELETE`) modifying telemetry or department state MUST trigger cache invalidation via `cacheInvalidateTags()` (`@repo/redis`) or `revalidateTag()`.

4. **Rule CACHE-004 (Dynamic API Boundary Isolation)**:
   - Dynamic runtime APIs (`cookies()`, `headers()`, `searchParams`, dynamic `params`) MUST NOT be called inside a cached function scope (`'use cache'`).
   - In Server Components, isolate dynamic consumers inside leaf components wrapped in `<Suspense fallback={<Skeleton />}>` so the parent layout/page shell can be statically prerendered and cached.

5. **Rule CACHE-005 (Runtime Values & Timestamp Isolation)**:
   - Uncached per-request values (`Date.now()`, `Math.random()`, `crypto.randomUUID()`) accessed during rendering trigger dynamic warnings unless wrapped in `connection()` inside `<Suspense>`.
   - If a timestamp or random value should be fixed across requests, compute it inside a function with `'use cache'` and an appropriate `cacheLife`.

6. **Rule CACHE-006 (Tenant & Identity Cache Sandboxing)**:
   - Never cache tenant-scoped or user-specific data using global, unnamespaced cache keys.
   - All tenant cache keys and tags MUST include composite identifiers: `dept_${departmentId}`, `user_${userId}`, `shift_${shiftId}`.

---

## 2. Next.js 16 CacheLife Profiles (`next.config.mjs`)

Defined in `apps/portal/next.config.mjs`:

```javascript
cacheLife: {
  telemetry: {
    stale: 5,       // Client can use stale data up to 5s without background refresh
    revalidate: 10,  // Revalidation triggered in background after 10s
    expire: 30,      // Purged completely from memory/Redis after 30s
  },
  departments: {
    stale: 300,      // 5 minutes stale threshold
    revalidate: 3600, // 1 hour background revalidation
    expire: 86400,   // 24 hours TTL
  },
  reports: {
    stale: 60,
    revalidate: 300,
    expire: 1800,
  },
}
```

---

## 3. Implementation Recipes & Code Patterns

### Recipe A: Data-Level Function Caching with `use cache`

```tsx
import { cacheLife, cacheTag } from 'next/cache';
import { createServerSupabaseClient } from '@repo/supabase/server';

export async function getDepartmentSummary(deptId: string) {
  'use cache';
  cacheLife('departments');
  cacheTag(`dept_${deptId}`, 'departments_summary');

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code, active_personnel_count')
    .eq('id', deptId)
    .single();

  if (error) throw error;
  return data;
}
```

### Recipe B: UI-Level Component Caching

```tsx
import { cacheLife, cacheTag } from 'next/cache';
import { GlassCard } from '@repo/ui';

export async function DepartmentKPICard({ deptId }: { deptId: string }) {
  'use cache';
  cacheLife('telemetry');
  cacheTag(`dept_kpi_${deptId}`);

  const summary = await getDepartmentSummary(deptId);

  return (
    <GlassCard variant="spotlight" className="p-4">
      <h3 className="text-sm font-semibold text-color-text-primary">{summary.name}</h3>
      <p className="text-2xl font-mono text-color-action-primary mt-2">
        {summary.active_personnel_count}
      </p>
    </GlassCard>
  );
}
```

### Recipe C: Dynamic Data Streaming with `<Suspense>` & `connection()`

```tsx
import { Suspense } from 'react';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { KPISkeleton } from '@repo/ui';

async function UserShiftStatus() {
  // Explicitly signal dynamic uncached per-request execution
  await connection();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('arch_session')?.value;

  // Render per-user session indicator
  return <div>Session Active: {Boolean(sessionToken)}</div>;
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Static cached page shell renders instantly */}
      <h1 className="text-2xl font-bold">Shift Operations</h1>

      {/* Dynamic user session streams in without de-optimizing the shell */}
      <Suspense fallback={<KPISkeleton />}>
        <UserShiftStatus />
      </Suspense>
    </div>
  );
}
```

### Recipe D: Tag Invalidation in Server Actions

```tsx
'use server';

import { revalidateTag } from 'next/cache';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';

export async function updateDepartmentQuota(deptId: string, quota: number) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('departments')
    .update({ daily_quota: quota })
    .eq('id', deptId);

  if (error) throw error;

  // Invalidate Next.js cache entries
  revalidateTag(`dept_${deptId}`);
  revalidateTag('departments_summary');

  // Invalidate L1/L2 Redis entries across distributed field terminals
  await cacheInvalidateTags([`dept_${deptId}`, 'departments']);

  return { success: true };
}
```

---

## 4. Architectural Coexistence: Cache Components vs Legacy Models

| Concern               | Legacy Model (Next.js 14/15)                               | Cache Components (Next.js 16)                     | Arch-System Mandate                                                                       |
| :-------------------- | :--------------------------------------------------------- | :------------------------------------------------ | :---------------------------------------------------------------------------------------- |
| **Data Caching**      | `fetch(url, { next: { revalidate } })` or `unstable_cache` | `'use cache'` + `cacheLife()`                     | Prefer `'use cache'` for async functions; use `@repo/redis` for cross-tier distributed L2 |
| **Component Caching** | Not natively supported (full route ISR only)               | `'use cache'` directly inside component functions | Use for expensive KPI cards and layout trees                                              |
| **Dynamic Access**    | Declaring `export const dynamic = 'force-dynamic'`         | `<Suspense>` + `connection()`                     | Isolate dynamic calls inside `<Suspense>`; do NOT force entire routes dynamic             |
| **Tag Invalidation**  | `revalidateTag(tag)`                                       | `revalidateTag(tag)` or `updateTag(tag)`          | Dual invalidation: `revalidateTag()` + `cacheInvalidateTags()`                            |

---

## 5. Verification & Quality Gates

Run the dedicated caching auditor:

```bash
pnpm audit:caching
```

Or verify across the full compliance suite:

```bash
pnpm audit:compliance
```
