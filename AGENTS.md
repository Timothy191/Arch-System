# Repository Guidelines

## Project Overview

`/home/tim/Fork/Arch-System` is **Arch-System** (a.k.a. Plantcor / Arch OS) — a production-grade **industrial mining-operations portal**. A multi-departmental, authenticated web app serving department dashboards (drilling, production, access control, engineering, control room, system overview, DB admin) for a real mining operation, with SCADA telemetry integration.

Built on **Next.js 16 App Router + React 19**, pnpm 9.15.9 + Turborepo 2.x, deployed to Vercel, backed by cloud Supabase (Postgres + Realtime CDC) and a local Redis instance. Node.js ≥24 required.

---

## Architecture & Data Flow

### Workspace topology

```
Arch-System/
├── apps/portal/          # Next.js 16 app (sole app, package name `portal`)
├── packages/*            # Shared @repo/* libraries (theme, ui, contract, supabase, database, redis, errors, logger, rate-limiter, agents, eval, utils, typescript-config)
├── libs/                 # Feature & shared libs (auth, departments, hub × ui/data-access/utils; shared × hooks/data-access/utils)
├── tools/                # Build-time only: policy compiler, audits, scripts, zero-drift-watchdog
├── scripts/              # Dev/deploy/seed utilities
├── e2e/                  # Playwright E2E specs
├── docs/                 # Hand-authored engineering docs
└── config/               # knip, syncpack, turbo config
```

### Layering rules (machine-enforced via `tools/repo/policy-compiler.cjs`)

|Source|Forbidden target|Why|
|---|---|---|
|`apps/*`|`packages/database`|Route through `@repo/supabase` instead|
|`packages/ui`|`packages/database`, `packages/supabase`|UI is pure presentation; data lives in `libs/features/*/data-access`|
|`packages/theme`|`packages/ui`|Theme is consumed by UI, never the reverse|
|`packages/*`, `tools/*`|`apps/*`|No dependency inversion|
|`tools/*`|`packages/supabase`|Tools are build-time, not runtime|

Additional invariants: zero circular deps (`pnpm cycles`), zero dead code (`pnpm knip`), `server-only` guard on server packages, env validated via Zod/t3-env.

### Request / data flow

```
browser → proxy.ts (Next 16, CSP + x-nonce)
  → server/proxy.ts (Supabase auth claims, employee role/dept, Redis-cached RBAC)
  → app/layout.tsx (ArchThemeProvider → ClientProviders → ReactQueryProvider → AnimationProvider)
  → route groups: (auth) | (departments)/[department] | admin | hub | overview | docs | api
```

- **RSC-first**: Server Components by default; interactivity in leaf `'use client'` components.
- **Dual-tier cache**: Next.js Data Cache (`cachedRSC`) + Redis L1/L2 with scoped tags (`scopedTag`, `tagTenant`, `tagDepartment`).
- **Server Actions**: authenticate → authorize → validate (Zod `@repo/contract`) → rate-limit → mutate → invalidate cache (`updateTagInAction`) → redirect/return.
- **Live updates**: Supabase Realtime CDC via `useSupabaseRealtime` — no manual polling.
- **Client cache**: TanStack Query with `localStorage` persistence. SWR is prohibited.

### Key shared modules

|Module|Role|
|---|---|
|`@repo/contract`|Canonical Zod schemas + derived TS types — single source of truth for all input validation across frontend/backend |
|`@repo/supabase`|Typed DB access (Kysely + Supabase SSR), auth, middleware/proxy clients — the data access boundary |
|`@repo/database`|SQL migration SSoT + generated types |
|`@repo/redis`|Multi-tier caching (L1/L2), sessions with privilege revocation, distributed locks, streams, vector search, analytics |
|`@repo/errors`|`AppError` hierarchy (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `DatabaseError`, etc.) |
|`@repo/theme`|OKLCH design tokens, Style Dictionary codegen, Tailwind preset, CSS vars |
|`@repo/ui`|Shared Radix/shadcn primitives — `GlassCard`, `DepartmentLayout`, `KPI`, `Clock`, `PageHeader`, data-table, telemetry-chart |
|`@repo/logger`|Structured Pino logging (server/browser/next) |
|`@repo/agents`|AI coordination engine (coordinator, fleet-runner, specialists, swarm, memory, token-budget) |
|`libs/shared/hooks`|Client React hooks: `useSupabaseRealtime`, `useRedisCache`, `useOfflineQueue`, `useDebounce`, `useWorkflowStatus` |
|`libs/features/departments/ui`|Domain UI for control-room & engineering (shift closeout, fleet KPI, breakdowns) |

