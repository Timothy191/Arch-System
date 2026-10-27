# Repository Guidelines

## Project Overview

**Arch-System** (Plantcor / Arch OS) is an industrial **mining-operations portal** — a multi-departmental, authenticated web application serving department-specific dashboards (drilling, production, access control, engineering, control room, system overview, database admin) for a real mining operation. It is a Next.js 16 App Router + React 19 monorepo on pnpm + Turborepo, deployed to Vercel, backed by Supabase (Postgres + Realtime CDC), Redis-cached, with SCADA telemetry integration.

## Architecture & Data Flow

### Workspace topology

```
apps/
  portal/          # sole Next.js 16 app (package name `portal`, not @repo/portal)
packages/          # @repo/* shared libs (theme, ui, contract, supabase, database, redis, errors, logger, rate-limiter, agents, eval, utils, typescript-config)
libs/
  features/        # auth, departments, hub (each: ui/, data-access/, utils/)
  shared/          # hooks, data-access, utils
tools/             # build-time: repo/policy-compiler, audits, scripts, zero-drift-watchdog
```

### Request flow

```
browser → proxy.ts (CSP + x-nonce) → server/proxy.ts (Supabase auth claims, employee role/dept, Redis-cached)
  → app/layout.tsx (theme → client providers → React Query → animation)
  → route group: (auth) | (departments)/[department] | admin | hub | overview | docs | api
```

### Data flow patterns

- **RSC-first**: Server Components by default; interactivity in leaf `'use client'`. Data fetched server-side only.
- **Dual-tier cache**: `lib/server-cache.ts` — `cachedRSC` wraps Next.js Data Cache; `updateTag`/`updateTags` clears both Next data cache **and** Redis L1/L2. Scoped tags: `scopedTag`, `tagTenant`, `tagDepartment`. Profiles: `telemetry`, `departments`, `reports`, `max`, `hours`, `minutes`.
- **Next 16 Cache Components**: `cacheComponents: true`, `'use cache'` directives, `cacheLife()` profiles; never call `cookies()`/`headers()` inside `'use cache'`.
- **Client cache**: TanStack Query with localStorage persistence (`ReactQueryProvider`). SWR is prohibited.
- **Live updates**: Supabase Realtime CDC via `useSupabaseRealtime`; no manual polling loops.
- **Server Actions**: authenticate → authorize → validate (Zod) → rate-limit → mutate → invalidate cache → redirect/return. Errors via `@repo/errors` (`AppError` hierarchy).

### Architectural boundaries (machine-enforced)

`tools/repo/policy-compiler.cjs` is the SSoT. Rules:

| Source           | Forbidden target                         | Rationale                           |
| ---------------- | ---------------------------------------- | ----------------------------------- |
| `apps/*`         | `packages/database`                      | go through `@repo/supabase`         |
| `packages/ui`    | `packages/database`, `packages/supabase` | UI is pure presentation             |
| `packages/theme` | `packages/ui`                            | theme consumed by UI, never reverse |
| `packages/*`     | `apps/*`                                 | no dependency inversion             |
| `tools/*`        | `apps/*`, `packages/supabase`            | build-time only                     |

Zero circular deps (`pnpm cycles`), zero dead code (`pnpm knip`). Additional audits: `audit:drift` (contract↔DB), `audit:hooks` (SSR guards, no SWR), `audit:tailwind` (utility budget/purge).

## Key Directories

