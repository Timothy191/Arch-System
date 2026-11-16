# Repository Guidelines

## Project Overview

**Arch-System** (Plantcor / Arch OS) is a production industrial mining-operations portal serving multi-departmental workspaces (control room, drilling, production, plant processing, plant inventory, engineering, availability and utilization, access control, office, executive hub, system overview, and database administration) with live SCADA telemetry, shift closeout workflows, and audit-logged RBAC.

Built as a **Next.js 16 App Router + React 19** monorepo (`pnpm@9.15.9`, Turborepo 2.x, TypeScript 5.9, Node.js >=24), it deploys to Vercel (`arch-system`) and connects to cloud-hosted **Supabase** (PostgreSQL 17, Auth, Realtime CDC) and **Redis** (local TCP in development; serverless REST compatible in production).

**Repository topology**: `/home/tim/Fork/Arch-System` is a standalone Git repository (`github.com/Timothy191/Arch-System`). When checked out inside `/home/tim/Fork`, the parent directory acts as a zero-dependency federated wrapper (`pnpm install` is blocked in `Fork/`) alongside standalone MCP servers (`skills-mcp`, `memory-gateway-mcp`, `slim-tooling-mcp`, `langgraph-mcp`). Run all package, git, and verification commands inside `Arch-System/` unless editing a sibling MCP server.

---

## Architecture & Data Flow

### Workspace structure & key modules

```text
Arch-System/
├── apps/portal/          # Sole deployable Next.js 16 app (package name: `portal`, NOT `@repo/portal`)
├── packages/*            # Shared @repo/* libraries (contract, supabase, database, redis, errors, ...)
├── libs/features/*/*     # Domain slices: auth, departments, hub × {ui, data-access, utils}
├── libs/shared/*         # Cross-cutting @repo/shared/{hooks, data-access, utils}
├── tools/*               # Build-time governance, audits, policy compiler, Rust orchestrator
├── scripts/              # Dev orchestration, asset sync, CSS patching, DB seeds
├── e2e/                  # Playwright E2E, visual regression, a11y, and k6 load scripts
└── config/tools/         # Centralized linter, spellcheck, dead-code, and dependency configs
```

Key `@repo/*` modules:

- `@repo/contract` — Canonical Zod 4 schemas and inferred TypeScript types (`./validation`, `./schemas/*`, `./types/*`; built via `tsc` to `dist/`). Every database table/column requires a matching schema (`pnpm audit:drift`).
- `@repo/supabase` — Typed data access via explicit subpaths: `./server`, `./client`, `./middleware`, `./proxy`, `./read-replica`, `./kysely`, `./service-role`. Always import server clients from `@repo/supabase/server` or `@repo/supabase/service-role` directly so `next/headers` never leaks into client bundles.
- `@repo/database` — Immutable PostgreSQL 17 SQL migrations SSoT (`packages/database/migrations/NNN_snake_case.sql`).
- `@repo/redis` — Capability-only Redis layer (`./cache` L1/L2 + tag invalidation, `./session` auth sessions with privilege-version revocation, `./analytics`, `./search` RediSearch + pgvector fallback, streams, and distributed locks) atop transport facade `./raw`. Never issue raw Redis commands in application code.
- `@repo/errors` — `AppError` hierarchy and `isAppError` boundary guards.
- `@repo/rate-limiter` — Pluggable `RateLimiter` (`MemoryStore` / `RedisStore` × `FixedWindowStrategy` / `SlidingWindowStrategy` / `TokenBucketStrategy`).
- `@repo/theme` — Light-mode OKLCH design tokens, Style Dictionary codegen, Tailwind preset, and CSS variables (`./tokens`, `./css`, `./react`, `./tailwind`, `./motion`).
- `@repo/ui` — Pure presentational Radix/Tailwind primitives exposed via explicit subpath exports (`@repo/ui/GlassCard`, `@repo/ui/Logo`, `@repo/ui/globals.css`).
- `@repo/intelligence` — Operational mining intelligence engines (`TelemetryAnomalyEngine`, `PredictiveMaintenanceEngine`, `ProductionForecastEngine`, `ShiftIntelligenceEngine`, `OperationsCopilotEngine`).
- `@repo/logger` (`./server`, `./browser`, `./next` Pino), `@repo/utils` (`./client`, `./server`, `./inngest`, `./novu`, `./n8n`, `./offline-storage`, `./fetch-client`), `@repo/agents` (coordinator, swarm, token-budget), `@repo/eval` (Python DeepEval suite).

