---
name: nextjs-comprehensive-rules
description: Comprehensive Next.js 16 standards covering App Router, RSC/client boundary, Server Actions, caching, performance, and security for the Arch-System mining-operations portal
paths:
  - 'apps/portal/\*_/_.{ts,tsx,js,jsx}'
  - 'packages/ui/src/\*_/_.{ts,tsx}'
  - 'libs/features/\*_/_.{ts,tsx}'
  - 'libs/shared/\*_/_.{ts,tsx}'
---

# Comprehensive Next.js 16 App Router Standards

## 1. Server Components vs. Client Components (RSC Boundary Isolation)

- **RSC Default**: Every route, layout, and presentational component is a **React Server Component (RSC)** by default. Push `'use client';` strictly to **interactive leaf components only**.
- **Donut Pattern**: Use `children` props to pass server subtrees into client component wrappers rather than importing server logic into client files.
- **Mandatory Directive**: Any component that uses **hooks** (`useState`, `useEffect`, `useReducer`, `useLayoutEffect`, `useRef`, `useCallback`, `useMemo`, `useId`, `useActionState`, `useOptimistic`), `createContext`/`useContext`, `framer-motion`, or browser APIs (`window`, `document`, `navigator`, `localStorage`) **MUST** declare `'use client';` on line 1, before all imports.
- **Never `async` Client Components**: Client Components must NEVER be declared `async`. Perform async work in Server Components, streaming promises via `<Suspense>` + React 19 `use(promise)`, or in Server Actions.
- **`'use server'` Isolation**: `'use server'` is exclusively for **Server Functions/Server Actions** — never place on a React component module.

```tsx
// ✅ CORRECT — 'use client' leaf, never async, hooks are safe here
'use client';

import { useState } from 'react';
import { GlassCard } from '@repo/ui/GlassCard';

export function DelayTimer({ initialDurationMs }: { initialDurationMs: number }) {
  const [durationMs, setDurationMs] = useState(initialDurationMs);
  return (
    <GlassCard variant="spotlight">
      <input
        type="number"
        value={durationMs}
        onChange={(evt) => setDurationMs(Number(evt.target.value))}
      />
    </GlassCard>
  );
}
```

## 2. Request Proxy & Authorization Pipeline (`proxy.ts`)

- **`proxy.ts` Replaces `middleware.ts`**: `apps/portal/proxy.ts` is the canonical Next.js 16 request proxy. It generates a cryptographic per-request `x-nonce` and sets `Content-Security-Policy`, delegating session refresh and route gating to `apps/portal/server/proxy.ts`.
- **Edge Session & Redis RBAC**: `apps/portal/server/proxy.ts` refreshes auth via `createMiddlewareClient` (`@repo/supabase/middleware` → `auth.getClaims()`), resolves the employee role/department from the fenced Redis session (`arch:auth:employee:${userId}`, TTL 3600s) with database fallback, and enforces `DEPARTMENT_ROUTES` and `RESTRICTED_ROUTES`.
- **Defense-in-Depth Layout Verification**: Never rely solely on the proxy for authorization or slug validity:
  - `apps/portal/app/admin/layout.tsx` independently authenticates the user via `createServerSupabaseClient()` + `getUserSafely()` and verifies `employee.role === 'admin'` before rendering children.
  - `apps/portal/app/(departments)/[department]/layout.tsx` awaits the `params: Promise<{ department: string }>` prop, validates the slug against `DEPARTMENTS` (`@repo/departments/data-access`), and invokes `notFound()` on mismatch.
- **Never trust the URL**: Always re-validate permissions and tenant/department access at the **layout level** inside `app/`, independent of `proxy.ts`.

## 3. Server Actions — 7-Step Security Flow

All `'use server'` mutations in `apps/portal/actions/` MUST execute **this exact 7-step sequence**:

1. **Authenticate**: Verify caller identity via `getAuthenticatedEmployee()` or `createServerSupabaseClient()` + `getUserSafely()`. Throw `AuthError` if unauthenticated.
2. **Authorize**: Check RBAC role, department, and tenant access claims (from `public.employees`). Throw `ForbiddenError` on mismatch.
3. **Validate**: Parse untrusted inputs at runtime with canonical Zod schemas from `@repo/contract` using `.safeParse()`. Throw `ValidationError` on failure.
4. **Rate-Limit**: Enforce per-user/IP quotas via `RateLimiter` (`@repo/rate-limiter`). Throw `RateLimitError` when exceeded.
5. **Mutate**: Execute parameterized database writes/RPCs via `@repo/supabase` (service-role client if RLS bypass needed, **after** explicit RBAC verification).
6. **Dual-Tier Cache Invalidation**: Call `updateTagInAction(tag)` / `updateTags(tags)` from `@/lib/server-cache` to purge **both** the Next.js Data Cache and distributed Redis L1/L2 cache tags (`cacheInvalidateTags`).
7. **Redirect / Return**: Call `redirect()` **ONLY** after cache invalidation completes. Never call `redirect()` before invalidation (`redirect()` throws a control-flow exception — code after it is unreachable).

```typescript
'use server';

import { shiftCloseoutSchema } from '@repo/contract';
import { AuthError, ForbiddenError, ValidationError } from '@repo/errors';
import { redirect } from 'next/navigation';
import { tagDepartment, updateTagInAction } from '@/lib/server-cache';

export async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
  // 1. Authenticate
  const principal = await getAuthenticatedEmployee();
  if (!principal) throw new AuthError('Unauthorized');

  // 2. Authorize
  if (!principal.canCloseShift) throw new ForbiddenError('Insufficient permissions');

  // 3. Validate (@repo/contract Zod safeParse)
  const parsed = shiftCloseoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  // 4. Rate-limit -> 5. Mutate
  await enforceShiftActionRateLimit(principal.id);
  await performShiftCloseoutMutation(principal.id, parsed.data);

  // 6. Dual-tier Next.js + Redis L1/L2 cache invalidation BEFORE redirect()
  await updateTagInAction(tagDepartment(parsed.data.departmentSlug, 'shift_closeout'));

  // 7. Redirect (or return typed result)
  redirect(`/${parsed.data.departmentSlug}/handover`);
}
```

## 4. Caching — `'use cache'`, `cacheLife()`, and `server-cache.ts`

- **Single Source of Truth**: `apps/portal/lib/server-cache.ts` is the canonical server caching layer, backed by `cacheComponents: true` in `apps/portal/next.config.mjs`.
- **Named `cacheLife()` Profiles**: Never use `'use cache'` without a named `cacheLife()` profile (`telemetry`, `departments`, `reports`, `max`, `hours`, `minutes`).
- **Dynamic API Isolation**: Never call `cookies()`, `headers()`, or read unawaited `searchParams` inside a `'use cache'` scope. Read dynamic request values outside the cached function and pass only serializable primitives.
- **Per-Request Deduplication**: Wrap shared per-request lookups (tenant, department, operator metadata) in `React.cache()` within `libs/features/*/data-access` so they're fetched once per request.
- **Scoped Cache Tags**: Construct tags via `scopedTag(scope, id)`, `tagTenant(tenantId, resource)`, or `tagDepartment(departmentSlug, resource)` from `@/lib/server-cache`.
- **Client cache**: Use TanStack Query (`ReactQueryProvider` with `localStorage` persistence) for client-side caching and refetching. **SWR is prohibited.**

## 5. Data Fetching — N+1 Prevention & Parallel Queries

