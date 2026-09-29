# Repository Guidelines

## Project Overview

**Arch-System** (Plantcor OS) is an enterprise-grade industrial surface-mining operations platform. It coordinates real-time SCADA telemetry, pit extraction tracking, drill rig penetration and bit-depth telemetry, mobile equipment maintenance, contractor/personnel badging and access control, and atomic shift closeout compilation across physical mining sites (such as Brakfontein and its extensions).

Engineered for harsh industrial field conditions (vibration, dust, audio noise, intermittent satellite connectivity / "lie-fi", 24/7 continuous operations), the system enforces strict auditability, immutable ledger logs, offline resilience, and a strict light-mode OKLCH design system deployed across field terminals via local LAN binding (`0.0.0.0:3000`).

### Core Operational Personas

1. **Control Room Operators**: Real-time shift monitoring, hourly production loads grid, SCADA telemetry, and atomic shift closeout.
2. **Engineering & Breakdown Crews**: Mobile equipment breakdown logging, maintenance work orders, SMR (Service Meter Reading) hour tracking, and tire life wear analysis.
3. **Access Control & Security**: Personnel badging, contractor/visitor inductions, RFID coal truck tracking, and hardware badge printing.
4. **Supervisors & Executives**: Shift compilation reports, multi-site production summaries, automated audit compliance, and SLA tracking.

---

## Architecture & Data Flow

### High-Level Structure

The repository is structured as a **pnpm workspaces + Turborepo 2.x** monorepo:

- **`apps/portal`**: High-density Next.js 16 (React 19) App Router web application with standalone output mode and Turbopack support.
- **`packages/*`**: Foundational domain-agnostic packages (`@repo/contract`, `@repo/errors`, `@repo/supabase`, `@repo/database`, `@repo/redis`, `@repo/rate-limiter`, `@repo/logger`, `@repo/theme`, `@repo/ui`, `@repo/agents`, `@repo/eval`, `@repo/utils`, `@repo/typescript-config`).
- **`libs/*`**: Domain feature slices (`libs/features/auth`, `libs/features/departments`, `libs/features/hub`) and cross-cutting domain utilities (`libs/shared/data-access`, `libs/shared/hooks`, `libs/shared/utils`).
- **`tools/*`**: Build-time monorepo governance, Single Source of Truth policy compiler, AST compound bash safety check, and audit suites.
- **Background Engines**: Arch-CorpOS autonomous business loops (`.agents/corpos/bin/corpos`), Rust Tokio swarms (`tools/swarms-orchestrator`), and Inngest background event workflows (`@repo/utils/inngest`).

```
                           +-----------------------------------+
                           |    Browser / Field Terminal       |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           |   apps/portal/proxy.ts (Edge)     |
                           |   • Session validation            |
                           |   • Employee role resolution      |
                           |   • Security headers & CSP nonces |
                           +-----------------------------------+
                                             |
                     +-----------------------+-----------------------+
                     v                                               v
+------------------------------------------+    +------------------------------------------+
|  Server Actions / Route Handlers (API)   |    |         React Server Components          |
|  • Zod validation (@repo/contract)       |    |  • Read-only data queries                |
|  • Canonical AppError hierarchy          |    |  • OKLCH design tokens (@repo/theme)     |
|  • OpenTelemetry tracing & idempotency   |    |  • Pure UI components (@repo/ui)         |
+------------------------------------------+    +------------------------------------------+
                     |                                               |
                     v                                               v
+------------------------------------------------------------------------------------------+
|                                    Service Layer                                         |
|  • Two-tier Caching: L1 Memory LRU (1000 items) + L2 Redis with XFetch (@repo/redis)     |
|  • Multi-Strategy Rate Limiter: RedisStore / MemoryStore (@repo/rate-limiter)            |
|  • Structured Telemetry & Tracing: Pino + OpenTelemetry (@repo/logger)                  |
+------------------------------------------------------------------------------------------+
                     |
                     v
+------------------------------------------------------------------------------------------+
|                            Data Persistence (@repo/supabase)                             |
|  • PostgreSQL 15+ with Row Level Security (RLS) policies on every table                  |
|  • Stored Procedures & Atomic RPCs (packages/database/migrations/NNN_*.sql)              |
|  • Realtime CDC streaming (useSupabaseRealtime) & Kysely query builder                   |
+------------------------------------------------------------------------------------------+
```

