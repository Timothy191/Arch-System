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

Canonical source for these topics; `nextjs-comprehensive-rules.md` covers runtime, routing, Kysely, and style.

## 1. RSC Default & Leaf `'use client'`

- Routes, layouts, and presentational components are RSC by default. Push `'use client'` to interactive leaves only (Donut Pattern: pass server subtrees via `children`).
- Any file in `apps/portal/`, `packages/ui/src/`, or `libs/features/**/ui/` using `useState`, `useEffect`, `useReducer`, `useLayoutEffect`, `useRef`, `useCallback`, `useMemo`, `useId`, `useActionState`, `useOptimistic`, `createContext`/`useContext`, `framer-motion`, or browser APIs (`window`, `document`, `navigator`, `localStorage`) MUST declare `'use client';` on line 1 before all imports.
- Client Components must NEVER be `async`; do async work in Server Components (stream promises via `<Suspense>` + `use(promise)`), Server Actions, or TanStack Query.
- Never fetch app data in `useEffect`; never import `swr`. Use RSC for reads, `@tanstack/react-query` (`ReactQueryProvider`, `localStorage` persistence) for client cache, `useSupabaseRealtime` for live CDC.
- `'use server'` is only for Server Functions/Actions — never on a component module.

## 2. `proxy.ts` & Layout Guards

- `apps/portal/proxy.ts` replaces `middleware.ts`: generates per-request `x-nonce`, sets `Content-Security-Policy`, delegates to `apps/portal/server/proxy.ts`.
- `server/proxy.ts` refreshes auth via `createMiddlewareClient` (`@repo/supabase/middleware` → `auth.getClaims()`), resolves role/department from the fenced Redis session (`arch:auth:employee:${userId}`, TTL 3600s) with DB fallback, and enforces `DEPARTMENT_ROUTES` / `RESTRICTED_ROUTES`.
- Never rely solely on the proxy:
  - `app/admin/layout.tsx` authenticates via `createServerSupabaseClient()` + `getUserSafely()` and verifies `employee.role === 'admin'`.
  - `app/(departments)/[department]/layout.tsx` awaits `params: Promise<{ department: string }>`, validates against `DEPARTMENTS` (`@repo/departments/data-access`), and calls `notFound()` on mismatch.

## 3. `'use cache'`, `cacheLife()` & `server-cache.ts`

- `apps/portal/lib/server-cache.ts` is the SSoT, backed by `cacheComponents: true` in `apps/portal/next.config.mjs`.
- Never `'use cache'` without a named `cacheLife()` profile (`telemetry`, `departments`, `reports`, `max`, `hours`, `minutes` — in `next.config.mjs` and `cacheProfiles`).
- Never call `cookies()`, `headers()`, or read unawaited `searchParams` inside `'use cache'`; read outside and pass serializable primitives.
- Wrap per-request lookups shared by `layout.tsx`, `generateMetadata`, `page.tsx` in `React.cache()` inside `libs/features/*/data-access`.
- Tags via `scopedTag(scope, id)`, `tagTenant(tenantId, resource)`, `tagDepartment(departmentSlug, resource)` from `@/lib/server-cache`.

## 4. Mandatory 8-Step Server Action Flow

`'use server'` mutations (`apps/portal/actions/` or route action modules) are public HTTP endpoints and MUST run:

1. **Authenticate**: `getAuthenticatedEmployee()` or `createServerSupabaseClient()` + `getUserSafely()`; else throw `AuthError` (`@repo/errors`).
2. **Authorize**: RBAC role + department/tenant claims; else `ForbiddenError`.
3. **Validate**: `@repo/contract` Zod `.safeParse()`; else `ValidationError`.
4. **Rate-limit**: `RateLimiter` (`@repo/rate-limiter`); else `RateLimitError`.
5. **Execute**: parameterized write or RPC via `@repo/supabase`.
6. **Audit**: structured event via `@repo/logger`.
7. **Invalidate**: `await updateTagInAction(tag)` / `updateTag(tag)` / `updateTags(tags)` from `@/lib/server-cache` (Next Data Cache + Redis L1/L2).
8. **Return** a typed result (`redirect()` ONLY AFTER invalidation).

## 5. Verification Gates

```bash
node tools/audits/audit-server-components.cjs
node tools/audits/audit-caching.cjs
node tools/audits/audit-routing-and-actions.cjs
```
