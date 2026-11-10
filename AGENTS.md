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

| Source                  | Forbidden target                         | Why                                                                  |
| ----------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| `apps/*`                | `packages/database`                      | Route through `@repo/supabase` instead                               |
| `packages/ui`           | `packages/database`, `packages/supabase` | UI is pure presentation; data lives in `libs/features/*/data-access` |
| `packages/theme`        | `packages/ui`                            | Theme is consumed by UI, never the reverse                           |
| `packages/*`, `tools/*` | `apps/*`                                 | No dependency inversion                                              |
| `tools/*`               | `packages/supabase`                      | Tools are build-time, not runtime                                    |

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
- **Server Actions (Canonical 8-Step Security Sequence)**: 1. Authenticate (`getAuthenticatedEmployee`) → 2. Authorize (role + department/resource) → 3. Validate (`@repo/contract` Zod) → 4. Rate-limit (`RateLimiter`) → 5. Execute operation → 6. Record audit event (`logger.info`) → 7. Invalidate affected caches (`updateTagInAction`) → 8. Return typed result (before any `redirect()`).
- **Live updates**: Supabase Realtime CDC via `useSupabaseRealtime` — no manual polling.
- **Client cache**: TanStack Query with `localStorage` persistence. SWR is prohibited.

### Key shared modules

- `@repo/contract`: Canonical Zod schemas + derived TS types (SSoT for frontend/backend input validation).
- `@repo/supabase`: Typed DB access (Kysely + Supabase SSR), auth, middleware/proxy clients.
- `@repo/database`: SQL migration SSoT + generated types.
- `@repo/redis`: L1/L2 caching, sessions with privilege revocation, locks, streams, vector search, analytics.
- `@repo/errors`: `AppError` hierarchy (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `DatabaseError`).
- `@repo/theme`: OKLCH design tokens, Style Dictionary codegen, Tailwind preset, CSS vars.
- `@repo/ui`: Shared Radix/shadcn primitives (`GlassCard`, `DepartmentLayout`, `KPI`, `Clock`, `PageHeader`, data-table, telemetry-chart).
- `@repo/logger`: Structured Pino logging (server/browser/next).
- `@repo/agents`: AI coordination engine (coordinator, fleet-runner, specialists, swarm, memory, token-budget).
- `libs/shared/hooks`: `useSupabaseRealtime`, `useClientCache` (`useRedisCache`), `useOfflineQueue`, `useDebounce`, `useWorkflowStatus`.
- `libs/features/departments/ui`: Domain UI for control-room & engineering (shift closeout, fleet KPI, breakdowns).

---

## Key Directories

- `apps/portal/`: Next.js 16 App Router app (`app/`, `components/`, `server/`, `lib/`, `hooks/`, `features/`).
- `packages/`: Shared `@repo/*` packages (`theme`, `ui`, `contract`, `supabase`, `database`, `redis`, `errors`, `logger`, `rate-limiter`, `agents`).
- `libs/features/`: Domain features: `auth`, `departments`, `hub` (each with `ui/`, `data-access/`, `utils/`).
- `libs/shared/`: Cross-cutting: `hooks/`, `data-access/`, `utils/`.
- `tools/`: Build-time policy compiler, audits, helpers, zero-drift watchdog.
- `scripts/`: Dev/deploy/seed utilities (`dev.sh`, `deploy.sh`, `seeds/`).
- `e2e/`: Playwright E2E specs (control-room, visual, load, accessibility).
- `docs/`: Engineering docs, playbooks, operations, wiki.

---

## Development Commands

Run from `Arch-System/` unless noted. Root `Makefile` mirrors the important ones (`make verify` → `pnpm agent:verify`, `make dev-portal` → `pnpm dev:quick`, `make build-all` → `pnpm build`).

### Build / run

```bash
pnpm dev          # scripts/dev-system-reimagined.sh (asset sync, Supabase checks, portal :3000)
pnpm dev:quick    # headless portal only
pnpm dev:turbo    # turbo dev filtered to portal
pnpm build        # sync-assets-smart.cjs → patch-glass-css.mjs → turbo run build
pnpm type-check   # turbo type-check --concurrency=2
pnpm lint         # turbo run lint (Biome per package)
pnpm test         # turbo run test
```

