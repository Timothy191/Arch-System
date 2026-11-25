<!-- cspell:ignore Kysely Supavisor pgvector RediSearch pgbouncer t3-env DevOps Stylelint Knip Squawk Turbopack pnpm evals -->

# Tech Stack — Arch-System Monorepo

## Runtime & Build Toolchain

- **Node.js**: `>= 24.0.0` (local Mise toolchain: `24.15.0` / `26.8.1`).
- **Package Manager**: `pnpm@9.15.9` workspace monorepo.
- **Orchestration**: **Turborepo 2.x** (`turbo.json`) across `apps/*`, `packages/*`, `libs/*`, `tools/*`, `scripts/*`.
- **Language**: **TypeScript 5.9.3** (`strict: true`, `noUncheckedIndexedAccess: true`, `noExplicitAny: "error"`), plus Python 3 utilities/evals (`@repo/eval`) and Rust swarm CLI (`tools/swarms-orchestrator`).

## Frontend & Application Layer (`apps/portal`, `@repo/ui`, `@repo/theme`)

- **Framework**: **Next.js 16** App Router (`apps/portal`, package name `portal` — note: NOT `@repo/portal`) with `reactCompiler`, `cacheComponents` (`'use cache'`, `cacheLife()`, `cacheTag()`), and `next/proxy` (`apps/portal/proxy.ts` + `apps/portal/server/proxy.ts` replacing `middleware.ts`).
- **UI Library**: **React 19** (Async Server Components by default; leaf `'use client'` interactive components).
- **Styling & Design System**: **Tailwind CSS**, **Radix UI** primitives (`@repo/ui` via explicit subpath imports such as `@repo/ui/GlassCard`, never deep `/src/` paths), **Framer Motion** (reduced-motion safe), and **OKLCH** design tokens + Style Dictionary codegen (`@repo/theme`).
- **State Management**:
  - **Server State**: RSC + **TanStack Query** persisted to `localStorage` with `BroadcastChannel` cross-tab invalidation (**SWR is prohibited**).
  - **Client UI & Offline State**: **Zustand 5** stores + IndexedDB (`idb-keyval`) offline queues (`@repo/shared/hooks`).
  - **Forms**: **React Hook Form** + `@hookform/resolvers/zod`.
  - **Workflow Actors**: **XState 5** (`apps/portal/lib/plugins/machines/`).

## Backend, Data, Caching & Security (`@repo/*`)

- **Database & Auth**: Cloud **Supabase** (**PostgreSQL 17**, Auth via `getClaims()` / `getAuthenticatedEmployee()`, Realtime CDC via `useSupabaseRealtime`, Row-Level Security on every `public` table).
- **Typed Database Access**:
  - `@repo/supabase` explicit subpaths: `./server`, `./client`, `./middleware`, `./proxy`, `./read-replica`, `./kysely` (Supavisor `:6543/?pgbouncer=true` pooled **Kysely** query builder), and `./service-role` (privileged server actions/jobs only).
  - `@repo/database`: Immutable zero-padded SQL migrations (`NNN_snake_case.sql`).
- **Contracts & Validation**: `@repo/contract` (**Zod 4** schemas and inferred TS types SSoT; compiled to `dist/`, verified against DB/API via `pnpm audit:drift`).
- **Caching & Distributed State**: `@repo/redis` capability-only facade (`./cache` L1/L2 + tag invalidation, `./session` with privilege-version revocation, `./analytics`, `./search`, streams, locks) over local TCP Redis 7.4 in dev and serverless REST Redis in production.
- **Resilience, Rate Limiting & Observability**: `@repo/rate-limiter` (`MemoryStore` / `RedisStore`), `@repo/errors` (`AppError` hierarchy), `@repo/logger` (**Pino**), OpenTelemetry spans (`withAsyncSpan`), **Inngest** background workflows (`@repo/utils/inngest`), and `@repo/intelligence` mining analytics engines.

## Verification, Quality Gates & Deployment

- **Formatting & Linting**: **Biome 2.5** (`biome.json` with `useSortedClasses: "error"`), **Prettier** (`*.md`, `*.css`, `*.scss`, `*.yaml`), **Stylelint**, **CSpell** (`config/tools/cspell.json`), **Markdownlint** (`config/tools/.markdownlint.json`), **Commitlint** (`@commitlint/config-conventional`).
- **Static & Architecture Governance**: Policy Compiler (`pnpm policy:check`), Circular Dependencies (`pnpm cycles`), Dead Code (`pnpm knip`), Dependency Sync (`pnpm deps:lint`), CodeGraph Intelligence (`pnpm audit:code-intelligence`), Migration Linter (`pnpm lint:migrations` / Squawk PG17).
- **Testing & Load**: **Jest** + React Testing Library (`pnpm --filter portal test`), coverage ratchet (`pnpm test:coverage:changed`, `>= 70%` statements/lines), `@repo/database` Node RLS tests, **Playwright** E2E/a11y, **k6** load scripts.
- **Completion Gate & Hosting**: 28-gate `pnpm agent:verify` suite; deployed to **Vercel** (`arch-system` project, aliased to `https://arch-system-dun.vercel.app`) via `main`.