### Layering boundaries (`tools/repo/policy-compiler.cjs`)

Machine-enforced by `pnpm policy:check` and `pnpm cycles` (zero circular dependencies across `apps/`, `packages/`, `libs/`):

| Source                  | Forbidden Target                         | Reason                                                              |
| :---------------------- | :--------------------------------------- | :------------------------------------------------------------------ |
| `apps/*`                | `packages/database`                      | Route persistence through `@repo/supabase` or feature `data-access` |
| `packages/ui`           | `packages/database`, `packages/supabase` | UI stays strictly presentational                                    |
| `packages/theme`        | `packages/ui`                            | Theme tokens feed UI, never the reverse                             |
| `packages/*`, `tools/*` | `apps/*`                                 | Strict dependency inversion                                         |
| `tools/*`               | `packages/supabase`                      | Build-time tools never import runtime database clients              |

### Request & data flow

```text
Browser Request
  → apps/portal/proxy.ts          # Next.js 16 proxy (replaces middleware.ts): per-request x-nonce + CSP
  → apps/portal/server/proxy.ts   # Supabase SSR getClaims(), Redis session cache (150ms budget), route RBAC
  → apps/portal/app/layout.tsx    # ArchThemeProvider → ClientProviders (ReactQuery + OfflineQueue) → AnimationProvider
  → Route Groups                  # (auth) | (departments)/[department] | hub | overview | admin | docs | api/*
```

- **RSC-first**: Pages and layouts are async Server Components by default (`/` redirects to `/hub`). Interactivity is isolated to leaf `'use client'` components receiving minimal serialized props.
- **Dual-tier server caching**: Cached RSCs use `'use cache'` with named `cacheLife()` profiles (`apps/portal/lib/server-cache.ts`) and scoped tags (`apps/portal/lib/cache-tags.ts`), paired with `withCache()` (`@repo/shared/utils`) for Redis L1/L2 read-through. `updateTag()` / `updateTags()` invalidates both Next.js Data Cache and Redis tags.
- **Client state & realtime**: Client server-state uses TanStack Query persisted to `localStorage` (`apps/portal/app/ReactQueryProvider.tsx` with `BroadcastChannel` cross-tab invalidation; **SWR is prohibited**). Live updates subscribe to Supabase Realtime CDC via `useSupabaseRealtime` — never add manual polling loops.

---

## Key Directories

- `apps/portal/app/` — App Router routes: `(auth)`, `(departments)/[department]` plus dedicated department workspaces (`control-room`, `drilling`, `engineering`, `access-control`, `database`, `office`), `hub`, `overview`, `admin`, `api/*` (~37 route groups).
- `apps/portal/lib/` — Server cache SSoT (`server-cache.ts`, `cache-tags.ts`), API guards (`api/rate-limit-middleware.ts`, `body-limit.ts`), boundary error classes (`errors/`), XState plugin machines (`plugins/machines/`), observability, and Server Actions (`actions/`).
- `libs/features/` — Domain vertical slices (`auth`, `departments`, `hub`) split into `ui`, `data-access`, and `utils` (note: department Server Actions also live in `libs/features/departments/ui/src/*/actions.ts`).
- `libs/shared/` — `@repo/shared/hooks` (30+ SSR-safe hooks: `useSupabaseRealtime`, `useOfflineQueue`, `useThrottledDebounce`, `useRedisCache`), `@repo/shared/data-access`, and `@repo/shared/utils` (`env.ts` Zod/t3-env validator, `cache-utils.ts`).
- `tools/` — `repo/policy-compiler.cjs`, `audits/*` (invariant gates), `scripts/*` (`agent-verify.sh`, `local-ci.mjs`, `ci-reindex.cjs`, `token-tracker.cjs`), `swarms-orchestrator/` (Rust CLI), `zero-drift-watchdog/`.
- `infra/` — Local Docker stacks (`docker/compose.redis.yml`, `compose.redis-stack.yml`, `compose.tools.yml`), hardened `redis/redis.conf`, and K8s/Terraform manifests.
- `docs/` & `.agents/` — Engineering specs/runbooks (`docs/agents/`, `docs/specs/`) and agent governance (`.agents/GUIDE.md`, `.agents/SYSTEMS.md`, `.agents/rules/`). Automated audit outputs write to `documentation/03-audit-reports/`.