### Completion gate

```bash
pnpm agent:verify       # tools/scripts/agent-verify.sh — 28-gate suite, fails fast
```

Gates (source of truth: `tools/scripts/agent-verify.sh`):
1–5: `type-check` → `lint` → `test` → `boundaries` → `audit:drift`
6–10: `skill-spector` → `mcp:verify` → `token:budget-check` → `agent-rules` → `codebase-map`
11–15: `audit:hooks` → `deps:lint` → `cycles` → `audit:tailwind` → `knip`
16–20: `auth-matrix` → `migrations` → `perf-load` → `e2e` → `supply-chain`
21–25: `resilience` → `rollback` → `a11y` → `evidence-integrity` → `tool-perms`
26–28: `hallucination-controls` → `reproducibility` → `code-intelligence`

### Targeted & policy commands

```bash
pnpm --filter portal test -- --testPathPatterns="CommandBar" # single portal test file
pnpm --filter portal type-check
pnpm --filter @repo/database test                            # migration rollback + offline-mutation security (node)
pnpm --filter @repo/database db:types                        # regenerate Supabase types
pnpm --filter @repo/theme codegen                            # after editing tokens.json (output committed)
pnpm --filter @repo/ui storybook                             # :6006 — required for test:a11y
pnpm test:e2e                                                # Playwright (auto-starts portal unless BASE_URL set)
pnpm test:a11y                                               # Storybook + axe
pnpm audit:compliance                                        # full static invariant sweep
pnpm policy:check                                            # boundary rules + security checks
pnpm ci:reindex                                              # rebuild CodeGraph index (parse + backfill ranges)
pnpm ci:snapshot                                             # record index baseline for drift gate
pnpm audit:code-intelligence                                 # gate 28 — substrate integrity (exit 0/1)
pnpm policy:gen                                              # regenerate policy files + eslint boundaries
pnpm audit:drift                                             # @repo/contract Zod schemas vs DB/API surface
pnpm lint:migrations                                         # Squawk + new-table RLS check on changed migrations
pnpm cycles                                                  # dependency-cruiser no-circular
pnpm deps:lint && pnpm knip
pnpm quality                                                 # release-grade suite
```

### Standalone MCP servers

`skills-mcp`, `memory-gateway-mcp`, `slim-tooling-mcp`: `cd <dir> && pnpm run build && pnpm test`.

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

### Agent rules (auto-apply)

Focused rule files under `.agents/rules/` (each self-describes via frontmatter): `react-19-patterns`, `nextjs-16-caching`, `postgres-rls-performance`, `css-modern-features`, `image-optimization`, `accessibility-wcag`, `nextjs-eslint-conventions`, `client-side-data-fetching` (TanStack Query; SWR prohibited), `data-fetching-patterns`, `rendering-environments-and-rsc`, `css-in-js` (prohibited; Tailwind + OKLCH, CSS Modules), `debugging`, `revalidation`, `isr-cache-components`, `internationalization` (single locale `en-US`), `json-ld` (`<` → `\u003c`).

### Error handling

All domain/runtime errors extend `AppError` from `@repo/errors`. Use `isAppError(err)` at boundaries to extract status codes safely. Never leak raw DB errors or service-role keys to client components.

### Server Action template (Canonical 8-Step Security Sequence)

