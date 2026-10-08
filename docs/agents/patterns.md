# Arch-System — Code Conventions & Patterns

> Formatting, naming, error hierarchy, Server Action template, DI factories, state management, file-length limits, and the key-files table. Extracted from the former monolithic `AGENTS.md`.

## Code Conventions & Common Patterns

### Formatting & Code Style

- **Formatter & Primary Linter**: **Biome** (`biome.json`).
  - Indentation: 2 spaces.
  - Line width: 100 columns.
  - Quotes: Single quotes for TypeScript/JavaScript; double quotes for JSX.
  - Semicolons: Always required.
  - Trailing commas: ES5 standard.

### Naming Conventions

- **React Components**: PascalCase (`GlassCard.tsx`, `ShiftCloseoutModal.tsx`).
- **Hooks**: camelCase prefixed with `use` (`usePitConnectivity.ts`, `useSupabaseRealtime.ts`).
- **Schemas**: kebab-case with `.schema.ts` suffix (`shift-closeout.schema.ts`).
- **Types**: kebab-case with `.types.ts` suffix (`shift-closeout.types.ts`).
- **Utilities**: kebab-case (`cache-utils.ts`, `crypto.ts`).
- **Database Migrations**: Zero-padded 3-digit prefix + snake_case (`NNN_description.sql`, e.g., `163_shift_closeout_rpc.sql`).
- **Tests**: Co-located `<target>.test.ts(x)` for Jest; `<name>.spec.ts` for Playwright E2E.

### Strict Light Mode Invariant (UI System)

- **Mandate**: All interfaces strictly render in light mode (canvas `#f3f4f6`, background luminance > 200).
- **Hard Negative**: NEVER write `dark:` Tailwind variant classes or dark-mode toggles.
- **Design Tokens**: All colors, radiuses, and glass styling must consume semantic OKLCH tokens from `@repo/theme/src/tokens/` (`color-bg-base`, `color-bg-elevated`, `color-text-primary`, `color-action-primary`). Raw hex/rgb color declarations are forbidden.
- **Surfaces**: Standardize on frosted glass cards: `<GlassCard variant="window" | "spotlight" | "liquid">` (`packages/ui/src/components/GlassCard.tsx`).
- **Telemetry & Numbers**: Numbers rendered via Framer Motion / AutoAnimate (`KPICard`, `KPIGrid`). Monospace font (`JetBrains Mono`) for tabular figures, timestamps, and equipment IDs.

### Next.js Image Optimization Invariant (UI & Performance)

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

### Next.js Data Fetching & Streaming Invariant (Backend & Architecture)

- **Mandate**: All primary data queries, sensitive telemetry access, and employee identity lookups MUST execute in Server Components (RSC), Server Actions, or Route Handlers via `@repo/supabase` or typed services.
- **Hard Negatives**:
  - NEVER query the database or `@repo/supabase/server` directly from Client Components (`'use client'`). Client components receive data via props, streamed promises, or typed Route Handlers (`/api/...`).
  - NEVER execute sequential `await` queries on independent data requests within the same function block (`await getA(); await getB();` when `B` does not depend on `A`); always parallelize with `Promise.allSettled()` or `Promise.all()` to prevent request waterfalls.
  - NEVER perform unmemoized database calls across shared layout/page hierarchies; wrap per-request lookups in `React.cache()` to share one database round-trip.
  - NEVER block entire route segments on dynamic uncached data; wrap dynamic components in granular `<Suspense>` boundaries with skeleton fallbacks and maintain `loading.tsx` coverage.
- **Promise Streaming Pattern**: Stream unresolved promises from Server Components to Client Components wrapped in `<Suspense>` and unwrap using React 19 `use(promise)`.
- **Quality Gate**: Verified automatically via `pnpm audit:data-fetching` (part of `pnpm audit:compliance`).

### Next.js Caching & Cache Components Invariant (Performance & Architecture)