---

## Key Directories

|Path|Purpose|
|---|---|
|`apps/portal/`|Next.js 16 app: `app/` routes, `components/`, `server/` (proxy), `lib/` (`server-cache.ts`), `hooks/`, `actions/`, `features/` |
|`apps/portal/app/`|App Router routes: `(auth)`, `(departments)/[department]`, `admin`, `hub`, `overview`, `docs`, `api/` (integrations, cron, telemetry, health, export) |
|`packages/`|Shared `@repo/*` libraries; SQL migrations in `packages/database/migrations/` (`packages/supabase/migrations` symlinks to it) |
|`libs/features/`|Domain features: `auth`, `departments`, `hub` (each: `ui/`, `data-access/`, `utils/`) |
|`libs/shared/`|Cross-cutting: `hooks/`, `data-access/`, `utils/` |
|`tools/`|Build-time: `repo/` (policy compiler, codebase maps), `audits/` (30+ static audit scripts), `scripts/` (30+ helpers), `zero-drift-watchdog/`, `swarms-orchestrator/` |
|`scripts/`|Dev/deploy/seed utilities (`dev.sh`, `deploy.sh`, `seeds/`) |
|`e2e/`|Playwright specs (40+): control-room, visual, load, accessibility |
|`docs/`|Hand-authored docs: `agent-cookbooks/`, `control-room/`, `operations/`, `plans/`, `agents/`, `wiki/` |
|`documentation/`|Generated audit reports; `codebase-maps/` holds auto-generated dependency maps |

---

## Development Commands

Run from `Arch-System/` unless noted. Root `Makefile` mirrors the important ones (`make verify`, `make dev-portal`, `make build-all`).

### Build / run

```bash
pnpm dev                # scripts/dev-system-reimagined.sh (asset sync, Supabase checks, portal on 0.0.0.0:3000)
pnpm dev:quick          # headless portal only
pnpm dev:turbo          # turbo dev filtered to portal
pnpm build              # sync-assets-smart.cjs → patch-glass-css.mjs → turbo run build
pnpm type-check         # turbo type-check --concurrency=2
pnpm lint               # turbo run lint (Biome per package)
pnpm test               # turbo run test
```

### Completion gate

```bash
pnpm agent:verify       # tools/scripts/agent-verify.sh — 15 sequential steps, fails fast
```

Steps: `type-check` → `lint` → `test` → `policy:check` → `audit:drift` → skill-spector → `mcp:verify` → `token:budget-check` → agent-rule-drift → codebase-map parity → `audit:hooks` → `deps:lint` → `cycles` → `audit:tailwind` → `knip`.

### Targeted commands

```bash
pnpm --filter portal test -- --testPathPatterns="CommandBar"   # single portal test file
pnpm --filter portal type-check
pnpm --filter @repo/database test                             # migration rollback-safety + offline-mutation security (node, not jest)
pnpm --filter @repo/database db:types                         # regenerate Supabase types
pnpm --filter @repo/theme codegen                             # after editing tokens.json (output committed)
pnpm --filter @repo/ui storybook                              # :6006 — required for test:a11y
pnpm test:e2e                                                 # Playwright (auto-starts portal unless BASE_URL set)
pnpm test:a11y                                                # Storybook + axe
pnpm audit:compliance                                         # full static invariant sweep
pnpm policy:check                                             # boundary rules + security checks
pnpm policy:gen                                               # regenerate policy files + eslint boundaries
```

### Policies & audits

```bash
pnpm audit:drift         # @repo/contract Zod schemas vs DB/API surface
pnpm lint:migrations     # Squawk + new-table RLS check on changed migrations
pnpm cycles              # dependency-cruiser no-circular over apps/packages/libs
pnpm deps:lint && pnpm knip
pnpm quality             # release-grade suite (lint → type-check → test → … → verify:gates)
```

