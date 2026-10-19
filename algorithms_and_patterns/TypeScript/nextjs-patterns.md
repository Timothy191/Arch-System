# TypeScript & Next.js Patterns (Arch-System SSoT)

> **ARCH-SYSTEM MONOREPO INVARIANT**: Standardized patterns for Next.js 16 (Turbopack), React 19 (Server Components, Actions, Taint), dual-tier caching (Redis L1/L2), and strict light-mode UI architecture.

---

## 1. React Server Components (RSC) & Boundary Architecture

All page layouts and views in `apps/portal` default to React Server Components unless explicit user interaction or browser API access is required.

```
+-------------------------------------------------------------------+
|  Server Component (RSC)                                           |
|  - Direct database queries via @repo/supabase                     |
|  - Two-tier caching via withCache() / 'use cache'                 |
|  - Sensitive secret handling & React 19 Taint APIs                |
|  - Parallel non-blocking data fetching via Promise.allSettled()   |
+-------------------------------------------------------------------+
                                  |
                   (Props must be serializable)
                                  v
+-------------------------------------------------------------------+
|  Client Component ('use client')                                  |
|  - State: useState(), useReducer(), @tanstack/react-query         |
|  - Custom hooks: useDepartmentFilter, usePinnedDepartments        |
|  - Event dispatching via lib/event-manager.ts                     |
|  - Deferred dynamic imports: next/dynamic with { ssr: false }     |
+-------------------------------------------------------------------+
```

### Invariants & Hard Rules

1. **Zero Raw Queries in Client**: NEVER import `@repo/supabase/server` or execute direct SQL queries in `'use client'` components.
2. **Streaming Promises**: Pass unresolved promises from RSC to Client Components wrapped in `<Suspense>` and unwrap via React 19 `use(promise)`.
3. **Pure Presentational UI**: Components in `packages/ui` must remain strictly presentational (zero business logic or data fetching).
4. **Strict Light Mode**: All UI styling must use semantic OKLCH tokens from `@repo/theme` (canvas `#f3f4f6`). NEVER use `dark:` Tailwind classes.

---

## 2. Server Action RPC Pipeline Pattern

Server Actions (`'use server'`) serve as typed mutation RPCs. Every mutation MUST adhere to the 7-step pipeline:

```typescript
'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { authGuard } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { shiftCloseoutSchema, type ShiftCloseoutInput } from '@repo/contract';
import { createSupabaseServerClient } from '@repo/supabase/server';

export async function submitShiftCloseout(rawInput: unknown) {
  // Step 1: Authentication & Session Verification
  const user = await authGuard();

  // Step 2: Role Authorization
  if (!user.roles.includes('supervisor') && !user.roles.includes('admin')) {
    throw new Error('UNAUTHORIZED_ROLE');
  }

  // Step 3: Contract Schema Validation
  const validated = shiftCloseoutSchema.parse(rawInput);

  // Step 4: Distributed Rate Limiting (Redis)
  const rateLimit = await checkRateLimit(`shift_closeout:${user.id}`, {
    limit: 10,
    windowMs: 60000,
  });
  if (!rateLimit.allowed) {
    throw new Error('RATE_LIMIT_EXCEEDED');
  }

  // Step 5: Database Mutation via Atomic RPC
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('close_shift_atomic', {
    p_shift_id: validated.shiftId,
    p_operator_id: user.id,
    p_notes: validated.notes,
  });

  if (error) {
    throw new Error(`MUTATION_FAILED: ${error.message}`);
  }

  // Step 6: Cache Invalidation (Tags & Paths)
  revalidateTag(`dept_${validated.departmentId}`);
  revalidateTag('telemetry_live');

  // Step 7: Redirection (MUST be the final statement)
  redirect(`/departments/${validated.departmentId}/history`);
}
```

---

## 3. Dual-Tier Caching & Single-Flight Deduplication

Data fetching integrates Next.js 16 Cache Components with distributed Redis (L1 Memory LRU + L2 Redis).

### Single-Flight Request Coalescing Pattern

Prevents cache stampedes by deduplicating concurrent promises for identical cache keys:

```typescript
// libs/shared/utils/src/cache-utils.ts
const activeFetches = new Map<string, Promise<any>>();

export async function withCache<T>(
  fn: () => Promise<T>,
  options: { category: CacheCategory; keyParts?: (string | number)[]; tags?: string[] }
): Promise<T> {
  const key = buildCacheKey(options.category, ...(options.keyParts || []));

  // 1. Try cache read
  const cached = await cacheGetWithStats<T>(key);
  if (cached.value !== null) return cached.value;

  // 2. Coalesce in-flight promise (Single-Flight)
  let activeFetch = activeFetches.get(key);
  if (!activeFetch) {
    activeFetch = fn()
      .then(async (result) => {
        await cacheSetWithTags(key, result, getTTL(options.category), options.tags);
        return result;
      })
      .finally(() => activeFetches.delete(key));

    activeFetches.set(key, activeFetch);
  }

  return activeFetch;
}
```

### Next.js 16 `'use cache'` Directive

Pairs with explicit named cache profiles:

```typescript
'use cache';
import { cacheLife, cacheTag } from 'next/cache';

export async function getDepartmentTelemetry(deptId: string) {
  cacheLife('telemetry'); // registered profile in next.config.mjs
  cacheTag(`dept_${deptId}`, 'telemetry');

  return fetchTelemetryFromReplica(deptId);
}
```

---

## 4. Heavy Component Code-Splitting & Dynamic Imports

To enforce client chunk budgets ($\le 1.0\text{ MB}$ max asset size), heavy third-party libraries (Univer Sheets, ECharts, PDF renderers) must be lazily loaded via `next/dynamic`:

```typescript
'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@repo/ui';

// Lazy-load heavy spreadsheet engine without SSR
const UniverSheet = dynamic(
  () => import('@repo/departments/ui/tools/UniverSheet'),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[600px] w-full rounded-card" />,
  }
);

export function ToolsSpreadsheetView({ deptId }: { deptId: string }) {
  return <UniverSheet id={`sheet-${deptId}`} />;
}
```

---

## 5. Type-Safe Event Dispatching (Custom Event Bus)

To eliminate untyped `window.dispatchEvent` calls and prevent runtime contract drift:

```typescript
// apps/portal/lib/event-manager.ts
export const ARCH_EVENTS = {
  ACTIVE_MODULE_CHANGE: 'arch:active-module-change',
  SYSTEM_NOTIFICATION: 'arch-system-notification',
} as const;

export interface ActiveModuleChangeEvent {
  name: string;
  title: string;
}

export function dispatchActiveModuleChange(detail: ActiveModuleChangeEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARCH_EVENTS.ACTIVE_MODULE_CHANGE, { detail }));
}
```

---

## 6. Edge Telemetry Circuit Breaker Pattern

Resilient state machine protecting edge telemetry ingestion from network jitter and cascading failures:

```
           +-----------------------+
           |        CLOSED         | <---------------+
           | (Normal Pass-Through) |                 |
           +-----------------------+                 |
                       |                             |
          failures >= failureThreshold               |
                       |                        trial success
                       v                             |
           +-----------------------+                 |
           |         OPEN          |                 |
           |  (Fail Fast / Cached) |                 |
           +-----------------------+                 |
                       |                             |
             resetTimeoutMs elapsed                  |
                       |                             |
                       v                             |
           +-----------------------+                 |
           |       HALF_OPEN       | ----------------+
           |    (Trial Request)    |
           +-----------------------+
                       |
                  trial failure
                       |
                       +-----------------------------> (Back to OPEN)
```