- **Mandate**: Caching across `apps/portal` combines Next.js 16 Cache Components (`cacheComponents: true` in `apps/portal/next.config.mjs`) with distributed two-tier L1/L2 Redis caching (`@repo/redis`). Data computations and shared UI fragments must declare explicit caching intent with `'use cache'` paired with named `cacheLife()` profiles (`telemetry`, `departments`, `reports`). Dynamic runtime APIs (`cookies()`, `headers()`) MUST be isolated behind `<Suspense>` boundaries to preserve static prerendering of the App Shell.
- **Hard Negatives**:
  - NEVER call dynamic request functions (`cookies()`, `headers()`, `searchParams`) inside a function or component scoped with `'use cache'`. Pass dynamic values as explicit serializable parameters or compute them outside the cached scope.
  - NEVER use `'use cache'` without an explicit `cacheLife()` profile (or approved built-in profile: `seconds`, `minutes`, `hours`, `days`, `weeks`, `max`).
  - NEVER execute state mutations (`POST`, `PATCH`, `DELETE`) without invalidating associated cache tags using `revalidateTag()` and `cacheInvalidateTags()`.
  - NEVER cache unisolated tenant or user-specific records under global unnamespaced cache keys; always include composite identifiers (`dept_${deptId}`, `user_${userId}`).
  - NEVER call uncached per-request runtime values (`Date.now()`, `Math.random()`, `crypto.randomUUID()`) in render passes without `connection()` inside `<Suspense>`.
- **Quality Gate**: Verified automatically via `pnpm audit:caching` (part of `pnpm audit:compliance`).

### Next.js Turbopack & Lazy Loading Invariant (Build & Performance)

- **Mandate**: Next.js 16 uses native Rust-powered **Turbopack** for incremental dev and production builds. Monorepo module resolution for `@repo/*` packages and symlinks is strictly anchored by `turbopack.root: workspaceRoot` and `outputFileTracingRoot: workspaceRoot` in `apps/portal/next.config.mjs`. Large UI components and heavy external libraries must be deferred via `next/dynamic` and dynamic `import()` to preserve client chunk budgets (<= 1.0 MB max asset size).
- **Hard Negatives**:
  - NEVER pass `{ ssr: false }` to `next/dynamic()` within a Server Component. Next.js restricts `ssr: false` exclusively to Client Components (`'use client'`).
  - NEVER use the unsupported `/* webpackOptional: true */` magic comment in dynamic expressions; use `/* turbopackOptional: true */` instead.
  - NEVER synchronously import heavy libraries (`@react-pdf/renderer`, `exceljs`, `@xyflow/react`) inside root layouts (`app/layout.tsx`) or critical path entrypoints.
  - NEVER rely on arbitrary CSS Module import ordering; Turbopack follows JS import order via Lightning CSS (5 decimal digits precision).
  - NEVER use unmemoized Babel config functions in monorepos; always configure explicit cache keys with `api.cache.using()` or `api.cache.forever()`.
- **Quality Gate**: Verified automatically via `pnpm audit:turbopack` (part of `pnpm audit:compliance`).

### Next.js App Router, Server Actions & Boundary Invariant (Architecture & Mutations)

- **Mandate**: Layouts and pages across `apps/portal` are React Server Components by default to minimize client JS bundles and preserve secret isolation. Interactive functionality is pushed down to leaf Client Components (`'use client'`). Server Actions (`'use server'`) serve as typed mutation RPC endpoints with mandatory caller authentication, authorization checks, and cache invalidation before redirection. Pre-routing authentication and CSP nonces are centralized in `apps/portal/proxy.ts`.
- **Hard Negatives**:
  - NEVER place `route.ts` and `page.tsx` in the same directory segment (conflicting route collision).
  - NEVER convert a layout or parent page to `'use client'` to add interactivity; interleave by passing Server Components as `children` or slots into client containers.
  - NEVER execute a Server Action (`'use server'`) without verifying caller session/auth and role authorization.
  - NEVER call `redirect()` before `revalidatePath()` or `revalidateTag()` / `cacheInvalidateTags()` in a Server Action (since `redirect()` throws a framework control-flow exception).
  - NEVER perform heavy, slow, or unmemoized database queries inside `apps/portal/proxy.ts`.
- **Quality Gate**: Verified automatically via `pnpm audit:routing` (part of `pnpm audit:compliance`).

### React Server Components, Boundaries & Taint Invariant (React 19 / Next.js 16)