### Standalone MCP servers (run inside each directory)

```bash
cd skills-mcp && pnpm run build && pnpm test
cd memory-gateway-mcp && pnpm run build && pnpm test
cd slim-tooling-mcp && pnpm run build && pnpm test
```

---

## Code Conventions & Common Patterns

### Formatting & linting

- **Biome** (`biome.json`): 2-space indent, 100 columns, single quotes in TS/JS, double quotes in JSX, semicolons required, ES5 trailing commas, consistent utility class ordering (`nursery/useSortedClasses` at `"level": "error"`).
- **Prettier** (`prettier.config.mjs`): owns `*.md`, `*.css`, `*.scss`, `*.yaml`, `*.yml`.
- **Stylelint** (`stylelint.config.mjs`): owns CSS/SCSS.
- **ESLint** is not wired into Arch-System — Biome is the enforced linter. Root `tools/agent-lint/` provides `pnpm lint:agent-rules` (max-params ≤2, no-magic-numbers) for changed TS files.
- `.qoder/settings.json` PostToolUse hook runs Biome/Prettier on every `Write|Edit`.

### Code quality rules (10 rules, enforced)

1. **No magic numbers/strings** — extract to `UPPER_SNAKE_CASE` constants; only `-1`, `0`, `1` exempt.
2. **Max 2 positional params** — 3+ inputs or any boolean flag becomes one typed options object.
3. **Rule of Three** — duplicate twice; extract shared helper only on third identical occurrence.
4. **Guard clauses** — validate at top, return early; nesting depth ≤ 2; never `else` after a branch that returns/throws.
5. **Discriminated unions** — model multi-stage state as tagged union, never parallel booleans.
6. **Banned identifiers** — `data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr`. Append units (`timeoutMs`, `maxWeightTons`), prefix booleans (`is`/`has`/`can`/`should`/`did`/`will`).
7. **Immutable params** — type inputs `readonly`, return new references (`.map`/`.filter`/spread); never `.push` or reassign into an argument.
8. **Lookup maps** — typed `Record<K, V>` instead of `if/else if` ladders or verbose `switch`.
9. **One level of abstraction** — cyclomatic complexity ≤ 8, ~50 lines per function; orchestrate or implement, never both.
10. **Never swallow errors** — every `catch` returns a typed fallback or rethrows with operation, entity IDs, and `{ cause: error }`.

### Naming

- Components: PascalCase (`GlassCard.tsx`, `CommandBar.tsx`).
- Hooks: `useXxx.ts` (`usePitConnectivity.ts`, `useSupabaseRealtime.ts`).
- Schemas: kebab-case + `.schema.ts` (`access-control.schema.ts`); types: `.types.ts`; utilities: kebab-case (`cache-utils.ts`).
- Migrations: zero-padded 3-digit prefix + snake_case (`163_shift_closeout_rpc.sql`).
- Tests: co-located `*.test.ts(x)` (Jest); `*.spec.ts` (Playwright).

### Error handling

All domain/runtime errors extend `AppError` from `@repo/errors`. Use `isAppError(err)` at boundaries to extract status codes safely. Never leak raw DB errors or service-role keys to client components.

### Server Action template

```typescript
'use server';

export async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
  const parsed = shiftCloseoutSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
  const principal = await getAuthenticatedEmployee();
  if (!principal) throw new AuthError('Unauthorized');
  // ... rate limit, RPC/query, then invalidate before redirect:
  await updateTagInAction(`dept:${deptId}:shift_closeout`);
  return { success: true, data };
}
```

Never call `redirect()` before cache invalidation — `redirect()` throws a control-flow exception.

### Async & data-fetching patterns

- Parallelize independent queries (`Promise.allSettled` / `Promise.all`); never sequential `await` on independent calls.
- Wrap shared per-request lookups in `React.cache()` so layout and page share one round-trip.
- Stream unresolved promises from Server Components into `<Suspense>` and unwrap with React 19 `use(promise)`.
- Never call `cookies()`, `headers()`, or `searchParams` inside a `'use cache'` scope; never use `'use cache'` without a named `cacheLife()` profile.
- Client hooks must be SSR-safe: guard `window`/`document`/`localStorage` access; always clean up subscriptions, listeners, timers.

