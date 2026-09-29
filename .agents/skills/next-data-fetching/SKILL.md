---
name: next-data-fetching
description: 'Next.js 16 Data Fetching and Streaming runbook: Server Components, React.cache() request memoization, Promise.allSettled parallelization, granular <Suspense> streaming, and zero-waterfall audits.'
version: '1.0.0'
---

# Next.js 16 Data Fetching & Streaming Runbook

**Governing Mandate:** All primary data persistence and telemetry queries MUST execute in Server Components, Server Actions, or Route Handlers via `@repo/supabase` or typed services. Client components must never directly import server database modules. Independent queries MUST be parallelized using `Promise.allSettled()` to prevent sequential request waterfalls.

---

## 1. Core Invariants & Rules

1. **Rule FETCH-001 (Server-First Data Access)**:
   - Primary database reads and sensitive telemetry queries MUST run in Server Components (RSC) or Server Actions.
   - **Hard Negative**: NEVER query Supabase or PostgreSQL directly inside `'use client'` files. Client components receive data via props, streamed promises, or typed Route Handlers (`/api/...`).

2. **Rule FETCH-002 (Waterfall Elimination)**:
   - Multiple independent data fetches within the same scope MUST be executed concurrently using `Promise.allSettled()` or `Promise.all()`.
   - **Hard Negative**: NEVER place sequential `await` calls on independent queries (`await getA(); await getB();` when `B` does not depend on `A`).

3. **Rule FETCH-003 (Request-Scoped Memoization)**:
   - Wrap non-fetch data functions (ORM queries, Supabase user identity lookups, Kysely queries) in `React.cache()`.
   - Multiple Server Components across a layout/page hierarchy calling the memoized function in the same request cycle will share one execution.

4. **Rule FETCH-004 (Granular Streaming with `<Suspense>`)**:
   - Wrap dynamic, uncached, or slow data components in `<Suspense fallback={<ComponentSkeleton />}>`.
   - Route groups must maintain a corresponding `loading.tsx` instant loading state.

5. **Rule FETCH-005 (Sensitive Data Taint / Zero-Leak)**:
   - Credentials, private keys, and unredacted audit fields must NEVER be returned to Client Components or exposed in client bundles.

---

## 2. Implementation Recipes & Code Patterns

### Recipe A: Server Component Direct Access with Supabase & RLS

```tsx
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { notFound, redirect } from 'next/navigation';

export default async function DepartmentDashboardPage({
  params,
}: {
  params: Promise<{ deptId: string }>;
}) {
  const { deptId } = await params;
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user) {
    redirect('/login');
  }

  const { data: department, error } = await supabase
    .from('departments')
    .select('id, name, code, status')
    .eq('id', deptId)
    .single();

  if (error || !department) {
    notFound();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{department.name}</h1>
    </div>
  );
}
```

### Recipe B: Parallel Data Fetching (`Promise.allSettled`)

```tsx
import { createServerSupabaseClient } from '@repo/supabase/server';

export async function fetchShiftMetrics(shiftId: string) {
  const supabase = await createServerSupabaseClient();

  // Initiate queries concurrently
  const loadsPromise = supabase.from('hourly_loads').select('*').eq('shift_id', shiftId);
  const delaysPromise = supabase.from('delay_entries').select('*').eq('shift_id', shiftId);
  const breakdownsPromise = supabase.from('breakdowns').select('*').eq('shift_id', shiftId);

  const [loadsRes, delaysRes, breakdownsRes] = await Promise.allSettled([
    loadsPromise,
    delaysPromise,
    breakdownsPromise,
  ]);

  return {
    loads: loadsRes.status === 'fulfilled' ? (loadsRes.value.data ?? []) : [],
    delays: delaysRes.status === 'fulfilled' ? (delaysRes.value.data ?? []) : [],
    breakdowns: breakdownsRes.status === 'fulfilled' ? (breakdownsRes.value.data ?? []) : [],
  };
}
```

### Recipe C: Request-Scoped Memoization with `React.cache()`

```ts
import { cache } from 'react';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';

/**
 * Request-memoized current user lookup.
 * Calling this across layout.tsx and page.tsx within the same request
 * triggers only ONE Supabase authentication round-trip.
 */
export const getCurrentUserMemoized = cache(async () => {
  const supabase = await createServerSupabaseClient();
  return getUserSafely(supabase);
});
```

### Recipe D: Streaming Unresolved Promises to Client via React 19 `use()`

```tsx
// app/telemetry/page.tsx (Server Component)
import { Suspense } from 'react';
import { MachineTelemetryFeed } from './MachineTelemetryFeed';
import { TelemetrySkeleton } from './TelemetrySkeleton';
import { getLiveTelemetryPromise } from '@/lib/telemetry';

export default function TelemetryPage() {
  // Eagerly initiate promise without awaiting
  const telemetryPromise = getLiveTelemetryPromise();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Live Telemetry</h1>
      <Suspense fallback={<TelemetrySkeleton />}>
        <MachineTelemetryFeed telemetryPromise={telemetryPromise} />
      </Suspense>
    </div>
  );
}

// app/telemetry/MachineTelemetryFeed.tsx (Client Component)
('use client');

import { use } from 'react';
import type { TelemetryPayload } from '@repo/contract';

export function MachineTelemetryFeed({
  telemetryPromise,
}: {
  telemetryPromise: Promise<TelemetryPayload[]>;
}) {
  const data = use(telemetryPromise);

  return (
    <ul className="divide-y divide-arch-border">
      {data.map((item) => (
        <li key={item.id} className="py-2 flex justify-between">
          <span className="font-mono">{item.machineId}</span>
          <span>{item.reading}</span>
        </li>
      ))}
    </ul>
  );
}
```

---

## 3. Verification & Quality Gates

Run these commands before completing any data fetching or server mutation task:

```bash
# 1. Audit boundary isolation and sequential waterfall queries
pnpm audit:data-fetching

# 2. Verify Next.js portal TypeScript compliance
pnpm --filter portal type-check

# 3. Run full monorepo compliance suite
pnpm audit:compliance
```