- **Mandate**: All UI and data components default to React Server Components (RSC) to execute ahead of time, eliminate internal client-side API roundtrips, and keep heavy libraries out of client bundles. Interactivity is isolated in leaf Client Components (`'use client'`). Props crossing the RSC boundary must be strictly serializable. Sensitive database records and secret tokens are guarded using React 19 Taint APIs (`experimental_taintObjectReference`, `experimental_taintUniqueValue`).
- **Hard Negatives**:
  - NEVER place `"use server"` at the top of a component file or function returning JSX (it is reserved exclusively for Server Functions / Actions).
  - NEVER pass non-serializable props (event handlers, class instances, un-marked functions) across the server-client boundary.
  - NEVER call `createContext()` or React Hooks (`useState`, `useEffect`, `useReducer`) inside a Server Component.
  - NEVER import global CSS or Tailwind entrypoints in nested route folders; import exclusively in `app/layout.tsx`.
- **Quality Gate**: Verified automatically via `pnpm audit:rsc` (part of `pnpm audit:compliance`).

### Single-Source Client Query & State Invariant (Anti-SWR Duplication Rule)

- **Mandate**: In Arch-System, all client-side query caching and data synchronization are strictly standardized on `@tanstack/react-query` alongside Server Components (RSC) and Supabase Realtime CDC (`useSupabaseRealtime`). SWR (`vercel/swr`) is explicitly prohibited.
- **Hard Negatives**:
  - NEVER import `swr`, `swr/mutation`, or `swr/infinite`. Introducing competing client query caches creates duplicate background polling on mining pit cellular links, cache desynchronization, and client bundle bloat.
  - NEVER trigger manual client-side HTTP polling loops when Supabase Realtime CDC subscriptions (`useSupabaseRealtime`) are available.
- **Quality Gate**: Verified automatically via `pnpm audit:hooks` (part of `pnpm audit:compliance`).

### Industrial Field Hooks & SSR Hydration Guard Invariant

- **Mandate**: All custom hooks in `libs/shared/hooks` must be engineered for harsh industrial field conditions (vibration, touchscreen bounce, intermittent satellite connectivity) and satisfy strict React 19 SSR hydration safety.
- **Hard Negatives**:
  - NEVER access browser globals (`window`, `document`, `navigator`, `localStorage`) without explicit SSR guards (`typeof window === 'undefined'`) or enclosing inside `useEffect`/`useSyncExternalStore`.
  - NEVER omit cleanup functions in subscriptions, event listeners, or timers.
  - NEVER import unverified third-party hook libraries (`@uidotdev/usehooks`) that duplicate or bypass internal `libs/shared/hooks/` resilience logic.
- **Quality Gate**: Verified automatically via `pnpm audit:hooks` (part of `pnpm audit:compliance`).

### Vercel CLI & Monorepo Deployment Preflight Invariant

- **Mandate**: Production and preview deployments via Vercel CLI (`vercel`) must strictly execute after running the automated preflight validator (`pnpm deploy:vercel:preflight`).
- **Hard Negatives**:
  - NEVER deploy without validating `vercel.json` framework configuration, monorepo NFT tracing root (`outputFileTracingRoot`), and `.vercelignore` heavy test artifact exclusions.
  - NEVER bypass environment variable preflight checks before production deployment.
- **Quality Gate**: Verified automatically via `pnpm audit:vercel` (part of `pnpm audit:compliance`).

### Canonical Error Handling (`packages/errors/src/index.ts`)

All domain and runtime errors MUST extend `AppError`:

- Base: `AppError` (`message`, `code`, `statusCode`, `context`, `cause`).
- Subclasses:
  - 400 Bad Request: `ValidationError` (includes `field` and invalid `value`).
  - 401 Unauthorized: `AuthError`.
  - 403 Forbidden: `ForbiddenError`.
  - 404 Not Found: `NotFoundError`.
  - 409 Conflict: `ConflictError`.
  - 429 Rate Limited: `RateLimitError`.
  - 500 Database: `DatabaseError`.
  - 502/504 Network/Timeout: `NetworkError`, `FetchTimeoutError`.
- Type Guard: Use `isAppError(error)` to extract status codes safely across server and client boundaries.

### Async Patterns & Server Actions

- Server Actions MUST declare `'use server';` on line 1, authenticate via session, check permissions against `employees`, validate inputs with `@repo/contract`, enforce rate limits, and return typed results.