### Dependency injection / service factories

Runtime clients use factory helpers: `createServerSupabaseClient()` (`@repo/supabase/server`), `createBrowserSupabaseClient()` (`@repo/supabase/client`), `createKyselyClient()` (`@repo/supabase/kysely`), `getRedisClient()` / `cacheGetOrSet()` (`@repo/redis`), `RateLimiter` (`@repo/rate-limiter` with `IStore` + `IStrategy`).

### State management

1. **Server state** — React Server Components, plus TanStack Query for polling/refetch.
2. **Ephemeral client state** — Zustand 5 stores (`useNavigationState.ts`, `useOfflineQueue.ts`).
3. **Form state** — React Hook Form + `@hookform/resolvers/zod`, with `arch_*_draft_*` localStorage persistence.
4. **Multi-step machines** — XState 5 actors (`orchestrator.machine.ts`).

### Hard invariants (enforced by audits)

- **Light mode only**: canvas `#f3f4f6`; semantic OKLCH tokens from `@repo/theme/src/tokens/`. No `dark:` variants or raw hex/rgb.
- **Glass surfaces**: `@repo/ui/GlassCard` (`variant="default" | "window" | "spotlight" | "glowborder" | "liquid"`).
- **Tailwind utility composition**: ≤16 utilities per className (target ≤12); extract repeated chains (≥10 utilities, 3+ uses) into a component, CVA variant, `cn()` constant, or theme class.
- **Images**: `next/image` with explicit `width`/`height` or `fill` + sized parent, and descriptive `alt` (raw `<img>` only in root error boundaries).
- **Boundaries & imports**: see layering table; import via canonical exports (`@repo/ui/GlassCard`), never `@repo/ui/src/...`.
- **Strict TypeScript**: no `any`, no `@ts-ignore`.
- **Immutable migrations & contract parity**: never rename/renumber applied migrations; every table/column needs a Zod schema in `packages/contract/src/schemas/`.
- **Commits**: Conventional Commits (`config/tools/commitlint.config.mjs`); never print/commit `.env*`; append ISO-8601 entries to modified packages' `AGENT_TRACER.md`.

---

## Important Files

|File|Role|
|---|---|
|`AGENTS.md` / `Arch-System/AGENTS.md`|Root federated guide / canonical Arch-System guide (`CLAUDE.md` symlinks to each) |
|`apps/portal/proxy.ts` → `server/proxy.ts`|Next 16 request proxy (CSP + nonce) → auth refresh, RBAC, `DEPARTMENT_ROUTES` / `RESTRICTED_ROUTES` |
|`apps/portal/app/layout.tsx`|Root layout (`ArchThemeProvider` → `ClientProviders` → `ReactQueryProvider` → `AnimationProvider`) |
|`apps/portal/lib/server-cache.ts`|Server cache profiles, scoped tags, dual-tier Next + Redis L1/L2 invalidation |
|`apps/portal/next.config.mjs`|`cacheComponents: true`, `turbopack.root`, `outputFileTracingRoot`, `cacheLife`, React 19 taint |
|`apps/portal/setupTests.ts`|Global Jest mocks (`next/cache`, `@repo/redis`, `packages/redis`, `@repo/agents`, browser globals) |
|`packages/contract/src/index.ts`|Canonical Zod schema + type exports (`src/schemas/*.schema.ts`) |
|`packages/database/migrations/`|Canonical SQL migrations (`NNN_description.sql`) |
|`packages/errors/src/index.ts`|`AppError` hierarchy and type guards |
|`packages/theme/src/tokens/index.ts`|OKLCH design-token SSoT |
|`packages/ui/src/components/GlassCard.tsx`|Primary light-mode glass surface component |
|`packages/typescript-config/base.json`|Strict TS base (`strict`, `noUncheckedIndexedAccess`, `NodeNext`) |
|`tools/repo/policy-compiler.cjs`|Boundary/policy SSoT compiler (`pnpm policy:gen` / `policy:check`) |
|`tools/scripts/agent-verify.sh`|15-step completion gate (`pnpm agent:verify`) |
|`e2e/playwright.config.ts`|Playwright E2E config (`setup`, `chromium`, `mobile-chrome`, `tablet-chrome`) |