- **Parallelize independent queries**: Combine independent reads with `Promise.all` or `Promise.allSettled`; never chain sequential `await supabase...` waterfalls or run queries inside `for`/`while` loops.
- **Complex joins & aggregations**: Use Kysely (`createKyselyClient()` from `@repo/supabase/kysely`) or typed PostgreSQL RPCs (`supabase.rpc(...)`) for multi-table joins, CTEs, and aggregations instead of N+1 round-trips.
- **Live Updates via Realtime CDC**: Use `useSupabaseRealtime` (`@repo/shared/hooks`) for live Postgres CDC streaming instead of manual polling loops.
- **Read replicas**: Use `createReadReplicaClient()` (`@repo/supabase/read-replica`) for read-only dashboard/reporting queries.

## 6. Security & Error Handling

- **CSP & Nonce**: `apps/portal/proxy.ts` sets Content-Security-Policy + `x-nonce` per request. Components must not inject inline scripts or violate CSP.
- **AppError Hierarchy**: Handle all errors via `isAppError(err)` (`@repo/errors`); never leak raw Postgres errors or stack traces to clients.
- **Error Response Envelope**:
  ```typescript
  return NextResponse.json({ success: true, data: result });
  // On error:
  return NextResponse.json(
    {
      success: false,
      error: appError.message,
      code: appError.code,
      details: appError.details ?? null,
    },
    { status: appError.statusCode || 500 }
  );
  ```
- **Server-only boundary**: Never import `@repo/supabase/service-role`, `@repo/supabase/server`, `@repo/supabase/kysely`, `@repo/supabase/read-replica`, or `@repo/database` in `'use client'` modules.
- **Secrets**: Server-side Supabase/DB keys must never reach the client. Client-side env vars prefixed with `NEXT_PUBLIC_*` only.

## 7. Performance & Build Optimization

- **Bundle size**: Each page bundle's total JavaScript must be ≤ 1.0 MB. Use the bundle analyzer (`turbo run analyze --filter=portal`).
- **Image optimization**: Use `next/image` with explicit `width`/`height` or `fill` + sized parent, and descriptive `alt` text. Raw `<img>` tags are allowed only in root error boundaries.
- **Dynamic imports**: For large UI modules (charts, heavy data tables), wrap in `next/dynamic` with `ssr: false` when client-only interaction is required.
- **Turbopack**: `next.config.mjs` sets `cacheComponents: true`, `turbopack.root`, `outputFileTracingRoot`, `cacheLife`, and React 19 taint support. Verify Turbopack build works before merging any Next.js config change.

## 8. Verification Gates

Run these audits before completing any Next.js App Router, component boundary, or caching change:

```bash
node tools/audits/audit-server-components.cjs
node tools/audits/audit-caching.cjs
node tools/audits/audit-routing-and-actions.cjs
pnpm type-check
pnpm lint
pnpm policy:check  # boundary rules + security checks
```

## 9. Import Conventions

- Import via canonical exports: `@repo/ui/GlassCard`, `@repo/contract`, `@repo/errors`, `@repo/supabase/server` — never deep paths like `@repo/ui/src/...`.
- Use `@/` and `@repo/*` aliases as configured in `tsconfig.json`.
- Never import `apps/...` paths — route through `libs/features/*` shared data-access modules instead.

## 10. Layout & Route Group Discipline

- **Client context layering**: `app/layout.tsx` must follow the exact provider chain: `ArchThemeProvider → ClientProviders → ReactQueryProvider → AnimationProvider`.
- **Route group validation**: `app/(departments)/[department]/layout.tsx` validates the slug against `DEPARTMENTS` and calls `notFound()` on mismatch; `app/admin/layout.tsx` re-checks the admin role independently of the proxy.

## 11. Server Actions — Security Hardening

- **Never trust client form data**: Server Actions are public HTTP endpoints — always authenticate, authorize, and validate even if the UI appears gated.
- **Idempotency for mutations**: POST/DELETE-style Server Actions must be idempotent (use `upsert` or guard with existence checks).
- **No session tokens in URL**: Use `POST` Server Actions for mutations; never read sensitive IDs from `searchParams`.

These rules ensure Next.js 16 App Router code in Arch-System is consistently secure, performant, and maintainable across all agent contributions.