---

## Development Commands

Run all commands from `Arch-System/` unless noted (`Fork/Makefile` delegates `make verify`, `make dev-portal`, and `make build-all` here).

### Install, run, & build

```bash
pnpm install --frozen-lockfile # Workspace install (never run in parent Fork/)
pnpm dev                       # Full dev stack: Redis :6379 + Insight :5540, asset sync, portal :3000
pnpm dev:quick                 # Fast headless portal only (cloud Supabase, skips Docker)
pnpm dev:turbo                 # Asset sync + turbo run dev --filter=portal
pnpm redis:up                  # Start local Redis 7.4 + RedisInsight (:5540) independently
pnpm build                     # sync-assets-smart.cjs → patch-glass-css.mjs → turbo run build
pnpm type-check                # turbo run type-check --concurrency=2
pnpm lint                      # turbo run //#lint:ci (Biome across workspace)
pnpm lint:styles && pnpm lint:spelling && pnpm md:lint
pnpm test                      # turbo run test
```

### Fast inner-loop & targeted checks

Prefer targeted package checks before full monorepo runs:

```bash
pnpm --filter portal test -- --testPathPatterns="shift-closeout" # Single portal Jest suite
pnpm --filter portal type-check                                  # Portal tsc --noEmit
pnpm turbo:affected:type-check                                   # Changed packages vs HEAD~1 (:test / :lint / :build)
pnpm test:dept:control-room                                      # Verify dept route, proxy allowlist, registry & tests
pnpm --filter @repo/database test                                # Node migration RLS, rollback & offline security tests
pnpm lint:migrations                                             # Squawk PG17 + new-table RLS check
pnpm --filter @repo/theme codegen                                # Regenerate committed CSS/TS tokens from tokens.json
pnpm --filter @repo/supabase supabase:gen-types                  # Refresh generated database.types.ts
```

### Policy, audits, & completion gates

```bash
pnpm policy:check              # Verify compiled boundaries + security checks (run `pnpm policy:gen` on drift)
pnpm audit:drift               # @repo/contract Zod schemas vs DB/API surface
pnpm audit:compliance          # Full static invariant sweep (tokens, Tailwind, RSC, caching, RLS, hooks, agents)
pnpm cycles && pnpm deps:lint && pnpm knip
pnpm ci:reindex && pnpm ci:snapshot && pnpm audit:code-intelligence # Refresh & verify CodeGraph SQLite index
pnpm agent:verify              # Mandatory 28-gate fail-fast suite (writes .ci-local/agent-verify-evidence.json)
pnpm quality                   # Full release-grade verification suite
```

---

## Code Conventions & Common Patterns

### Formatting & linting

- **Biome 2.5** (`biome.json`): 2-space indent, 100 columns, single quotes in TS/JS, double quotes in JSX, semicolons required, ES5 trailing commas, `noExplicitAny: "error"` (relaxed in test files), `noUnusedVariables` / `noUnusedImports: "error"`, and `nursery/useSortedClasses: "error"` (auto-sorted across `className`, `classList`, `*ClassName`, `cn`, `clsx`, `cva`, `twMerge`). Several Biome `a11y` and `noImgElement` rules are disabled in Biome because dedicated gates enforce them (`audit:images`, Storybook axe, Playwright a11y).
- **Prettier** (`prettier.config.mjs`, 100 columns) formats `*.md`, `*.css`, `*.scss`, `*.yaml`; **Stylelint** (`stylelint.config.mjs`) enforces CSS token variables (`var(--*)`) and high-performance animations; **CSpell** (`config/tools/cspell.json` + `config/project-words.txt`) enforces `en-US` spelling; **Markdownlint** (`config/tools/.markdownlint.json`) requires blank lines around headings (`MD022`), lists, and fences. **ESLint is not installed** (`config/tools/eslint.boundaries.cjs` is a generated policy artifact only).
- `.qoder/settings.json` PostToolUse hooks automatically run `biome check --write`, `markdownlint --fix`, `prettier`, and `cspell` on edited files.