```typescript
'use server';

import { createServerSupabaseClient } from '@repo/supabase/server';
import { shiftCloseoutSchema, type ShiftCloseoutInput } from '@repo/contract';
import { checkRateLimit } from '@repo/rate-limiter';
import { cacheInvalidateTags } from '@repo/redis';
import {
  isAppError,
  ValidationError,
  RateLimitError,
  DatabaseError,
  AuthError,
} from '@repo/errors';

export async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
  try {
    // 1. Validate payload against canonical Zod contract schema
    const parseResult = shiftCloseoutSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.issues[0]?.message);
    }

    // 2. Check rate limit
    const allowed = await checkRateLimit(parseResult.data.supervisorId);
    if (!allowed) throw new RateLimitError('Rate limit exceeded');

    // 3. Obtain authenticated Supabase server client
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AuthError('Unauthorized');

    // 4. Execute atomic RPC or query
    const { data, error } = await supabase.rpc('atomic_shift_closeout', {
      p_shift_id: parseResult.data.shiftId,
      p_payload: parseResult.data,
    });
    if (error) throw new DatabaseError(error.message);

    // 5. Invalidate caches across instances
    await cacheInvalidateTags(['shift_closeout', `dept_${parseResult.data.deptId}`]);

    return { success: true, data };
  } catch (err: unknown) {
    if (isAppError(err)) return { success: false, error: err.message, code: err.code };
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}
```

### Dependency Injection & Service Factories

Runtime clients are decoupled behind factory helpers to prevent environment leaks and enable testing:

- **Server Supabase**: `createServerSupabaseClient()` from `@repo/supabase/server` (uses Next.js cookie store + query telemetry).
- **Browser Supabase**: `createBrowserSupabaseClient()` from `@repo/supabase/client`.
- **Kysely Query Builder**: `createKyselyClient()` from `@repo/supabase/kysely`.
- **Redis Client & Cache**: `getRedisClient()` and `cacheGetOrSet()` from `@repo/redis`.
- **Rate Limiter**: `RateLimiter` class accepting modular `IStore` (`RedisStore` / `MemoryStore`) and `IStrategy` (`FixedWindowStrategy`, `SlidingWindowStrategy`, `TokenBucketStrategy`).

### State Management Strategy

1. **Server State**: React Server Components (RSC) by default, combined with TanStack React Query (`@tanstack/react-query`) for polling, client refetches, and cache synchronization.
2. **Ephemeral / Client State**: Lightweight Zustand 5 stores (`useDockPreferences.ts`, `useNavigationState.ts`, `useOfflineQueue.ts`).
3. **Form State**: React Hook Form with Zod resolvers (`@hookform/resolvers/zod`) paired with local storage draft persistence (`arch_*_draft_*`).
4. **Complex State Machines**: XState 5 actors (`orchestrator.machine.ts`) for multi-step hardware and shift closeout lifecycles.

---

## Important Files

