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

## 1. Runtime & Routing

- **RSC default**: Routes/layouts are RSC; `'use client'` strictly on leaf components using hooks or browser APIs. Never declare Client Components `async`.
- **Runtime**: Use `runtime: 'nodejs'` for routes needing DB, Kysely/Supabase, or Node APIs. Use `runtime: 'edge'` only for static/public routes (homepage, docs). Set at route-group level: `export const runtime = 'nodejs';` in `app/(departments)/[department]/page.tsx`. Edge lacks `fs`, `crypto` is limited.
- **Route groups**: `(auth)/` for login/reset flows (no business logic). `(departments)/` for department dashboards. Use `[department]` slug — never catch-all `[...all]` for business logic. Invalid slugs → `notFound()`.
- **Revalidation**: `revalidate = 300` for department dashboards; `revalidate = 0` for frequently-changing data; never gate navigation on auth.

## 2. Proxy & RBAC

- `proxy.ts` → `server/proxy.ts` sets CSP + `x-nonce`; layouts independently re-verify auth and department slugs via `notFound()`.
- Redirect validation: `isValidRedirect()` must `decodeURIComponent` then test against allowlist patterns (`/^\/$/`, `/^\/login/`, `/^\/drilling(\/|$)/`).
- CSP nonce generated once per request, never double-injected (ClientProviders owns the nonce — don't re-generate in `NextScript`).

## 3. Server Action Lifecycle (order matters)

1. **Authenticate** — `getAuthenticatedEmployee()`
2. **Authorize** — check role/dept against session claims
3. **Validate** — `@repo/contract` Zod `.safeParse`; throw `ValidationError`
4. **Rate-limit** — `rateLimiter.check(...)`
5. **Mutate** — query via Kysely parameterized queries only
6. **Cache invalidation** — `await updateTagInAction(tagDepartment(dept, 'scope'))` — **BEFORE** `redirect()`
7. **Return/Redirect** — `redirect()` throws a control-flow exception; anything after it is unreachable

```typescript
'use server';
export async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
  const parsed = shiftCloseoutSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
  const principal = await getAuthenticatedEmployee();
  if (!principal) throw new AuthError('Unauthorized');
  await rateLimiter.check('shift_closeout', principal.id);
  await db.shiftCloseout.create({ data: parsed.data });
  await updateTagInAction(`dept:${principal.dept}:shift_closeout`);
  redirect('/dashboard');
}
```

## 4. Caching

- `'use cache'` requires named `cacheLife()` profiles — never use cache without one.
- Parallelize independent reads: `Promise.all`, not sequential `await`.
- Dual-tier: Next Data Cache (`cachedRSC`) + Redis L1/L2 with scoped tags (`scopedTag`, `tagTenant`, `tagDepartment`).
- Client: TanStack Query with `localStorage` persistence. **SWR is prohibited.**
- Live updates: `useSupabaseRealtime` — no manual polling.

## 5. Client Components

- Never `async` on `'use client'` components.
- Never fetch data in `useEffect` as primary source — use RSC or `useQuery`.
- SSR-safe hooks: guard `typeof window !== 'undefined'` or defer to `useEffect`; always return cleanup functions for listeners, timers, subscriptions.
- Never pass un-serializable values (functions, class instances) from Server to Client Components.
- Ref-as-prop (React 19): `ref?: React.Ref<HTMLElement>` in props — no `forwardRef`.
- Unwrap streamed promises with `React 19 use(promise)` inside `<Suspense>`.

## 6. Layout & Error Boundaries

- Nested layouts: parent handles global UI, child handles department context.
- `error.tsx` must be `'use client'`; separation of UI error display from async retry logic.
- Layouts must independently verify auth/dept — never trust parent layout's claims.

## 7. Kysely Query Idempotency

- Never mutate rows read from a query; prefer read-then-write or atomic `ON CONFLICT` updates.
- Avoid read-then-write race conditions: use atomic SQL (`CASE WHEN ... THEN ... END`).
- Parameterized queries only: `$1`, `$2` — no string interpolation.

## 8. Style & Forbidden Patterns

- **Light mode only**: canvas `#f3f4f6`, semantic OKLCH tokens from `@repo/theme`. No `dark:` variants, no raw hex/rgb.
- **Glass surfaces**: `@repo/ui/GlassCard` variants only.
- **Import via canonical exports**: `@repo/ui/GlassCard`, never `@repo/ui/src/...`.
- **UI is pure**: `packages/ui` must never import `@repo/database` or `@repo/supabase`.
- **Images**: `next/image` with explicit `width`/`height` and descriptive `alt`.

## 9. Layout Composition

```tsx
// ✅ Server Component layout — revalidates + shares fetched session
export const revalidate = 300;
export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>;
}
```

## 10. Forbidden Patterns (checklist)

- ❌ `import useSWR from 'swr'`
- ❌ `'use client'; export async function ...`
- ❌ `useEffect(() => { fetch(...) })` as primary data source
- ❌ `<div className="dark:bg-black">` — light-mode only
- ❌ `redirect()` before `updateTagInAction(...)`
- ❌ `@repo/ui/src/*` imports — use canonical exports
- ❌ String interpolation in Kysely queries — use `$1, $2` params