### 10 core code quality rules

1. **No magic numbers or strings** — extract thresholds, timeouts, and keys to `UPPER_SNAKE_CASE` constants (`-1`, `0`, `1` exempt).
2. **Max 2 positional parameters** — 3+ inputs or any boolean flag must take a single typed `Options` object.
3. **Rule of Three** — keep inline 1st time, duplicate 2nd time, extract shared helper only on the 3rd identical occurrence.
4. **Guard clauses** — validate edge cases at the top and return early; max block nesting depth `2`; never `else` after `return` or `throw`.
5. **Discriminated unions** — model multi-stage state via tagged `status` unions (`'idle' | 'loading' | 'success' | 'error'`), never parallel booleans.
6. **Semantic identifiers with units & prefixes** — banned names: `data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr`. Append units (`timeoutMs`, `maxWeightTons`) and prefix booleans (`is`, `has`, `can`, `should`, `did`, `will`).
7. **Default to immutability** — type array/object inputs `readonly`; return new references (`map`, `filter`, spread) and never `.push()` or mutate arguments.
8. **Lookup maps over branching chains** — prefer exhaustive `Record<Key, Value>` dictionaries over `if/else if` ladders or `switch` blocks.
9. **Single level of abstraction** — cyclomatic complexity <= 8, ~50 lines max per function; either orchestrate steps or implement one low-level task.
10. **Never swallow errors** — every `catch` must return a typed fallback or rethrow with operation context, entity IDs, and `{ cause: error }`.

### Naming conventions

- **React components**: `PascalCase.tsx` (`GlassCard.tsx`, `PlantDelaysAnalyticsSection.tsx`).
- **Hooks**: `useCamelCase.ts` (`useSupabaseRealtime.ts`, `useThrottledDebounce.ts`).
- **Contract schemas & types**: `kebab-case.schema.ts` (`shift-closeout.schema.ts`), `kebab-case.types.ts`, utilities in `kebab-case.ts`.
- **SQL migrations**: 3-digit zero-padded `NNN_snake_case.sql` (`218_add_head_office_and_ensure_sites.sql`) — never rename or renumber applied files.
- **Commits**: Conventional Commits (`<type>(<scope>): <imperative lower-case summary>`), enforced by `commitlint`.

### Error handling

Extend or throw `AppError` subclasses from `@repo/errors` (`ValidationError` 400, `AuthError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `RateLimitError` 429, `DatabaseError` 500, `APIError` / `NetworkError` / `FetchTimeoutError` 502/504; portal mirrors boundary-safe classes in `apps/portal/lib/errors/error-classes.ts`). Narrow errors at API/action boundaries with `isAppError(err)` and log through `logError` (`@/lib/errors/error-logger`) or `@repo/logger`. Never leak raw database messages or service-role credentials to clients.

### Server Action pattern (Canonical 8-Step Security Sequence)

Protected Server Actions (`'use server'`) and Route Handlers follow this exact order: **1. Authenticate → 2. Authorize → 3. Validate (`@repo/contract`) → 4. Rate-limit → 5. Execute → 6. Audit log → 7. Invalidate caches → 8. Return typed result** (always invalidate before `redirect()`, which throws a control-flow exception):

```typescript
'use server';

import {
  shiftCloseoutSchema,
  type ShiftCloseoutInput,
} from '@repo/contract/schemas/control-room.schema';
import { AuthError, ForbiddenError, RateLimitError, ValidationError } from '@repo/errors';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { tagDepartment } from '@/lib/cache-tags';
import { updateTag } from '@/lib/server-cache';

const closeoutLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: 5,
  windowMs: 60_000,
  keyPrefix: 'ratelimit:shift_closeout:',
});