### Monorepo Boundary Invariants

Enforced by `tools/repo/policy-compiler.cjs` via `tools/repo/policy/dependency.rules.json` and ESLint boundaries:

1. **No direct database access in apps**: `apps/*` MUST NOT import `packages/database` directly — data persistence routes through `@repo/supabase` or typed services.
2. **Pure UI components**: `packages/ui` MUST remain strictly pure presentational — zero database, Supabase, or backend access.
3. **Theme isolation**: `packages/theme` MUST NOT import `packages/ui`.
4. **No inverse dependencies**: `packages/*` and `tools/*` MUST NOT import `apps/*` (strict dependency inversion).
5. **Build-time tools isolation**: `tools/*` are build-time scripts; prohibited from importing runtime application packages.

### Key Functional Modules

- **Control Room & SCADA Operations** (`apps/portal/app/(departments)/control-room/`): Real-time dumper cycle times, excavator loading rates, delay logging (`delay_entries`), and atomic shift closeout (`/api/control-room/shift-closeout`) invoking the PostgreSQL `atomic_shift_closeout` stored procedure with SHA-256 payload idempotency.
- **Engineering & Fleet Reliability** (`apps/portal/app/(departments)/engineering/`): Equipment breakdown logging, SMR (Service Meter Reading) hour tracking, and tire life wear analysis.
- **Drilling Telemetry** (`apps/portal/app/(departments)/drilling/`): Bit depth and penetration tracking with Server-Sent Events (SSE) streaming via `/api/telemetry/drilling/stream`.
- **Access Control & Badging** (`apps/portal/app/(departments)/access-control/`): RFID coal truck tracking, visitor inductions, QR credential issuance, and hardware badge printing.
- **AI Agent Fleet & Tracing** (`packages/agents`): Multi-agent orchestration, reflection loops, and Langfuse observability (`packages/agents/src/langfuse.ts`).

### End-to-End Data Flow

1. **Request Ingress & Auth**: Handled by `apps/portal/proxy.ts`, validating Supabase SSR auth cookies, looking up department permissions in `employees`, and attaching CSP nonces.
2. **Contract Validation**: Incoming mutation payloads and query params are strictly parsed using canonical Zod schemas from `@repo/contract`.
3. **Caching Layer**: Queries consult the `@repo/redis` two-tier cache (L1 in-memory LRU, L2 Redis with XFetch probabilistic early expiration). Mutations trigger tag-based cache eviction (`cacheInvalidateTags`).
4. **Database Execution**: Database operations execute via `@repo/supabase` (server client or Kysely instance) with active PostgreSQL Row Level Security (RLS) enforcement.
5. **Real-time Synchronization & Resilience**: Field terminals receive updates via Supabase Realtime channels (`useSupabaseRealtime`). If pit connectivity degrades, `usePitConnectivity` alerts the UI and `useOfflineQueue` buffers mutations in `localStorage` (`arch_*_draft_*`), auto-replaying them upon reconnection.

---

## Key Directories

