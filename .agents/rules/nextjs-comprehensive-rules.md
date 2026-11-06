---
name: nextjs-comprehensive-rules
description: Comprehensive Next.js 16 standards covering App Router, RSC/client boundary, Server Actions, caching, performance, and security
paths:
  - 'apps/portal/**/*.{ts,tsx,js,jsx}'
  - 'packages/ui/src/**/*.{ts,tsx}'
  - 'libs/features/**/*.{ts,tsx}'
  - 'libs/shared/**/*.{ts,tsx}'
---

# Next.js 16 App Router Standards

RSC/`'use client'` boundaries, `proxy.ts`, layout guards, `'use cache'`/`cacheLife()`, scoped tags, and the 8-step Server Action sequence live in `nextjs-use-client.md` (canonical). This file adds the rest.

## 1. Runtime & Routing

- `runtime: 'nodejs'` for routes needing DB, Kysely/Supabase, or Node APIs (e.g. `export const runtime = 'nodejs';` in `app/(departments)/[department]/page.tsx`, set at route-group level); `runtime: 'edge'` only for static/public routes (homepage, docs) — Edge lacks `fs`, limited `crypto`.
- Route groups: `(auth)/` login/reset (no business logic); `(departments)/` dashboards via `[department]` slug — never catch-all `[...all]` for business logic; invalid slugs → `notFound()`.
- `revalidate = 300` for department dashboards; `revalidate = 0` for frequently-changing data; never gate navigation on auth.

## 2. Proxy & Redirects

- `isValidRedirect()` must `decodeURIComponent` then test against allowlist patterns (`/^\/$/`, `/^\/login/`, `/^\/drilling(\/|$)/`).
- CSP nonce generated once per request, never double-injected (ClientProviders owns the nonce — don't re-generate in `NextScript`).

## 3. Server Actions

Follow the 8-step sequence in `nextjs-use-client.md`. Step 5 uses Kysely parameterized queries or typed RPCs only; step 6 `logger.info({ event, actorId, deptId })`; step 7 `await updateTagInAction(tagDepartment(dept, 'scope'))` **BEFORE** `redirect()`; step 8 returns `{ success: true, data }`.

## 4. Caching & Data

- Parallelize independent reads with `Promise.all`, never sequential `await`.
- Dual-tier: Next Data Cache (`cachedRSC`) + Redis L1/L2 with scoped tags. Client: TanStack Query + `localStorage` persistence; **SWR is prohibited**. Live updates: `useSupabaseRealtime` — no manual polling.

## 5. Client Components

- SSR-safe hooks: guard `typeof window !== 'undefined'` or defer to `useEffect`; always return cleanup for listeners, timers, subscriptions.
- Never pass un-serializable values (functions, class instances) from Server to Client Components.
- Ref-as-prop (React 19): `ref?: React.Ref<HTMLElement>` — no `forwardRef`. Unwrap streamed promises with `use(promise)` inside `<Suspense>`.

## 6. Layouts & Error Boundaries

- Nested layouts: parent owns global UI, child owns department context; each independently verifies auth/dept — never trust a parent's claims.
- `error.tsx` must be `'use client'`; separate UI error display from async retry logic.

## 7. Kysely Idempotency

- Never mutate rows read from a query; avoid read-then-write races — use atomic SQL (`ON CONFLICT`, `CASE WHEN ... THEN ... END`).
- Parameterized queries only (`$1`, `$2`) — no string interpolation.

## 8. Style & Forbidden Patterns

- Light mode only: canvas `#f3f4f6`, OKLCH tokens from `@repo/theme`; no `dark:` variants or raw hex/rgb. Glass via `@repo/ui/GlassCard` variants only.
- Import canonical exports (`@repo/ui/GlassCard`), never `@repo/ui/src/*`. `packages/ui` never imports `@repo/database` or `@repo/supabase`.
- `next/image` with explicit `width`/`height` and descriptive `alt`.
- ❌ `import useSWR from 'swr'` · ❌ `'use client'; export async function` · ❌ `useEffect` fetch as primary data source · ❌ `dark:` classes · ❌ `redirect()` before `updateTagInAction(...)` · ❌ `@repo/ui/src/*` · ❌ string interpolation in Kysely.
