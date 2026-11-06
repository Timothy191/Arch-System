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

## 4. Mandatory 8-Step Server Action Flow

All `'use server'` mutations in `apps/portal/actions/` or route action modules are public HTTP endpoints and MUST execute this exact 8-step sequence:

1. **Authenticate the caller**: Verify via `getAuthenticatedEmployee()` or `createServerSupabaseClient()` + `getUserSafely()`. Throw `AuthError` (`@repo/errors`) if unauthenticated.
2. **Authorize the requested operation and resource**: Check RBAC role and department/tenant access claims. Throw `ForbiddenError` on mismatch.
3. **Validate all untrusted input**: Parse untrusted inputs at runtime with a canonical Zod schema from `@repo/contract` using `.safeParse()`. Throw `ValidationError` on failure.
4. **Apply rate limits**: Enforce per-user/IP mutation quotas via `RateLimiter` (`@repo/rate-limiter`). Throw `RateLimitError` when exceeded.
5. **Execute the operation**: Execute the parameterized database write or RPC via `@repo/supabase`.
6. **Record the audit event**: Emit structured audit telemetry via `@repo/logger`.
7. **Invalidate affected caches**: Call `await updateTagInAction(tag)` / `await updateTag(tag)` / `await updateTags(tags)` from `@/lib/server-cache` to purge both the Next.js Data Cache and distributed Redis L1/L2 cache tags.
8. **Return a typed result**: Return the typed result (or call `redirect()` ONLY AFTER cache invalidation completes).

---

## 5. Verification Gates

Run these audits before completing any Next.js App Router, component boundary, or caching change:

```bash
node tools/audits/audit-server-components.cjs
node tools/audits/audit-caching.cjs
node tools/audits/audit-routing-and-actions.cjs
```