export async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) throw new AuthError('Unauthorized');
  if (!principal.employee.accessible_departments.includes('control-room')) {
    throw new ForbiddenError('Insufficient department access');
  }

  const parsed = shiftCloseoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { allowed } = await closeoutLimiter.check(principal.user.id);
  if (!allowed) throw new RateLimitError('Rate limit exceeded');

  const { data: closeoutRecord, error } = await supabase.rpc('close_shift', parsed.data);
  if (error) throw error;
  logger.info({ event: 'shift_closeout_submitted', actorId: principal.user.id });

  await updateTag(tagDepartment('control-room', 'shift-closeout'));
  return { success: true as const, closeoutRecord };
}
```

### Async, RSC, & caching patterns

- Parallelize independent queries with `Promise.all` / `Promise.allSettled`; wrap shared per-request lookups in `React.cache()` (e.g., `apps/portal/lib/dept-registry.ts`).
- In cached Server Components, combine `'use cache'`, `cacheLife('<profile>')`, and `cacheTag(...)` (`apps/portal/lib/server-cache.ts`). Never access `cookies()`, `headers()`, or dynamic `searchParams` inside a `'use cache'` scope.
- Stream slow promises from RSCs into `<Suspense>` boundaries and unwrap with React 19 `use(promise)`.
- Client hooks must guard `window`, `document`, and `localStorage` for SSR hydration safety and clean up subscriptions/timers (`pnpm audit:hooks`).

### Dependency injection & service factories

Always acquire external clients through factory functions to preserve pooling and test isolation:

- **Supabase**: `createServerSupabaseClient()`, `createBearerSupabaseClient(token)` (`@repo/supabase/server`), `createBrowserSupabaseClient()` (`@repo/supabase/client`), `createMiddlewareClient(request)` (`@repo/supabase/middleware`), `createReadReplicaClient()` (`@repo/supabase/read-replica`), `createServiceRoleClient()` (`@repo/supabase/service-role` — privileged server writes only), `getAuthenticatedEmployee()` (`@repo/supabase`), `createKyselyClient()` (`@repo/supabase/kysely` — Supavisor `:6543/?pgbouncer=true` pooled client).
- **Redis & Rate Limiting**: `getRedisClient()` (`@repo/redis/client`), `cacheGetOrSet` / `cacheWrap` / `cacheInvalidateTags` (`@repo/redis/cache`), `new RateLimiter({ store, strategy, limit, windowMs, keyPrefix })` (`@repo/rate-limiter`), or `withRateLimit()` (`apps/portal/lib/api/rate-limit-middleware.ts`).

### State management

1. **Server state**: React Server Components + TanStack Query (`apps/portal/app/ReactQueryProvider.tsx`, `apps/portal/hooks/useDashboardQueries.ts`).
2. **Client UI & offline queue**: Zustand 5 stores (`apps/portal/hooks/useNavigationState.ts`, `hooks/useSplitWindow.ts`, `libs/shared/hooks/src/useOfflineQueue.ts` backed by IndexedDB `idb-keyval`).
3. **Forms**: React Hook Form + `@hookform/resolvers/zod` (`DailyLogForm.tsx`) with local draft persistence.
4. **Workflow orchestration**: XState 5 actors (`apps/portal/lib/plugins/machines/orchestrator.machine.ts`, `plugin.machine.ts`).

### Hard UI, database, & workspace invariants

- **Light mode only**: Canvas `#f3f4f6` (`data-theme="light"`), semantic OKLCH variables from `@repo/theme`. Zero `dark:` utilities or raw hex/RGB values (`pnpm audit:tokens`).
- **Glass surfaces & imports**: Use `@repo/ui/GlassCard` (`variant="default" | "window" | "spotlight" | "glowborder" | "liquid"`). Import via canonical package subpaths (`@repo/ui/GlassCard`), never deep `/src/` paths.
- **Tailwind & CSS budgets**: <= 20 utilities per element (target <= 12); extract chains of >= 10 utilities repeated >= 3 times into a component, CVA variant, or module `cn()` constant (`pnpm audit:tailwind`; total CSS <= 115 KB via `pnpm lint:css-perf`). Use `next/image` with explicit dimensions and `alt`.
- **PostgreSQL RLS**: Every `public` table must enable RLS consulting `(SELECT auth.uid())` and `public.employees` (`pnpm audit:rls-matrix`).
- **Consolidated tracing**: Record workspace changes in root `AGENT_TRACER.md` only (ISO-8601 heading at top). Never create per-package `*/AGENT_TRACER.md` or variant filenames (`pnpm audit:agents:check`).

---

## Important Files