```typescript
'use server';

export async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
  // 1. Authenticate the caller
  const principal = await getAuthenticatedEmployee();
  if (!principal) throw new AuthError('Unauthorized');
  // 2. Authorize the requested operation and resource
  if (!principal.accessibleDepartments.includes(rawInput.departmentId)) {
    throw new ForbiddenError('Insufficient department access');
  }
  // 3. Validate all untrusted input
  const parsed = shiftCloseoutSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
  // 4. Apply rate limits -> 5. Execute operation -> 6. Record audit event
  await rateLimiter.check('shift_closeout', principal.id);
  const result = await executeShiftCloseoutRpc(parsed.data);
  logger.info({
    event: 'shift_closeout_submitted',
    actorId: principal.id,
    deptId: parsed.data.departmentId,
  });
  // 7. Invalidate affected caches -> 8. Return a typed result (before any redirect)
  await updateTagInAction(`dept:${parsed.data.departmentId}:shift_closeout`);
  return { success: true, data: result };
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
- **Tailwind utility composition**: ≤20 utilities per className (target ≤12); extract repeated chains (≥10 utilities, 3+ uses) into a component, CVA variant, `cn()` constant, or theme class.
- **Images**: `next/image` with explicit `width`/`height` or `fill` + sized parent, and descriptive `alt` (raw `<img>` only in root error boundaries).
- **Boundaries & imports**: see layering table; import via canonical exports (`@repo/ui/GlassCard`), never `@repo/ui/src/...`.
- **Strict TypeScript**: no `any`, no `@ts-ignore`.
- **Immutable migrations & contract parity**: never rename/renumber applied migrations; every table/column needs a Zod schema in `packages/contract/src/schemas/`.
- **Commits**: Conventional Commits (`config/tools/commitlint.config.mjs`); never print/commit `.env*`; append ISO-8601 entries to root `AGENT_TRACER.md` (single consolidated ledger; never create per-package tracer files or non-canonical root tracer variants).

---

## Important Files

- `AGENTS.md`: Canonical guide (`CLAUDE.md` and `GEMINI.md` symlink to it).
- `.agents/GUIDE.md`: Unified agent operational guide — rules, hooks, skills index, and provider-redirect map.
- `.agents/SYSTEMS.md`: Systems + toolchain matrix (AST RAG, syntax-aware diffing, context bundling).
- `.agents/references/vercel-infrastructure.md`: Vercel Infrastructure & Fluid Compute reference — deployment, serverless timeouts, Fluid Compute debugging.
- `apps/portal/proxy.ts` → `server/proxy.ts`: Next 16 request proxy (CSP + nonce) → auth, RBAC, route rules.
- `apps/portal/app/layout.tsx`: Root layout (`ArchThemeProvider` → `ClientProviders` → `ReactQueryProvider` → `AnimationProvider`).
- `apps/portal/lib/server-cache.ts`: Server cache profiles, scoped tags, dual-tier invalidation.
- `apps/portal/next.config.mjs`: `cacheComponents: true`, `turbopack.root`, `outputFileTracingRoot`, `cacheLife`.
- `apps/portal/setupTests.ts`: Global Jest mocks (`next/cache`, `@repo/redis`, browser globals).
- `packages/contract/src/index.ts`: Canonical Zod schema + type exports (`src/schemas/*.schema.ts`).
- `packages/database/migrations/`: Canonical SQL migrations (`NNN_description.sql`).
- `packages/errors/src/index.ts`: `AppError` hierarchy and type guards.
- `packages/theme/src/tokens/index.ts`: OKLCH design-token SSoT.
- `packages/ui/src/components/GlassCard.tsx`: Primary light-mode glass surface component.
- `packages/typescript-config/base.json`: Strict TS base (`strict`, `noUncheckedIndexedAccess`, `NodeNext`).
- `tools/repo/policy-compiler.cjs`: Boundary/policy SSoT compiler (`pnpm policy:gen` / `policy:check`).
- `tools/scripts/agent-verify.sh`: 28-gate completion suite (`pnpm agent:verify`); gate 28 is the Code-Intelligence Substrate Integrity audit.
- `tools/audits/audit-code-intelligence-drift.cjs`: gate 28 — verifies the CodeGraph index is in sync with the source tree (entity/relation/file counts + `end_line` body-range ratios).
- `tools/scripts/ci-snapshot.cjs`: records the index baseline into `.agents/memory_base/index-snapshot.json`.
- `tools/scripts/ci-reindex.cjs`: rebuilds the index (`ts_parse_dir.cjs` → `backfill_ranges.py`).
- `e2e/playwright.config.ts`: Playwright E2E config (`setup`, `chromium`, `mobile-chrome`, `tablet-chrome`).

---

## Runtime/Tooling Preferences

- **Node.js & pnpm**: Node `>=24` pinned via `.node-version`/`.nvmrc`. **pnpm 9.15.9 only** (`packageManager`). Shared deps catalog in `pnpm-workspace.yaml`. Turborepo 2.x runner.
- **Toolchain Mandate**: Prefer structural AST search (`ast-grep`/`codemap`), syntax-aware diffs (`difftastic`), and context bundling (`repomix`). See `.agents/SYSTEMS.md`.
- **Code-Intelligence Substrate**: SQLite index (`/home/tim/local.db`) SSoT for structural knowledge (8,982 entities, 46k relations, 779 files, 75.2% ranged). Scripts live in `~/.agents/skills/code-intelligence/scripts/`. Enforced via Gate 28 (`pnpm audit:code-intelligence`), edit-time hook, pre-commit block, and pre-push gate.
- **Toolchain resolution**: Prepend mise shim if pnpm missing in non-login shell:
  ```bash
  export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH"
  ```
- **Root install blocked**: Never run `pnpm install` in `Fork/` (blocked by preinstall). Run inside `Arch-System/`.
- **Env files**: `Arch-System/.env`, `apps/portal/.env`, `.env.tools`. DB keys never reach the client.
- **MCP servers**: Local `.mcp.json` registers `supabase`, `codemap`, `chrome-devtools`, `context7`. Standalone MCP servers built in own dirs.

---

## Testing & QA

### Suites

- **Unit/Component**: Jest 30 + `@swc/jest` (`*.test.ts(x)`). Portal coverage floors: lines 40, branches 27, functions 28, statements 40. `@repo/database` uses Node test scripts (`migration-rollback-safety.mjs`, `offline-mutations-security.mjs`). `@repo/ui` tested via Storybook.
- **E2E**: Playwright at `e2e/` (`pnpm test:e2e`). Visual regression allows `maxDiffPixelRatio: 0.02` (`pnpm test:e2e:visual`).
- **Accessibility**: Storybook + axe (`pnpm test:a11y` via Storybook on `:6006`).
- **Completion Criteria**: 28-gate `pnpm agent:verify`. Cheapest quick gate: `pnpm type-check && pnpm lint && pnpm policy:check && pnpm audit:drift && pnpm audit:code-intelligence`. Release suite: `pnpm quality`.
- **Conventions**: BDD naming (`describe('Given …')` / `it('When …, Then …')`). Mock at network-client boundaries only, never internal logic.

---

## Real-World Guardrails & Autonomous Lifecycle

Enforced by `.agents/rules/real-world-engineering.md` and `.agents/rules/execution-guardrails.md`:

- **Always branch & execute autonomously**: Create branch (`git checkout -b <type>/<scope>`) and complete tasks end-to-end without mid-task stops.
- **Zero guessing / 3-option prompt**: Back all claims with executed evidence. When uncertain, prompt the user with **3 concrete options** (Option 1 `(Recommended)`).
- **Autonomous completion**: Merge to `main`, push to GitHub (`git push origin main`), deploy to Vercel (`pnpm deploy:vercel:prod`).
- **Autonomous artifact auto-approval**: Artifacts auto-approve unless user states otherwise.
- **Industrial reality**: 24/7 SCADA, shift closeout, safety-critical; RLS initplan optimization, graceful degradation, optimistic queues.
- **Written plan before code**: Mandatory for non-trivial changes.

---

## Agent Action Scoring & Mandatory Governance

- **Action Scoring**: **+1** (task complete, gates pass) or **-2** (broken gate, unverified claim). Score < 0 escalates; Score ≤ -5 requires full 28-gate verify.
- **4 Execution Phases**: 1. Spec → 2. Plan → 3. Implement (gate after each step) → 4. Verify (zero regressions, update `AGENT_TRACER.md`).
- **Permission Tiers**: 1 read/research · 2 feature code + tests · 3 branches/PRs · 4 auth/RLS/migrations/infra · 5 production deploy/destructive.
- **Mandatory Rules**: Test-Driven Development (failing test first), No Artificial Completion (no placeholder claims), Independent Code Review for substantial PRs (`critique-council-reviewer` / `security-quality-gatekeeper`).

---

## References

- [AGENTS.md open format](https://agents.md/): closest AGENTS.md wins. Living doc — update when conventions change.
