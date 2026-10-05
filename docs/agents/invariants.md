# Arch-System — Full Invariants

> Complete text of the hard invariants with rationale and quality gates. The condensed,
> always-enforced list lives in the root `AGENTS.md`. Extracted from the former
> monolithic `AGENTS.md` (51,679 bytes), which Antigravity truncated at 24,000 bytes.

## Strict Light Mode Invariant (UI System)

- **Mandate**: All interfaces strictly render in light mode (canvas `#f3f4f6`, background luminance > 200).
- **Hard Negative**: NEVER write `dark:` Tailwind variant classes or dark-mode toggles.
- **Design Tokens**: All colors, radiuses, and glass styling must consume semantic OKLCH tokens from `@repo/theme/src/tokens/` (`color-bg-base`, `color-bg-elevated`, `color-text-primary`, `color-action-primary`). Raw hex/rgb color declarations are forbidden.
- **Surfaces**: Standardize on frosted glass cards: `<GlassCard variant="window" | "spotlight" | "liquid">` (`packages/ui/src/components/GlassCard.tsx`).
- **Telemetry & Numbers**: Numbers rendered via Framer Motion / AutoAnimate (`KPICard`, `KPIGrid`). Monospace font (`JetBrains Mono`) for tabular figures, timestamps, and equipment IDs.

## Next.js Image Optimization Invariant (UI & Performance)

- **Mandate**: All content and UI imagery in `apps/portal` MUST use Next.js `<Image />` (`next/image`) to enforce zero Cumulative Layout Shift (CLS), modern AVIF/WebP formats, responsive delivery, and strict remote pattern validation.
- **Hard Negatives**:
  - NEVER render raw `<img>` elements in application routes. Only root error boundaries (`error.tsx`) are permitted to use static unbundled img/SVG to maintain zero-JS bundle isolation during catastrophic runtime crashes.
  - NEVER render an `<Image />` without either explicit intrinsic `width` and `height` properties or `fill` with a positioned parent container (`relative`, `absolute`, `fixed`).
  - NEVER omit a descriptive, accessible `alt` attribute. Decorative backgrounds must explicitly declare `alt=""` and `aria-hidden="true"`.
  - NEVER add insecure wildcard remote patterns (`*` on arbitrary hosts) in `apps/portal/next.config.mjs`.
  - NEVER import `next/image` directly into pure presentational packages like `packages/ui` (pass render slots or unbundled primitives to maintain UI library portability).
- **Responsive Fill Pattern**: When using `fill`, always pair with a responsive `sizes` attribute (e.g. `sizes="(max-width: 768px) 100vw, 50vw"`) to prevent mobile browsers from requesting desktop-resolution assets.
- **LCP Optimization**: Reserve `priority={true}` strictly for the single primary Above-The-Fold / Largest Contentful Paint (LCP) hero asset. All other images must use default lazy loading (`loading="lazy"`).
- **Quality Gate**: Verified automatically via `pnpm audit:images` (part of `pnpm audit:compliance`).

## Next.js Data Fetching & Streaming Invariant (Backend & Architecture)

- **Mandate**: All primary data queries, sensitive telemetry access, and employee identity lookups MUST execute in Server Components (RSC), Server Actions, or Route Handlers via `@repo/supabase` or typed services.
- **Hard Negatives**:
  - NEVER query the database or `@repo/supabase/server` directly from Client Components (`'use client'`). Client components receive data via props, streamed promises, or typed Route Handlers (`/api/...`).
  - NEVER execute sequential `await` queries on independent data requests within the same function block (`await getA(); await getB();` when `B` does not depend on `A`); always parallelize with `Promise.allSettled()` or `Promise.all()` to prevent request waterfalls.
  - NEVER perform unmemoized database calls across shared layout/page hierarchies; wrap per-request lookups in `React.cache()` to share one database round-trip.
  - NEVER block entire route segments on dynamic uncached data; wrap dynamic components in granular `<Suspense>` boundaries with skeleton fallbacks and maintain `loading.tsx` coverage.