---

## Runtime/Tooling Preferences

- **Node.js**: `engines` require `>=24`; `.node-version` and `.nvmrc` pin major `24`. Node 26.8.1 also present (supplies pnpm).
- **Package manager**: **pnpm only** (9.15.9 pinned via `packageManager`). Catalogs live in `pnpm-workspace.yaml` (`catalog:` for shared deps, `catalogs.react19` for React 19). Do not use npm, yarn, or bun.
- **Task runner**: Turborepo 2.x (`turbo.json`). `build` depends on `^build` + `codegen`.
- **Toolchain resolution**: `node` is `/usr/bin/node` (v26.8.1); `pnpm` resolves through mise shim (9.15.9). If a non-login shell lacks `pnpm`, prepend mise installs:
  ```bash
  export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH"
  ```
- **Root install is blocked on purpose** — `pnpm install` at `/home/tim/Fork` exits 1 via `preinstall` hook. Install inside `Arch-System/` (or each standalone MCP server).
- **Env files**: `Arch-System/.env` (create from `.env.example`), `Arch-System/apps/portal/.env` (template at `apps/portal/env/.env.example`), `Arch-System/.env.tools`. Server-side Supabase/DB keys must never reach the client.
- **MCP registration**: `.mcp.json` at root registers 11 stdio servers + 4 AgentsRoom HTTP servers; `Arch-System/.mcp.json` has 18. Standalone MCP servers (`skills-mcp`, `memory-gateway-mcp`, `slim-tooling-mcp`, `langgraph-mcp`) have own lockfiles — build/test from their own dirs.

---

## Testing & QA

### Unit / component

- **Jest 30 + `@swc/jest`**, co-located `*.test.ts(x)`. Portal: `apps/portal/jest.config.cjs` (`jsdom`, `setupFilesAfterEnv: ['<rootDir>/setupTests.ts']`, `@repo/*` mapped straight to `src/` so no package build needed). Packages and `libs/` use their own `jest.config.js` with `testEnvironment: 'node'`.
- Portal coverage thresholds: lines 40, branches 27, functions 28, statements 40.
- `@repo/database`'s `test` is **Node scripts, not Jest** (`migration-rollback-safety.mjs`, `offline-mutations-security.mjs`).
- `packages/ui` has **no Jest suite** — a11y coverage is Storybook only.
- `@repo/eval` runs pytest via Poetry/uv and **skips silently** if neither installed.

### E2E

- **Playwright** at `e2e/` (`playwright.config.ts`, `testDir: '.'`, `snapshotDir: './visual/__snapshots__'`).
- Projects: `setup` → `chromium`, `mobile-chrome`, `tablet-chrome`; auth state persisted to `e2e/.auth/user.json`.
- `pnpm test:e2e` auto-starts `pnpm --filter portal dev` on `:3000` unless `BASE_URL` is set; needs seeded local Supabase.
- Visual diffs allow `maxDiffPixelRatio: 0.02`. `pnpm test:e2e:visual` targets `theme.smoke` grep.

### Accessibility

- Storybook + axe: `packages/ui/.storybook/`; `pnpm test:a11y` runs `pnpm --filter @repo/ui test-storybook:a11y` (start `pnpm --filter @repo/ui storybook` on `:6006` first).
- Playwright a11y specs: `e2e/accessibility.spec.ts`, `e2e/visual/accessibility.spec.ts`.

### Test conventions

- BDD-style naming in shared packages: `describe('Given …')` / `it('When …, Then …')`; portal hooks use `should … when …`.
- Mock at the **network-client boundary** (Supabase / Redis / `next/cache` / server actions), never internal logic.
- The 15-step `pnpm agent:verify` gate is the completion criterion. Cheapest gate: `pnpm type-check` + `pnpm lint` + `pnpm policy:check` + `pnpm audit:drift`.
- `pnpm quality` is the release-grade suite.
- Redis integration: `REDIS_INTEGRATION=1 pnpm --filter @repo/redis test:integration` (and portal) in CI `redis-integration` job.