| Category                   | File Path                                                 | Description                                                                       |
| :------------------------- | :-------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Edge Interceptor**       | `apps/portal/proxy.ts`                                    | Next.js 16 Edge proxy validating sessions, employee roles, and security headers.  |
| **App Layout**             | `apps/portal/app/layout.tsx`                              | Root portal layout mounting themes, providers, and global UI layers.              |
| **App Next Config**        | `apps/portal/next.config.mjs`                             | Standalone output, Turbopack root, transpilePackages, and CSS inlining.           |
| **Contract SSoT**          | `packages/contract/src/index.ts`                          | Central export of all Zod validation schemas and contract types.                  |
| **Database Migrations**    | `packages/database/migrations/`                           | 164+ sequential PostgreSQL migrations defining schemas and RLS policies.          |
| **Database Safety Test**   | `packages/database/tests/migration-rollback-safety.mjs`   | Static analysis verifying non-destructive SQL and rollback semantics.             |
| **Error Hierarchy**        | `packages/errors/src/index.ts`                            | Canonical `AppError` classes, status codes, and type guards.                      |
| **Supabase Server**        | `packages/supabase/src/server.ts`                         | Server-side cookie-based Supabase client with query timing instrumentation.       |
| **Supabase Kysely**        | `packages/supabase/src/kysely.ts`                         | Type-safe Kysely database client for complex SQL aggregations.                    |
| **Supabase Browser**       | `packages/supabase/src/client.ts`                         | Browser Supabase client configured for on-prem LAN rewrite.                       |
| **Redis Cache**            | `packages/redis/src/cache.ts`                             | Two-tier L1 memory / L2 Redis cache manager with XFetch and tag invalidation.     |
| **Rate Limiter**           | `packages/rate-limiter/src/index.ts`                      | DI rate limiting engine with modular stores and strategies.                       |
| **Design Tokens**          | `packages/theme/src/tokens/index.ts`                      | Single source of truth for OKLCH tokens, glass refraction math, and radii.        |
| **Glass Component**        | `packages/ui/src/components/GlassCard.tsx`                | Primary card component adhering to strict light-mode glass refraction.            |
| **Offline Queue**          | `apps/portal/hooks/useOfflineQueue.ts`                    | Zustand persistent store queueing mutations during field connectivity drops.      |
| **Pit Connectivity**       | `libs/shared/hooks/src/usePitConnectivity.ts`             | Jittered heartbeat detector for mining pit network degradation and lie-fi.        |
| **Policy Compiler**        | `tools/repo/policy-compiler.cjs`                          | Monorepo boundary compiler generating ESLint boundaries and policy JSONs.         |
| **Compound Bash Guard**    | `tools/scripts/check-compound-bash.cjs`                   | AST parser blocking dangerous shell commands before execution.                    |
| **Quality Gates**          | `tools/scripts/enforce-quality-gates.sh`                  | 4-gate verification script (ARWR, tests, modernization, strict TS).               |
| **TODO & Report Protocol** | `.agents/rules/todo-completion-and-detailed-reporting.md` | Mandatory 100% TODO execution and detailed post-investigation reporting protocol. |
| **Structured Thinking**    | `.agents/rules/structured-thinking-mandate.md`            | Mandatory 5-phase thinking protocol (STM-0) for all agents before code mutations. |
| **Monorepo Topology**      | `pnpm-workspace.yaml`                                     | Defines workspace layout and centralized pnpm catalogs (`catalogs.react19`).      |
| **Task Pipeline**          | `turbo.json`                                              | Turborepo configuration for caching builds, tests, lints, and asset syncs.        |
| **Biome Config**           | `biome.json`                                              | Repository-wide formatting rules and linting presets.                             |

---

## Runtime/Tooling Preferences

### Primary Runtime & Package Manager

- **Node.js**: Strict engine requirement **`>=22`**. Pinned to **`24.15.0`** across `.node-version`, `.nvmrc`, and `package.json` Volta settings.
- **Package Manager**: **`pnpm`** (strictly pinned to **`9.15.9`** via `packageManager` and Volta).
  - Centralized dependency catalogs in `pnpm-workspace.yaml` (`catalog:`, `catalog:react19`).
  - **Hard Negative**: Do NOT use `bun`, `npm`, or `yarn` as the package manager or runtime.
- **Monorepo Task Runner**: **Turborepo 2.x** (`turbo`).

### Secondary Runtimes & Infrastructure

- **Python 3 (`>=3.10`)**: Used for:
  - Evaluation test suite in `packages/eval` (`poetry run pytest tests/` or `uv run pytest tests/`).
  - Network reachability checks: `python3 scripts/ensure_reachability.py`.
- **Rust / Cargo**: Used for the swarms orchestrator service at `tools/swarms-orchestrator` (`Cargo.toml` edition 2021).
- **Docker Compose**: Service definitions in `infra/docker/` (`compose.tools.yml`, `compose.ai-tools.yml`, `compose.portal.yml`). Note that production Redis configurations require `REDIS_PASSWORD`.

### Tooling & AST Safety Constraints

- **Biome** (`biome.json`): Primary repository linter and formatter.
- **Stylelint** (`stylelint.config.mjs`): Strictly enforces OKLCH tokens and forbids raw color literals or dark mode classes.
- **AST Bash Safety Gate**: Shell command chains are audited by `tools/scripts/check-compound-bash.cjs`. Never execute destructive bash commands (`rm -rf /`, `dd`, `chmod 777`, raw block device writes, or pipe-to-shell operations).
- **Conventional Commits**: Commit messages must follow the Conventional Commits specification, validated by Husky `commit-msg` and Commitlint (`config/tools/commitlint.config.mjs`).
- **Architectural Policy Compiler**: Monorepo boundaries are validated in CI via `pnpm policy:check`.

---

## Testing & QA