- **Promise Streaming Pattern**: Stream unresolved promises from Server Components to Client Components wrapped in `<Suspense>` and unwrap using React 19 `use(promise)`.
- **Quality Gate**: Verified automatically via `pnpm audit:data-fetching` (part of `pnpm audit:compliance`).

## Next.js Caching & Cache Components Invariant (Performance & Architecture)

- **Mandate**: Caching across `apps/portal` combines Next.js 16 Cache Components (`cacheComponents: true` in `apps/portal/next.config.mjs`) with distributed two-tier L1/L2 Redis caching (`@repo/redis`). Data computations and shared UI fragments must declare explicit caching intent with `'use cache'` paired with named `cacheLife()` profiles (`telemetry`, `departments`, `reports`). Dynamic runtime APIs (`cookies()`, `headers()`) MUST be isolated behind `<Suspense>` boundaries to preserve static prerendering of the App Shell.
- **Hard Negatives**:
  - NEVER call dynamic request functions (`cookies()`, `headers()`, `searchParams`) inside a function or component scoped with `'use cache'`. Pass dynamic values as explicit serializable parameters or compute them outside the cached scope.
  - NEVER use `'use cache'` without an explicit `cacheLife()` profile (or approved built-in profile: `seconds`, `minutes`, `hours`, `days`, `weeks`, `max`).
  - NEVER execute state mutations (`POST`, `PATCH`, `DELETE`) without invalidating associated cache tags using `revalidateTag()` and `cacheInvalidateTags()`.
  - NEVER cache unisolated tenant or user-specific records under global unnamespaced cache keys; always include composite identifiers (`dept_${deptId}`, `user_${userId}`).
  - NEVER call uncached per-request runtime values (`Date.now()`, `Math.random()`, `crypto.randomUUID()`) in render passes without `connection()` inside `<Suspense>`.
- **Quality Gate**: Verified automatically via `pnpm audit:caching` (part of `pnpm audit:compliance`).

## Next.js Turbopack & Lazy Loading Invariant (Build & Performance)

- **Mandate**: Next.js 16 uses native Rust-powered **Turbopack** for incremental dev and production builds. Monorepo module resolution for `@repo/*` packages and symlinks is strictly anchored by `turbopack.root: workspaceRoot` and `outputFileTracingRoot: workspaceRoot` in `apps/portal/next.config.mjs`. Large UI components and heavy external libraries must be deferred via `next/dynamic` and dynamic `import()` to preserve client chunk budgets (<= 1.0 MB max asset size).
- **Hard Negatives**:
  - NEVER pass `{ ssr: false }` to `next/dynamic()` within a Server Component. Next.js restricts `ssr: false` exclusively to Client Components (`'use client'`).
  - NEVER use the unsupported `/* webpackOptional: true */` magic comment in dynamic expressions; use `/* turbopackOptional: true */` instead.
  - NEVER synchronously import heavy libraries (`@react-pdf/renderer`, `exceljs`, `@xyflow/react`) inside root layouts (`app/layout.tsx`) or critical path entrypoints.
  - NEVER rely on arbitrary CSS Module import ordering; Turbopack follows JS import order via Lightning CSS (5 decimal digits precision).
  - NEVER use unmemoized Babel config functions in monorepos; always configure explicit cache keys with `api.cache.using()` or `api.cache.forever()`.
- **Quality Gate**: Verified automatically via `pnpm audit:turbopack` (part of `pnpm audit:compliance`).

## Next.js App Router, Server Actions & Boundary Invariant (Architecture & Mutations)

- **Mandate**: Layouts and pages across `apps/portal` are React Server Components by default to minimize client JS bundles and preserve secret isolation. Interactive functionality is pushed down to leaf Client Components (`'use client'`). Server Actions (`'use server'`) serve as typed mutation RPC endpoints with mandatory caller authentication, authorization checks, and cache invalidation before redirection. Pre-routing authentication and CSP nonces are centralized in `apps/portal/proxy.ts`.
- **Hard Negatives**:
  - NEVER place `route.ts` and `page.tsx` in the same directory segment (conflicting route collision).
  - NEVER convert a layout or parent page to `'use client'` to add interactivity; interleave by passing Server Components as `children` or slots into client containers.
  - NEVER execute a Server Action (`'use server'`) without verifying caller session/auth and role authorization.
  - NEVER call `redirect()` before `revalidatePath()` or `revalidateTag()` / `cacheInvalidateTags()` in a Server Action (since `redirect()` throws a framework control-flow exception).
  - NEVER perform heavy, slow, or unmemoized database queries inside `apps/portal/proxy.ts`.