| Path             | Purpose                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/portal/`   | Next.js 16 app: `app/` routes, `components/`, `server/` (proxy), `lib/` (server-cache), `hooks/`, `actions/`, `features/`     |
| `packages/`      | Shared `@repo/*` libraries; SQL migrations in `packages/database/migrations/` (`packages/supabase/migrations` symlinks to it) |
| `libs/features/` | Domain features: `auth`, `departments`, `hub` (each: `ui/`, `data-access/`, `utils/`)                                         |
| `libs/shared/`   | Cross-cutting: `hooks/`, `data-access/`, `utils/`                                                                             |
| `tools/`         | Build-time only: `repo/` (policy compiler, codebase maps), `audits/`, `scripts/`, `zero-drift-watchdog/`                      |
| `scripts/`       | Local dev/deploy/seed utilities (`dev-system-reimagined.sh`, `sync-assets-smart.cjs`, `patch-glass-css.mjs`, `seeds/`)        |
| `e2e/`           | Playwright specs + `visual/__snapshots__/`                                                                                    |
| `docs/agents/`   | Deep reference: `architecture.md`, `commands.md`, `invariants.md`, `patterns.md`, `testing.md`                                |
| `.agents/`       | Canonical rules (23), skills (6), agents (16), hooks, memory base                                                             |

## Development Commands

Run from `Arch-System/` unless noted. Root `Makefile` mirrors the important ones.

```bash
pnpm dev                # scripts/dev-system-reimagined.sh (asset sync, Supabase checks, portal on 0.0.0.0:3000)
pnpm dev:quick          # headless portal only
pnpm build              # sync-assets-smart.cjs → patch-glass-css.mjs → turbo run build
pnpm type-check         # turbo type-check --concurrency=2
pnpm lint               # turbo run lint (Biome per package)
pnpm test               # turbo run test
pnpm test:e2e           # Playwright (auto-starts portal unless BASE_URL is set)
pnpm agent:verify       # tools/scripts/agent-verify.sh — 15 sequential steps, fails fast
```

### Targeted commands

```bash
pnpm --filter portal test -- --testPathPatterns="CommandBar"   # single portal test file
pnpm --filter portal type-check
pnpm --filter @repo/database test                             # migration rollback-safety + offline-mutation security (node, not jest)
pnpm turbo:affected:type-check                                # only packages changed since HEAD~1
pnpm turbo:affected:test                                      # same filter; swap suffix for :lint / :build
pnpm audit:compliance                                         # full static invariant sweep
pnpm policy:check       # boundary rules + security checks
pnpm audit:drift        # @repo/contract Zod schemas vs DB/API surface
pnpm cycles             # dependency-cruiser no-circular
pnpm deps:lint && pnpm knip
```

### Policies, audits, and drift

```bash
pnpm policy:gen         # regenerate tools/repo/policy/* and eslint boundaries
pnpm lint:migrations    # Squawk + new-table RLS check on changed migrations
```

## Code Conventions & Common Patterns

### Code quality rules (10 rules, enforced in CI)

1. **No magic numbers or strings** — extract thresholds, timeouts, keys to `UPPER_SNAKE_CASE` constants; only `-1`, `0`, `1` exempt inline.
2. **Max 2 positional params** — 3+ inputs or any boolean flag becomes one typed options object.
3. **Rule of Three** — duplicate twice; extract a shared helper only on the third identical occurrence.
4. **Guard clauses** — validate at the top and return early; nesting depth ≤ 2; never `else` after a branch that returns or throws.
5. **Discriminated unions** — model multi-stage state as a tagged union, never as parallel booleans.
6. **Banned identifiers** — `data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr`. Append units (`timeoutMs`, `maxWeightTons`) and prefix booleans (`is`/`has`/`can`/`should`/`did`/`will`).
7. **Immutable params** — type inputs `readonly`, return new references (`.map`/`.filter`/spread); never `.push` or reassign into an argument.
8. **Lookup maps** — a typed `Record<K, V>` instead of `if/else if` ladders or verbose `switch`.
9. **One level of abstraction** — cyclomatic complexity ≤ 8, ~50 lines per function; orchestrate or implement, never both.
10. **Never swallow errors** — every `catch` returns a typed fallback or rethrows with operation, entity IDs, and `{ cause: error }`.

### Formatting and linting

- **Biome** (`biome.json`) is primary linter/formatter: 2-space indent, 100 columns, single quotes in TS/JS, double quotes in JSX, semicolons required, ES5 trailing commas, consistent utility class ordering (`nursery/useSortedClasses` at `"level": "error"` with `"fix": "safe"`).
- **Biome's rule set is deliberately relaxed** (`noExplicitAny`, `noUnusedVariables`, `noImgElement`, most `a11y` rules are `off`). Absence of a lint error is **not** permission to write `any`, skip `alt`, or add an `<img>`.
- **Prettier** (`prettier.config.mjs`) owns `*.md`, `*.css`, `*.scss`, `*.yaml`, `*.yml`.
- **Stylelint** (`stylelint.config.mjs`) owns CSS/SCSS. **markdownlint** owns Markdown. **cspell** owns spelling. **syncpack** owns `package.json` version alignment. **knip** owns dead code.
- ESLint is not wired into Arch-System — Biome is the enforced linter. Two agent rules are runnable from root via `tools/agent-lint/`: `pnpm lint:agent-rules` (changed TS files), `pnpm lint:agent-rules:all` (full audit of `apps/`, `packages/`, `libs/`). Not part of `agent:verify`.

### Naming

- Components: PascalCase (`GlassCard.tsx`, `CommandBar.tsx`).
- Hooks: `useXxx.ts` (`usePitConnectivity.ts`, `useSupabaseRealtime.ts`).
- Schemas: kebab-case + `.schema.ts` (`access-control.schema.ts`). Types: `.types.ts`. Utilities: kebab-case (`cache-utils.ts`).
- Migrations: zero-padded 3-digit prefix + snake_case (`163_shift_closeout_rpc.sql`).
- Tests: co-located `*.test.ts(x)` (Jest); `*.spec.ts` (Playwright).

### Error handling

All domain/runtime errors extend `AppError` from `@repo/errors`: `ValidationError` (400), `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `RateLimitError` (429), `DatabaseError` (500), `APIError`/`NetworkError`/`FetchTimeoutError` (502/504). Use `isAppError(err)` at boundaries.

### Server Action template

`'use server'` files in `actions.ts` / `actions/` modules. Required order: **authenticate → authorize → validate (Zod) → rate-limit → mutate → invalidate cache → `redirect()`**. Never call `redirect()` before cache invalidation — `redirect()` throws a control-flow exception.

### Async and data-fetching patterns

- Parallelize independent queries (`Promise.allSettled` / `Promise.all`); never sequential `await` on independent calls.
- Wrap shared per-request lookups in `React.cache()`.
- Stream unresolved promises from Server Components into `<Suspense>` and unwrap with React 19 `use(promise)`.
- Never call `cookies()`, `headers()`, or `searchParams` inside a `'use cache'` scope.
- Client hooks must be SSR-safe: guard `window`/`document`/`localStorage` access; clean up subscriptions, listeners, timers.

### Dependency injection

Runtime clients use factory helpers: `createServerSupabaseClient()` (`@repo/supabase/server`), `createBrowserSupabaseClient()` (`@repo/supabase/client`), `createKyselyClient()` (`@repo/supabase/kysely`), `getRedisClient()` / `cacheGetOrSet()` (`@repo/redis`), `RateLimiter` (`@repo/rate-limiter` with `IStore` and `IStrategy`).

### State management

1. **Server state** — React Server Components + TanStack Query for polling/refetch.
2. **Ephemeral client state** — Zustand 5 stores (`useNavigationState.ts`, `useOfflineQueue.ts`).
3. **Form state** — React Hook Form + `@hookform/resolvers/zod`, with `arch_*_draft_*` localStorage persistence.
4. **Multi-step machines** — XState 5 actors (`orchestrator.machine.ts`).

### Hard invariants

- **Light mode only**: canvas `#f3f4f6`; semantic OKLCH tokens from `@repo/theme/src/tokens/`. No `dark:` variants or raw hex/rgb.
- **Glass surfaces**: `@repo/ui/GlassCard` (`variant="default" | "window" | "spotlight" | "glowborder" | "liquid"`).
- **Tailwind utility composition**: ≤16 utilities per className (target ≤12); extract repeated chains (≥10 utilities, 3+ uses) into component, CVA variant, `cn()` constant, or theme class. `@apply`/`@layer components` only in `packages/theme` and `packages/ui` globals.
- **Images**: `next/image` with explicit `width`/`height` or `fill` + sized parent, descriptive `alt`. Raw `<img>` only in root error boundaries.
- **Boundaries & imports**: see layering table; import via canonical exports (`@repo/ui/GlassCard`), never `@repo/ui/src/...`.
- **Strict TypeScript**: no `any`, no `@ts-ignore`.
- **Immutable migrations & contract parity**: never rename/renumber applied migrations; every table/column needs a Zod schema in `packages/contract/src/schemas/`.
- **Commits**: Conventional Commits (`config/tools/commitlint.config.mjs`); never print/commit `.env*`; append ISO-8601 entries to modified packages' `AGENT_TRACER.md`.

## Important Files

| File                                       | Role                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `AGENTS.md` / `CLAUDE.md`                  | Root guide (CLAUDE.md symlinks to AGENTS.md)                                                       |
| `apps/portal/proxy.ts` → `server/proxy.ts` | Next 16 request proxy (CSP + nonce) → auth refresh, RBAC, route gating                             |
| `apps/portal/app/layout.tsx`               | Root layout (`ArchThemeProvider` → `ClientProviders` → `ReactQueryProvider` → `AnimationProvider`) |
| `apps/portal/lib/server-cache.ts`          | Server cache profiles, scoped tags, dual-tier Next + Redis L1/L2 invalidation                      |
| `apps/portal/next.config.mjs`              | `cacheComponents: true`, `turbopack.root`, `outputFileTracingRoot`, `cacheLife`, React 19 taint    |
| `apps/portal/setupTests.ts`                | Global Jest mocks (`next/cache`, `@repo/redis`, `packages/redis`, `@repo/agents`, browser globals) |
| `packages/contract/src/index.ts`           | Canonical Zod schema + type exports (`src/schemas/*.schema.ts`)                                    |
| `packages/database/migrations/`            | Canonical SQL migrations (`NNN_description.sql`)                                                   |
| `packages/errors/src/index.ts`             | `AppError` hierarchy and type guards                                                               |
| `packages/theme/src/tokens/index.ts`       | OKLCH design-token SSoT                                                                            |
| `packages/ui/src/components/GlassCard.tsx` | Primary light-mode glass surface component                                                         |
| `packages/typescript-config/base.json`     | Strict TS base (`strict`, `noUncheckedIndexedAccess`, `NodeNext`)                                  |
| `tools/repo/policy-compiler.cjs`           | Boundary/policy SSoT compiler (`pnpm policy:gen` / `policy:check`)                                 |
| `tools/scripts/agent-verify.sh`            | 15-step completion gate (`pnpm agent:verify`)                                                      |
| `e2e/playwright.config.ts`                 | Playwright E2E config (`setup`, `chromium`, `mobile-chrome`, `tablet-chrome`)                      |
| `docs/agents/`                             | Deep reference: `architecture.md`, `commands.md`, `invariants.md`, `patterns.md`, `testing.md`     |
| `.agents/GUIDE.md`                         | Canonical agent operations guide                                                                   |

## Runtime/Tooling Preferences

- **Node.js**: `engines` require `>=24`; `.node-version` and `.nvmrc` pin major `24` (`volta.node: "24.x"`).
- **Package manager**: **pnpm only** (`pnpm@9.15.9` pinned via `packageManager`). Do not use npm, yarn, or bun. Catalogs in `pnpm-workspace.yaml` (`catalog:` for shared deps, `catalogs.react19` for React 19).
- **Task runner**: Turborepo 2.x (`turbo.json`). `build` depends on `^build` + `codegen`.
- **Toolchain resolution**: `node` is `/usr/bin/node` (v26.8.1); `pnpm` resolves through `~/.local/share/mise/shims/pnpm` (9.15.9). If a non-login shell lacks `pnpm`, prepend:
  ```bash
  export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH"
  ```
- **Root install is blocked on purpose** — `pnpm install` at `/home/tim/Fork` exits 1 via `preinstall` hook. Install inside `Arch-System/`.
- **Turbopack** is the bundler for both dev and prod (webpack unavailable due to `node:async_hooks` in inngest). `output: standalone` only when not on Vercel.
- **Env files**: `Arch-System/.env` (template at `Arch-System/.env.example`), `Arch-System/apps/portal/.env` (template at `apps/portal/env/.env.example`), `Arch-System/.env.tools`. Server-side keys (`SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, etc.) must never reach the client.
- **MCP registration**: `.mcp.json` at root registers 11 stdio servers + 4 AgentsRoom HTTP servers. `Arch-System/.mcp.json` has 18.
- **Target cloud-hosted Supabase exclusively** — no local Supabase container stack. Local Redis with UI runs autonomously on `:5540`.

## Testing & QA

### Frameworks

- **Jest 30 + `@swc/jest`** — all packages and portal. Portal: `jsdom` environment; packages: `node` environment.
- **@testing-library/jest-dom** — DOM assertion matchers (portal `setupTests.ts`).
- **Playwright** (`@playwright/test` ^1.63.0) — E2E tests under `e2e/`.
- **Storybook test-runner** (`@storybook/test-runner`) — a11y tests via `test:a11y`.
- **Jest integration config** — separate `jest.integration.config.cjs` for real-Redis integration tests (gated by `REDIS_INTEGRATION=1`).
- **@repo/database tests** are Node `.mjs` scripts, not Jest.

### Test file locations and naming

- **Unit tests**: co-located, `*.test.ts` or `*.test.tsx`.
  - `apps/portal/`: `lib/**/*.test.ts`, `app/**/*.test.tsx`, `components/**/*.test.tsx`, `features/**/*.test.tsx`, `hooks/**/*.test.ts`, `server/**/*.test.ts`, `actions/**/*.test.ts`.
  - `packages/*`: `src/**/*.test.ts`, `src/__tests__/*.test.ts`, `tests/*.test.mjs` (database).
  - `libs/*`: `src/**/*.test.tsx` / `*.test.ts`.
- **E2E tests**: `e2e/**/*.spec.ts` (Playwright), plus `e2e/visual/` for visual regression snapshots and `e2e/load/` for load scripts.
- **Integration tests**: `apps/portal/test/integration/*.test.ts`, `packages/redis/tests/integration/*.test.ts`.

### Running tests

```bash
pnpm test                                    # turbo run test (all workspaces)
pnpm --filter portal test                    # jest --passWithNoTests --runInBand
pnpm --filter portal test:integration        # real-Redis integration tests
pnpm test:e2e                                # Playwright (auto-starts portal)
pnpm test:e2e:visual                         # visual regression only
pnpm test:coverage                           # coverage report
pnpm turbo:affected:test                     # only changed packages
```

### Coverage expectations

Portal `jest.config.cjs` has `coverageThreshold` set to measured baseline (statements ~40, branches ~27, functions ~28, lines ~41). Ratchet upward as tests are added. Large untested surface: `app/(departments)/**` and `features/**` UI trees.

### Test patterns

- **Setup file** (`apps/portal/setupTests.ts`): imports `@testing-library/jest-dom`, polyfills `TextEncoder`/`TextDecoder`, `Request`/`Response`, mocks `next/cache`, `@repo/redis`, `@repo/agents`, `window.matchMedia`/`IntersectionObserver`. Overrides `DISABLE_RATE_LIMIT`.
- **Mocking**: `jest.mock` at module level; global mocks for redis, next/cache, agents to avoid DB/redis connections. Mock at the **network-client boundary** only, never internal logic.
- **Module path mapping**: extensive `moduleNameMapper` in portal jest config mapping `@repo/*` to source `.ts`/`.tsx` entrypoints (no barrel builds).
- **BDD naming**: test files named after subject; `describe`/`it` blocks.

### E2E setup (Playwright)

- Config: `e2e/playwright.config.ts`, `testDir: '.'`, fully parallel, CI retries 2, timeout 60s.
- **Projects**: `setup` (global.setup.ts auth) → `chromium`, `mobile-chrome` (Pixel 5), `tablet-chrome` (Galaxy Tab S4) — all depend on setup; storageState `e2e/.auth/user.json`.
- **Web server**: auto-starts `pnpm --filter portal dev` on `:3000` unless `BASE_URL` set.
- **Visual regression**: `e2e/visual/*.spec.ts` with snapshot dir `./visual/__snapshots__`, `toHaveScreenshot` maxDiffPixelRatio 0.02.
- **Specs**: navigation, login, accessibility, api-mocking, authenticated-flows, data-entry, data-entry-validation, error-states, executive-dashboard, overview, permissions-roles, pwa-offline, responsiveness, session-management, web-vitals, measure, department-navigation, autonomous-login, open-login, plus `control-room/`, `access-card-actions/`, `visual/` subdirs.

### Completion gate

`pnpm agent:verify` runs 15 sequential steps: type-check → lint → test → policy:check → audit:drift → skill-spector → mcp:verify → token:budget-check → agent-rule-drift → codebase-map parity → audit:hooks → deps:lint → cycles → audit:tailwind → knip. Husky `pre-push` runs the full gate.