- `AGENTS.md` — Canonical repository guidelines (`GEMINI.md` and `CLAUDE.md` -> `GEMINI.md` hold the compact operational summary; `.agents/GUIDE.md` and `.agents/SYSTEMS.md` document agent hooks, skills, and A2A architecture).
- `AGENT_TRACER.md` — Single root chronological handover ledger.
- `apps/portal/proxy.ts` & `apps/portal/server/proxy.ts` — Next.js 16 CSP/nonce proxy and Supabase/Redis session + RBAC gatekeeper.
- `apps/portal/app/layout.tsx` & `apps/portal/app/ClientProviders.tsx` — Root RSC shell and client query/offline/error providers.
- `apps/portal/next.config.mjs` — `reactCompiler`, `cacheComponents`, `partialPrefetching`, `cacheLife`, 19 `transpilePackages`, `turbopack.root`.
- `apps/portal/lib/server-cache.ts` & `apps/portal/lib/cache-tags.ts` — Cache profiles, tag builders, and dual-tier Next + Redis invalidation.
- `packages/contract/src/index.ts` — Zod contract SSoT (`src/schemas/*.schema.ts`).
- `packages/database/migrations/` — Canonical SQL migrations (`packages/supabase/migrations` symlinks here).
- `packages/supabase/src/kysely.ts` & `packages/supabase/src/database.types.ts` — Pooled Kysely query builder and generated Supabase types (protected from manual edits).
- `packages/theme/src/tokens/` — OKLCH design-token SSoT (`generated.ts` and `variables-generated.css` are codegen-only).
- `packages/ui/src/components/GlassCard.tsx` — Primary light-mode liquid-glass surface component.
- `tsconfig.base.json` & `packages/typescript-config/` — Workspace `@repo/*` path maps and strict TypeScript configs (`strict`, `noUncheckedIndexedAccess`).
- `tools/repo/policy-compiler.cjs` — Boundary & security policy SSoT (compiles `tools/repo/policy/*`).
- `tools/scripts/agent-verify.sh` — 28-gate completion suite.
- `.qoder/settings.json` & `.qoder/hooks/protect-paths.sh` — Auto-format hooks and write-protection guard for `.env*`, generated files, and code-intelligence SSoT files.

---

## Runtime/Tooling Preferences

- **Node.js & pnpm**: Requires **Node.js `>=24.0.0`** (`.node-version` and `.nvmrc` pin `24`) and **`pnpm@9.15.9` exclusively** (`packageManager` in `package.json` — never `npm`, `yarn`, or `bun`). Shared dependencies use `pnpm-workspace.yaml` catalogs (`catalog:` and `catalogs.react19`), enforced by `pnpm deps:lint` (`syncpack`). If `pnpm` or `cargo` is missing from a non-login `PATH`:

  ```bash
  export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$HOME/.cargo/bin:$PATH"
  ```

- **Secondary runtimes & services**:
  - **Rust `1.85.0`** (`tools/swarms-orchestrator/rust-toolchain.toml`, `cargo ... --locked`).
  - **Python `>=3.10`** (`packages/eval/pyproject.toml`, Poetry or `uv` for DeepEval/pytest; Ruff 100-col lint).
  - **Cloud Supabase + Local Redis**: Target cloud-hosted Supabase exclusively (do not start a local Supabase container stack); run local Redis via `pnpm redis:up` (`infra/docker/compose.redis.yml`).
  - **Vercel**: Single canonical project `arch-system` (`vercel.json`; deploy via `pnpm deploy:vercel:prod`).
- **Code-Intelligence substrate**: Prefer `codemap` and `ast-grep` for structural exploration. The CodeGraph SQLite index at `/home/tim/local.db` (baseline in `.agents/memory_base/index-snapshot.json`) is enforced by Gate 28 (`pnpm audit:code-intelligence`, requiring >= 50% ranged entities and exact baseline parity). Never hand-edit `local.db`; rebuild via `pnpm ci:reindex && pnpm ci:snapshot`.
- **Hooks, MCP, & budgets**:
  - Husky `pre-commit` runs `lint-staged`, skill checks, `validate:json`, and `check-enforcement-integrity.cjs` (`--no-verify` is blocked by `commit-guard.sh`). `pre-push` executes `agent-verify.sh` unless `.ci-local/agent-verify-evidence.json` recorded all 28 gates passing within 15 minutes (`FORCE_AGENT_VERIFY=1` bypasses cache).
  - `.mcp.json` registers `supabase`, `codemap`, `chrome-devtools`, `context7`, and `frontend-checklist` (validated by `pnpm mcp:verify`).
  - Environment files: `Arch-System/.env`, `apps/portal/.env` (validated in `libs/shared/utils/src/env.ts`), and `.env.tools`. Keep `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, and `DATABASE*_URL` strictly server-only.
  - `pnpm token:budget-check` enforces a `40,000`-byte inode-deduplicated ceiling across root instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude.local.md`, `GEMINI.md`, `.cursorrules`).