- **Quality Gate**: Verified automatically via `pnpm audit:routing` (part of `pnpm audit:compliance`).

## React Server Components, Boundaries & Taint Invariant (React 19 / Next.js 16)

- **Mandate**: All UI and data components default to React Server Components (RSC) to execute ahead of time, eliminate internal client-side API roundtrips, and keep heavy libraries out of client bundles. Interactivity is isolated in leaf Client Components (`'use client'`). Props crossing the RSC boundary must be strictly serializable. Sensitive database records and secret tokens are guarded using React 19 Taint APIs (`experimental_taintObjectReference`, `experimental_taintUniqueValue`).
- **Hard Negatives**:
  - NEVER place `"use server"` at the top of a component file or function returning JSX (it is reserved exclusively for Server Functions / Actions).
  - NEVER pass non-serializable props (event handlers, class instances, un-marked functions) across the server-client boundary.
  - NEVER call `createContext()` or React Hooks (`useState`, `useEffect`, `useReducer`) inside a Server Component.
  - NEVER import global CSS or Tailwind entrypoints in nested route folders; import exclusively in `app/layout.tsx`.
- **Quality Gate**: Verified automatically via `pnpm audit:rsc` (part of `pnpm audit:compliance`).

## Single-Source Client Query & State Invariant (Anti-SWR Duplication Rule)

- **Mandate**: In Arch-System, all client-side query caching and data synchronization are strictly standardized on `@tanstack/react-query` alongside Server Components (RSC) and Supabase Realtime CDC (`useSupabaseRealtime`). SWR (`vercel/swr`) is explicitly prohibited.
- **Hard Negatives**:
  - NEVER import `swr`, `swr/mutation`, or `swr/infinite`. Introducing competing client query caches creates duplicate background polling on mining pit cellular links, cache desynchronization, and client bundle bloat.
  - NEVER trigger manual client-side HTTP polling loops when Supabase Realtime CDC subscriptions (`useSupabaseRealtime`) are available.
- **Quality Gate**: Verified automatically via `pnpm audit:hooks` (part of `pnpm audit:compliance`).

## Industrial Field Hooks & SSR Hydration Guard Invariant

- **Mandate**: All custom hooks in `libs/shared/hooks` must be engineered for harsh industrial field conditions (vibration, touchscreen bounce, intermittent satellite connectivity) and satisfy strict React 19 SSR hydration safety.
- **Hard Negatives**:
  - NEVER access browser globals (`window`, `document`, `navigator`, `localStorage`) without explicit SSR guards (`typeof window === 'undefined'`) or enclosing inside `useEffect`/`useSyncExternalStore`.
  - NEVER omit cleanup functions in subscriptions, event listeners, or timers.
  - NEVER import unverified third-party hook libraries (`@uidotdev/usehooks`) that duplicate or bypass internal `libs/shared/hooks/` resilience logic.
- **Quality Gate**: Verified automatically via `pnpm audit:hooks` (part of `pnpm audit:compliance`).

## Vercel CLI & Monorepo Deployment Preflight Invariant

- **Mandate**: Production and preview deployments via Vercel CLI (`vercel`) must strictly execute after running the automated preflight validator (`pnpm deploy:vercel:preflight`).
- **Hard Negatives**:
  - NEVER deploy without validating `vercel.json` framework configuration, monorepo NFT tracing root (`outputFileTracingRoot`), and `.vercelignore` heavy test artifact exclusions.
  - NEVER bypass environment variable preflight checks before production deployment.
- **Quality Gate**: Verified automatically via `pnpm audit:vercel` (part of `pnpm audit:compliance`).