| Directory Path           | Purpose & Responsibilities                                                                                                          |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/portal/`           | Main Next.js 16 (React 19) App Router portal application (`app/`, `features/`, `hooks/`, `lib/`, `proxy.ts`).                       |
| `packages/contract/`     | Canonical Single Source of Truth for Zod schemas, TypeScript types, and OpenAPI specifications.                                     |
| `packages/errors/`       | Standardized `AppError` class hierarchy, error codes, and TypeScript type guards.                                                   |
| `packages/supabase/`     | SSR/browser Supabase client factories (`/server`, `/client`, `/middleware`), Kysely client (`/kysely`), and query instrumentation.  |
| `packages/database/`     | 164+ sequential PostgreSQL migrations (`migrations/NNN_*.sql`), rollback scripts, and safety tests.                                 |
| `packages/redis/`        | Two-tier (L1 Memory LRU / L2 Redis) caching layer with XFetch early expiration, TTL registry, and tag invalidation.                 |
| `packages/rate-limiter/` | Distributed multi-strategy rate limiters (sliding window, token bucket, fixed window) with DI stores.                               |
| `packages/logger/`       | Structured JSON logger powered by Pino (`serverLogger`, `browserLogger`) with OpenTelemetry correlation.                            |
| `packages/theme/`        | Style Dictionary token compiler, OKLCH design tokens, glass physics, and Tailwind preset.                                           |
| `packages/ui/`           | Pure React 19 UI component library (GlassCard, DataGrid, KPI cards, Radix primitives) and Storybook catalog.                        |
| `packages/agents/`       | Multi-agent execution engine, LangGraph workflows, Langfuse LLM telemetry, and reflection engine.                                   |
| `packages/eval/`         | DeepEval and Pytest LLM evaluation suites and golden test datasets (Python `>=3.10`).                                               |
| `packages/utils/`        | Shared utilities: resilient fetch client with circuit breaker, Inngest triggers, n8n integration, offline storage.                  |
| `libs/features/`         | Modular domain feature packages (`departments`, `auth`, `hub`) with separate UI and data-access layers.                             |
| `libs/shared/`           | Cross-domain shared React hooks (`useSupabaseRealtime`, `usePitConnectivity`), data access clients, and telemetry circuit breakers. |
| `tools/repo/`            | Architecture and dependency boundary compilers (`policy-compiler.cjs`, `dependency.rules.json`).                                    |
| `tools/scripts/`         | Quality gates (`enforce-quality-gates.sh`), AST compound-bash safety checker (`check-compound-bash.cjs`), and hooks bridge.         |
| `tools/audits/`          | Drift verification tools: token compliance, contract drift, RLS matrix, and bundle sizes.                                           |
| `infra/docker/`          | Docker Compose definitions for companion stacks (`compose.tools.yml`, `compose.ai-tools.yml`, `compose.portal.yml`).                |
| `e2e/`                   | Playwright end-to-end and visual regression test suites with cached auth state (`e2e/.auth/user.json`).                             |

---

## Development Commands

### Package Management & Setup

```bash
# Bootstrap entire repository (Node validation, dependencies, tokens, policies)
./setup.sh

# Bootstrap with clean slate
./setup.sh --clean

# Install via pnpm directly (runs postinstall: patch-glass-css.mjs)
pnpm install
```

### Development & Local Run

```bash
# Full interactive local dev system (smart asset sync + Turbopack + Monitor HUD)
pnpm dev

# Fast development server targeting the portal application directly
pnpm dev:turbo

# Fast headless startup
pnpm dev:quick

# Start development companion services in Docker (Postgres, Redis, tools)
pnpm dev:tools

# Start local AI tooling stack (Docker)
pnpm dev:ai

# Start dev server with Cloudflare tunnel
pnpm dev:cloudflare

# Start dev server connecting to hosted remote services
pnpm dev:hosted

# Start Storybook component workbench (port 6006)
pnpm --filter @repo/ui storybook

# Start local Inngest background event dev server
pnpm inngest:dev
```

### Build & Production

```bash
# Full monorepo build via Turborepo (syncs assets + builds all packages)
pnpm build

# Build only the portal application
pnpm --filter portal build

# Start production Next.js server (binds to 0.0.0.0:3000)
pnpm start

# Clear Next.js, Turborepo, and system runtime caches
pnpm clean:caches