---

## Testing & QA

### Test frameworks & suites

- **Unit & Component (`*.test.ts(x)`)**: **Jest 30 + `@swc/jest`** across `apps/portal` and 14 `packages/*` / `libs/*` workspaces (no Vitest). `apps/portal/jest.config.cjs` defaults to `jsdom` with `apps/portal/setupTests.ts` (in-memory mocks for `next/cache`, `@repo/redis`, `@repo/agents`, `next/dynamic`, and DOM observers). Server Action and Route Handler tests opt into Node via `/** @jest-environment node */` comments.
- **Database (`@repo/database`)**: Runs Node `node:test` and `.mjs` security/rollback scripts (`pnpm --filter @repo/database test`; `test:migration-replay` validates against a disposable `postgres:17-alpine` container).
- **Redis Integration (`*.integration.test.ts`)**: Live TCP suites in `packages/redis/tests/integration/` and `apps/portal/test/integration/` (drops `setupTests.ts` mocks), gated by `REDIS_INTEGRATION=1` (`pnpm test:redis:integration`).
- **Python AI Eval (`@repo/eval`)**: `pytest` + `deepeval` in `packages/eval/` (silently skips under `pnpm test` if neither `poetry` nor `uv` is installed; CI enforces `poetry run deepeval test run tests/`).
- **E2E & Visual (`e2e/*.spec.ts`)**: **Playwright** (`e2e/playwright.config.ts`) running `setup` -> `chromium`, `mobile-chrome`, `tablet-chrome` with cached auth in `e2e/.auth/user.json` (optional `PLAYWRIGHT_WEBKIT=1`). Automatically starts `portal` on `:3000` unless `BASE_URL` is set; runs headed locally (`CI=1 pnpm test:e2e` for headless). Visual regression (`pnpm test:e2e:visual`) uses Linux Chromium snapshots with `maxDiffPixelRatio: 0.02`. k6 load tests live in `e2e/load/`.
- **Accessibility**: `@repo/ui` has no Jest suite; run `pnpm --filter @repo/ui storybook` (`:6006`) then `pnpm test:a11y` (`packages/ui/.storybook/test-runner.cjs` + axe, which must remain `.cjs` on Node 24+). Complemented by `e2e/accessibility.spec.ts` and `e2e/visual/accessibility.spec.ts`.

### Coverage expectations, conventions, & gotchas

- **Coverage floor**: Enforced in `apps/portal/jest.config.cjs` (`lines: 40`, `branches: 27`, `functions: 28`, `statements: 40`). `pnpm test` does not collect coverage; run `pnpm --filter portal test -- --coverage` to verify thresholds locally.
- **Test style & mocking**: Co-locate `*.test.ts(x)` beside source files. Use BDD `describe('Given …')` / `it('When …, Then …')` or `it('should <outcome> when <condition>')` with Arrange-Act-Assert structure. Mock **only at network/service boundaries** (`@repo/supabase/*`, `@repo/redis`, `next/cache`), never internal domain logic.
- **Non-obvious gotchas**:
  - **Portal `moduleNameMapper`**: Adding a new `@repo/*` package or explicit subpath export imported by `portal` requires a matching entry in `apps/portal/jest.config.cjs` (and `tsconfig.base.json`), otherwise Jest resolution fails.
  - **Zero focused tests**: `test.only` and `describe.only` in `e2e/**/*.spec.ts` fail Gate 19 (`pnpm audit:e2e-journeys`).
  - **Visual snapshot masking**: Always mask live clocks and status badges (`[data-testid='clock']`, `scada-connection-status-badge`) in Playwright screenshot assertions.
