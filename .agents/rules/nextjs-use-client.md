---
name: nextjs-use-client
description: 'Next.js 16 App Router, Server/Client boundary isolation, proxy.ts request pipeline, dual-tier server caching, and 7-step Server Action security standards.'
paths:
  - 'apps/portal/**/*.{ts,tsx}'
  - 'packages/ui/src/**/*.{ts,tsx}'
  - 'libs/features/**/*.{ts,tsx}'
  - 'libs/shared/**/*.{ts,tsx}'
---

# Next.js 16 App Router, Boundaries & Server Caching Standards

## 1. Server Components by Default & Leaf `'use client'` Isolation

- **RSC Default**: Every route, layout, and presentational component is a React Server Component (RSC) by default. Push `'use client'` strictly to interactive leaf components (using the Donut Pattern: pass server subtrees via `children`).
- **Mandatory `'use client'` Directive**: Any file in `apps/portal/`, `packages/ui/src/`, or `libs/features/**/ui/` that uses React state/lifecycle hooks (`useState`, `useEffect`, `useReducer`, `useLayoutEffect`, `useRef`, `useCallback`, `useMemo`, `useId`, `useActionState`, `useOptimistic`), `createContext`/`useContext`, `framer-motion`, or browser APIs (`window`, `document`, `navigator`, `localStorage`) MUST declare `'use client';` on line 1 before all imports.
- **Never `async` Client Components**: Client Components (`'use client'`) must NEVER be declared `async`. Perform async work in Server Components (streaming promises via `<Suspense>` + React 19 `use(promise)`), Server Actions, or TanStack Query.
- **No Client-Side `useEffect` Fetching & No SWR**: Never fetch application data inside `useEffect` or import `swr` (prohibited). Use RSC for server reads, `@tanstack/react-query` (`ReactQueryProvider` with `localStorage` persistence) for client cache/refetch, and `useSupabaseRealtime` for live CDC updates.
- **Directive Semantics**: `'use server'` is exclusively for Server Functions / Server Actions—never place `'use server'` on a React component module.

```tsx
// ✅ CORRECT — 'use client' at line 1 on interactive leaf; never async
'use client';

import { useActionState } from 'react';
```

---

## 2. Next.js 16 Request Proxy (`proxy.ts`) & Independent Layout Guards

- **`proxy.ts` Replaces `middleware.ts`**: `apps/portal/proxy.ts` is the canonical Next.js 16 request proxy. It generates a cryptographic per-request `x-nonce` and sets `Content-Security-Policy`, delegating session refresh and route gating to `apps/portal/server/proxy.ts`.
- **Edge Session & Redis RBAC**: `apps/portal/server/proxy.ts` refreshes auth via `createMiddlewareClient` (`@repo/supabase/middleware` → `auth.getClaims()`), resolves the employee role/department from the fenced Redis session (`arch:auth:employee:${userId}`, TTL 3600s) with database fallback, and enforces `DEPARTMENT_ROUTES` and `RESTRICTED_ROUTES`.
- **Defense-in-Depth Layout Verification**: Never rely solely on the proxy for authorization or slug validity:
  - `apps/portal/app/admin/layout.tsx` independently authenticates the user via `createServerSupabaseClient()` + `getUserSafely()` and verifies `employee.role === 'admin'` before rendering children.
  - `apps/portal/app/(departments)/[department]/layout.tsx` awaits the `params: Promise<{ department: string }>` prop, validates the slug against `DEPARTMENTS` (`@repo/departments/data-access`), and invokes `notFound()` on mismatch.

---

## 3. Next.js 16 `'use cache'`, `cacheLife()` & `server-cache.ts` SSoT

- **Single Source of Truth**: `apps/portal/lib/server-cache.ts` is the canonical server caching layer, backed by `cacheComponents: true` in `apps/portal/next.config.mjs`.
- **Named `cacheLife()` Profiles**: Never use `'use cache'` without a named `cacheLife()` profile (`telemetry`, `departments`, `reports`, `max`, `hours`, `minutes` defined in `next.config.mjs` and `cacheProfiles` in `apps/portal/lib/server-cache.ts`).
- **Dynamic API Isolation**: Never call `cookies()`, `headers()`, or read unawaited `searchParams` inside a `'use cache'` scope. Read dynamic request values outside the cached function and pass only serializable primitives as arguments.
- **Per-Request Deduplication**: Wrap shared per-request lookups (e.g., current operator, tenant, or department metadata shared between `layout.tsx`, `generateMetadata`, and `page.tsx`) in `React.cache()` inside `libs/features/*/data-access`.
- **Scoped Cache Tags**: Construct tags via `scopedTag(scope, id)`, `tagTenant(tenantId, resource)`, or `tagDepartment(departmentSlug, resource)` from `@/lib/server-cache`.

---

## 4. Mandatory 7-Step Server Action Flow

All `'use server'` mutations in `apps/portal/actions/` or route action modules are public HTTP endpoints and MUST execute this exact 7-step sequence:

1. **Authenticate**: Verify the caller via `getAuthenticatedEmployee()` or `createServerSupabaseClient()` + `getUserSafely()`. Throw `AuthError` (`@repo/errors`) if unauthenticated.
2. **Authorize**: Check RBAC role and department/tenant access claims. Throw `ForbiddenError` on mismatch.
3. **Validate**: Parse untrusted inputs at runtime with a canonical Zod schema from `@repo/contract` using `.safeParse()`. Throw `ValidationError` or return a typed error tuple on failure.
4. **Rate-Limit**: Enforce per-user/IP mutation quotas via `RateLimiter` (`@repo/rate-limiter`). Throw `RateLimitError` when exceeded.
5. **Mutate**: Execute the parameterized database write or RPC via `@repo/supabase`.
6. **Dual-Tier Cache Invalidation**: Call `await updateTagInAction(tag)` / `await updateTag(tag)` / `await updateTags(tags)` from `@/lib/server-cache` to purge both the Next.js Data Cache (read-your-writes) and distributed Redis L1/L2 cache tags (`cacheInvalidateTags`).
7. **Redirect / Return**: Call `redirect()` ONLY AFTER cache invalidation completes (`redirect()` throws a Next.js control-flow exception; any code after it is unreachable).

```typescript
'use server';

import { shiftCloseoutSchema, type ShiftCloseoutInput } from '@repo/contract';
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

---

## 5. Verification Gates

Run these audits before completing any Next.js App Router, component boundary, or caching change:

```bash
node tools/audits/audit-server-components.cjs
node tools/audits/audit-caching.cjs
node tools/audits/audit-routing-and-actions.cjs
```