# Analyze production bundle distribution
pnpm analyze
```

### Type Checking, Linting & Quality

```bash
# Comprehensive full-suite quality verification (Turborepo lint, typecheck, test, tokens, CSS, knip, policy, gates)
pnpm quality

# Type-check all packages via Turborepo (tsc --noEmit)
pnpm type-check

# Type-check single workspace
pnpm --filter @repo/contract type-check
pnpm --filter portal type-check

# Format entire codebase with Biome
pnpm format

# Verify formatting compliance without modifying files
pnpm format:check

# Run Biome linter across all workspaces
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Stylelint on CSS/tokens (verifies OKLCH token usage & animation performance)
pnpm lint:styles
pnpm lint:css-perf

# Spellcheck across codebase
pnpm lint:spelling

# Detect dead code and unused exports
pnpm knip
pnpm knip:fix

# Syncpack dependency alignment across package.json files
pnpm deps:check
pnpm deps:fix
pnpm deps:lint
```

### Policy & Quality Gates

```bash
# Compile architectural rules into ESLint boundaries
pnpm policy:gen

# Verify architectural rules and security checks in CI
pnpm policy:check

# Run 4-gate reality enforcement script (ARWR, tests, modernization, strict TS)
pnpm verify:gates

# Audit database schema vs contract synchronization
pnpm audit:drift

# Audit Row Level Security coverage and InitPlan optimizations
pnpm audit:rls
pnpm audit:rls-matrix

# Audit design token compliance (detects raw colors and forbidden dark: classes)
pnpm audit:tokens
```

### Database & Migrations

```bash
# Start local Supabase container stack (automatically synchronizes migrations first)
pnpm --filter @repo/supabase supabase:start

# Reset local database and re-apply all migrations cleanly
pnpm --filter @repo/supabase supabase:reset

# Generate TypeScript database types (src/database.types.ts)
pnpm --filter @repo/supabase supabase:gen-types

# Synchronize SQL migrations between @repo/database/migrations and Supabase
pnpm --filter @repo/database sync-migrations

# Check that migrations are strictly in sync
pnpm --filter @repo/database check-migrations

# Run migration rollback safety static analysis
pnpm --filter @repo/database test

# Seed local database via tsx
pnpm db:seed

# Reload PostgREST schema cache
pnpm db:schema-reload

# Generate database markdown documentation
pnpm db:docs
```

---

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

### File Length Limits & Modularity

- Target: 400–450 lines per file.
- Hard ceiling: 500 lines. Proactively decompose bloated files into subcomponents, domain hooks, or utility files.

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

### Test Frameworks & Test Types

- **Unit & Integration**: **Jest 29/30** with `@swc/jest` (`apps/portal`, `packages/*`, `libs/*`).
  - `jsdom`: For React 19 UI components and hooks (`apps/portal/setupTests.ts` injects web API polyfills).
  - `node`: For backend packages (`@repo/contract`, `@repo/errors`, `@repo/rate-limiter`, `@repo/redis`). Server actions and API routes in `apps/portal` declare `/** @jest-environment node */` at the file top.
- **End-to-End (E2E) & Visual**: **Playwright Test** (`e2e/`) running against Chromium viewports with auth session caching.
- **Component Accessibility**: **Storybook Test Runner** + `axe-playwright` (`packages/ui`) automating WCAG compliance checks.
- **AI Evaluation**: **Pytest** + **DeepEval** (`packages/eval`) testing LLM outputs, factual consistency, and hallucination bounds.
- **Database Migrations**: Node.js test runner verifying rollback safety (`packages/database/tests/migration-rollback-safety.mjs`) and PostgreSQL psql scripts asserting RLS security policies.
- **Load & Performance**: **k6** (`k6/stress-test.js`) enforcing latency thresholds (`p(99) < 1500ms`, `rate < 0.01`).
- **Dynamic Security**: **OWASP ZAP** (`scripts/pentest.sh`) running containerized baseline penetration scans.

### Single-Source Unit Test Runner Invariant (Anti-Runner Fragmentation / Jest 30 SSoT)

- **Mandate**: All unit and integration testing across TypeScript packages (`apps/portal`, `packages/*`, `libs/*`) is strictly standardized on **Jest 30** with `@swc/jest`. Introducing fragmented secondary test runners (such as `ava`, `mocha`, or `tape`) is prohibited.
- **Hard Negatives**:
  - NEVER introduce `ava`, `mocha`, or alternative runner packages into `package.json` dependencies.
  - NEVER author test files with conflicting assertion syntax (e.g. AVA's `t.is`, `t.deepEqual`) outside standard Jest `expect()` and Playwright `expect()`.
  - NEVER fragment Turborepo test execution across incompatible CLI test runners.
- **Quality Gate**: Verified automatically via `pnpm audit:hooks` (part of `pnpm audit:compliance`).

### Test Execution Commands

```bash
# Run all unit/integration tests across all packages via Turborepo
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage collection
pnpm test:coverage

# Run tests in apps/portal only
pnpm --filter portal test

# Run a single isolated Jest test file in apps/portal
pnpm --filter portal test -- apps/portal/app/api/health/route.test.ts

# Run tests matching a specific name pattern
pnpm --filter portal test -- -t "submitShiftCloseout"

# Run tests for specific packages or libs
pnpm --filter @repo/errors test
pnpm --filter @repo/redis test
pnpm --filter @repo/contract test
pnpm --filter @repo/rate-limiter test
pnpm --filter @repo/database test

# Run Playwright E2E tests (requires server on :3000)
pnpm test:e2e

# Run Playwright visual regression smoke tests
pnpm test:e2e:visual

# Run Playwright in interactive UI mode
pnpm exec playwright test --ui --config=e2e/playwright.config.ts

# Update golden visual comparison snapshots
pnpm exec playwright test --config=e2e/playwright.config.ts --update-snapshots

# Run Storybook accessibility checks (axe-playwright)
pnpm test:a11y

# Run AI evaluation suite (DeepEval)
cd packages/eval && poetry run pytest tests/ -v
```

### Mocking Strategies & Invariants

- **Mock at Network Boundaries**: Mock external services at network client boundaries (`@repo/supabase/server`, `@repo/redis`, `fetch`). NEVER mock internal business logic or pure calculation functions.
- **Redis Mock**: Unit tests in `setupTests.ts` use an in-memory `Map` simulating Redis commands (`get`, `set`, `del`, `incr`, `expire`) to prevent socket timeouts.
- **Supabase Query Spies**: Mock Supabase using chained query builder spies (`.from().select().eq().single()`).
- **Next.js Cache Mocks**: In tests, `unstable_cache` passes through to the underlying callback `(cb) => cb`; `revalidatePath` and `revalidateTag` are mocked via `jest.fn()`.
- **E2E Auth Caching**: `e2e/global.setup.ts` completes a one-time login before test workers run and saves session credentials to `e2e/.auth/user.json`. Playwright browser contexts consume `storageState: 'e2e/.auth/user.json'`.
- **Database Safety Invariants**:
  - Migrations must strictly match `packages/database/migrations/NNN_description.sql` (3-digit zero-padded prefix).
  - Every new table must enable RLS on line 1 immediately following creation (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
  - Rollback safety verified by `packages/database/tests/migration-rollback-safety.mjs`.

### Jest Diagnostic Command Guard

When investigating Jest open handles (`--detectOpenHandles`) or diagnosing test lifecycle warnings:

1. **Distinguish Diagnostic Tooling Errors from Test Failures**: If a command fails with `Unknown option: 'detectOpenHandles'`, this is a `pnpm` CLI argument forwarding error, NOT a test failure. The underlying test results remain valid.
2. **No Code Mutations from CLI Argument Errors**: Do not modify application code merely because `--detectOpenHandles` was rejected by `pnpm`.
3. **Invoke Jest Directly**:
   ```bash
   pnpm --filter portal exec jest --runInBand --detectOpenHandles app/api/scada/tags/route.test.ts
   ```
4. **Or Forward Arguments Explicitly via `--`**:
   ```bash
   pnpm --filter portal test -- --detectOpenHandles app/api/scada/tags/route.test.ts
   ```
5. **Categorize Warning Root Cause**:
   - Real open handle (unclosed socket, active interval timer, persistent connection).
   - Jest config issue (e.g. `forceExit` artifact).
   - `pnpm` argument forwarding error.
   - Normal framework/runtime behavior (e.g. Node experimental warning).
6. **Do Not Weaken Tests**: Never weaken, skip, delete, or rewrite assertions to suppress warnings.
7. **No Arbitrary Suppression**: Do not add arbitrary Jest flags, configuration, timers, or process exits simply to suppress warnings.
8. **Target Genuine Leaks Only**: Only modify application/test infrastructure when the diagnostic output identifies an actual resource-lifecycle problem.
9. **Verify with Normal Test Command**: Re-run the standard test command afterward and confirm that all test suites pass.

### Coverage & Quality Gate Thresholds

Configured in `apps/portal/jest.config.cjs`:

- **Statements**: 40%
- **Branches**: 30%
- **Functions**: 30%
- **Lines**: 40%
- **Strategic Target**: Long-term strategy mandates critical mutations (Server Actions, RLS helper policies, Auth, AI provider failovers) reach 90%+ unit coverage.
- **Output Directory**: `apps/portal/coverage/` (HTML, LCOV, text summary).

## Agent Personas & Operational Souls (Real-World Grounding)

To maximize real-world execution fidelity, all subagents operating in this monorepo MUST adopt their designated **Persona (Real world Job Role)** and operational **Soul**. This guarantees code is written with production-grade pragmatism, hardware constraints, and industrial safety in mind.

### 1. `database-architect`

- **Persona:** Principal PostgreSQL DBA & Data Engineer
- **Soul:** "Data is the lifeblood of the operation. I prevent data loss, ensure atomic transactional safety, strictly optimize InitPlan RLS policies, and treat every schema mutation as if it is running on a live 24/7 production system."

### 2. `ui-engineer`

- **Persona:** Senior React/Next.js Frontend Architect
- **Soul:** "User interfaces must be flawless, accessible, and instantaneous. I strictly enforce the light-mode OKLCH invariant, guarantee zero React hydration errors, and design for hostile field environments with extreme glare and dust."

### 3. `realtime-telemetry-engineer`

- **Persona:** Industrial IoT & SCADA Systems Engineer
- **Soul:** "I bridge the physical and digital. I ensure 100% telemetry uptime, gracefully handle 'lie-fi' satellite latency, prevent WebSocket socket leaks, and drop zero payloads from heavy machinery."

### 4. `autonomous-orchestrator` / `core-coordinator`

- **Persona:** Staff Systems Architect & Engineering Manager
- **Soul:** "Complexity is a liability. I maintain absolute architectural boundary integrity, meticulously plan tasks before execution, delegate efficiently, and prevent agentic drift."

### 5. `security-quality-gatekeeper`

- **Persona:** Application Security & Quality Assurance Lead
- **Soul:** "Trust nothing. Verify everything. I blindly enforce TypeScript strictness, validate boundary invariants, prevent SQL injections, and block all regressions before they infect the main branch."

### 6. `system-simplifier`

- **Persona:** Staff Refactoring Engineer
- **Soul:** "Code is a liability; less is more. I ruthlessly eliminate dead code, prune orphaned dependencies, aggressively manage bundle sizes, and simplify complex logic without altering behavior."

### 7. `critique-council-reviewer`

- **Persona:** Lead Site Reliability Engineer (SRE)
- **Soul:** "I am the last line of defense. I adversarial-test every assumption, verify hardware interlocks, demand empirical proof (via k6/playwright), and reject any PR that cannot survive a real-world outage."
