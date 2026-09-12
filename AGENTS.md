# Repository Guidelines

Arch-Systems (Plantcor) — multi-departmental mining operations portal. **Turborepo 2.x + pnpm** monorepo with Next.js 16 App Router, PostgreSQL/RLS, Redis caching, and Python LLM eval suite.

---

## Project Overview

Portal integrates mining analytics, equipment status, and employee operations into department-specific dashboards with strict role + department-based authorization.

**Key services**: Next.js portal (`:3000`), Payload CMS, Supabase/Postgres, Redis, Python eval suite.
**Version**: 1.5.1 | **License**: MIT | **Private**: true

---

## Architecture & Data Flow

```
Client/UI → apps/portal/proxy.ts (edge middleware) → @repo/supabase (auth + queries)
                              ↓
                     @repo/redis (cached dept slugs, auth profiles)
                              ↓
                     @repo/database (migrations) → PostgreSQL (RLS)
```

- **Auth**: Supabase Auth (JWT), HttpOnly cookies, CSRF validated on login
- **AuthZ**: `public.employees` maps `auth_id` → `role`, `department_id`, `accessible_departments[]`
- **Route gating**: `apps/portal/proxy.ts` resolves dept slugs → UUIDs via Redis cache under `arch:auth:employee:${user.id}`
- **RLS**: Every table has RLS enabled. Policies consult `employees.role` + `employees.department_id`, not just `auth.uid()`
- **Middleware flow**: Session refresh → dept slug→UUID resolution → employee profile query → route gating

---

## Key Directories

| Path                         | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `apps/portal`                | Next.js 16 App Router, React 19, port `:3000`                                         |
| `apps/cms`                   | Payload CMS headless content service                                                  |
| `apps/overview`              | React Flow architecture visualization                                                 |
| `apps/ci-observer`           | CI observation helper                                                                 |
| `packages/ui`                | shadcn/ui + Radix primitives, animated components, topology nodes                     |
| `packages/theme`             | OKLCH tokens, Style Dictionary codegen, CSS variables                                 |
| `packages/supabase`          | Supabase clients (browser/server/middleware/read-replica/service-role), Kysely, types |
| `packages/database`          | SQL migrations (`NNN_description.sql`), RLS assertions                                |
| `packages/redis`             | Cache registry, L1/L2 write-through, TTL, buildCacheKey                               |
| `packages/errors`            | AppError hierarchy (ValidationError, AuthError, ForbiddenError, etc.)                 |
| `packages/contract`          | Canonical Zod schemas + inferred types (SSoT for cross-boundary contracts)            |
| `packages/rate-limiter`      | Fixed/sliding/token-bucket strategies, memory + Redis stores                          |
| `packages/utils`             | Analytics, fetch-client, excel export, Inngest/NOVU                                   |
| `packages/logger`            | Structured logging (Pino: server, browser, Next.js)                                   |
| `packages/agents`            | Coordinator, langfuse tracing, specialists                                            |
| `packages/eval`              | Python LLM evaluation (DeepEval + pytest, uv)                                         |
| `packages/eslint-config`     | ESLint configs (`library.js`, `react-internal.js`, `next.js`)                         |
| `packages/typescript-config` | Shared TS config                                                                      |
| `libs/features/<domain>`     | Domain modules: `<domain>/ui` + `<domain>/data-access`                                |
| `libs/shared`                | Cross-cutting: `data-access`, `utils`, `hooks`                                        |
| `scripts/`                   | Dev, deploy, backup, seed scripts; `AGENT_TRACER.md` per change                       |
| `tools/`                     | Policy compiler, project tag applicator, RLS auditor                                  |
| `e2e/`                       | Playwright E2E + visual regression tests                                              |
| `infra/`                     | Docker Compose, K8s manifests, monitoring stack                                       |

---

## Development Commands

```bash
pnpm install                  # Install deps (pnpm 9.15.9, volta-pinned Node 24.15.0)
pnpm dev                      # Portal dev server on :3000 (Turbopack; auto-starts local Supabase via scripts/dev.sh)
pnpm dev:quick                # Headless quick dev — skips Docker/Supabase checks
pnpm dev:turbo                # Portal only via turbo (fast dev loop)
pnpm dev:all:turbo            # Bootstrap every workspace via turbo
cd packages/supabase && npx supabase start  # Start local Supabase Docker (Studio on :54323)
pnpm build                    # Build all workspaces
pnpm turbo run build --filter=<name>  # Build single app/package
pnpm test                     # Run all unit tests (Jest + @swc/jest)
pnpm --filter portal test -- --testPathPatterns=<file>  # Single test file
pnpm test:e2e                 # Playwright E2E (requires :3000)
pnpm test:e2e:visual          # Visual E2E snapshots
pnpm ui                       # Storybook UI
pnpm test:a11y                # Storybook a11y checks
pnpm lint                     # Lint all workspaces
pnpm lint:root                # Lint root only
pnpm type-check               # Type-check all workspaces
pnpm quality                  # Full quality gate (lint + type-check + test + lint:tokens + lint:css + policy:check + audit)
pnpm format                   # Format code
pnpm deps:lint                # Syncpack dependency lint
pnpm knip                     # Dead-code detection
pnpm policy:gen               # Regenerate policy files from policy-compiler.cjs
pnpm policy:check             # Verify policy drift (CI)
pnpm --filter @repo/eval test # Python eval suite
```

**Husky hooks**: `pre-commit` runs `pnpm lint-staged` (config: `.lintstagedrc.mjs`) plus `node tools/scripts/skills-pre-commit.mjs`; `commit-msg` enforces commitlint. Never `--no-verify`.

---

## Code Conventions & Common Patterns

### Formatting & Quality

- Prettier: `semi`, `tabWidth 2`, `trailingComma all`, `printWidth 100`
- ESLint extends `@repo/eslint-config`; strict TS, **no `any`**, **no `// @ts-ignore`**
- Stylelint with `declaration-strict-value` plugin
- Conventional commits enforced by commitlint; Husky `commit-msg` rejects non-conforming

### Naming

- **Packages**: `@repo/<name>`, public API strictly from `src/index.ts`
- **Routes**: `page.tsx` for pages, `layout.tsx` for parent interfaces
- **Migrations**: `packages/database/migrations/NNN_description.sql` (zero-padded)
- **Feature modules**: `libs/features/<domain>/ui` (components), `libs/features/<domain>/data-access` (hooks/services)
- **Test files**: Co-located `*.test.ts(x)`; E2E in `e2e/`

### Error Handling

- **All errors** subclass `@repo/errors` (`AppError` base). **Never throw generic `Error`**.
- Server Actions/API Routes must catch via `isAppError(err)` and return `{ success, error, code }`
- Error codes: `MISSING_PAYLOAD`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, etc.

### Async & Server Actions

- Server Actions must declare `"use server"` and call `createServerSupabaseClient()` on line 1
- Return `{ success: boolean; data?: T; error?: string }` — never throw uncaught promises
- Mutating actions must call `revalidatePath()` or `revalidateTag()`

### Client State Management

- **Zustand 5**: UI chrome only (menus, modals, toggles). **Never server data in Zustand**
- **TanStack React Query**: All server-side data
- **XState**: Complex async workflows (e.g., `apps/portal/lib/plugins/machines/`)

### Architectural Boundaries

- `tools/repo/policy-compiler.cjs` is the SSoT for package boundaries
- `pnpm policy:gen` regenerates `tools/repo/policy/*.json` and `tools/repo/policy/eslint-boundaries.generated.cjs`
- **Constraints**: `scope:package:ui` cannot import `@repo/supabase`, `@repo/redis`, `@repo/database`; `scope:app` cannot import `@repo/database-internal`; `scope:feature` cannot depend on `scope:app`
- After adding a new project: add a `DEPENDENCY_RULES` entry to `tools/repo/policy-compiler.cjs` and run `pnpm policy:gen`

### Agent Tracing

- All agent task executions and changes are permanently logged to `archive/tracers/log/` using the tag `--<task_number>` naming convention (e.g., `archive/tracers/log/--task-XXX-<slug>.md`).
- Every touched package also keeps an `AGENT_TRACER.md`; append an ISO 8601-timestamped entry describing the change.
- Instead of updating in-place files, each task is archived individually as a discrete immutable task log in the centralized `archive/tracers/` directory and indexed in `archive/tracers/README.md`.
- Annotate non-obvious logic with `// AGENT-TRACE: <explanation>` referencing the task tag where applicable.

### Dependency Management

- Workspace catalogs in `pnpm-workspace.yaml`; use `catalog:` or `catalog:react19` prefix
- New packages must be `@repo/<name>` and add a `DEPENDENCY_RULES` entry to `tools/repo/policy-compiler.cjs`

---

## Important Files

| File                             | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `apps/portal/proxy.ts`           | Edge middleware: session refresh, dept gating, Redis cache                       |
| `apps/portal/server/proxy.ts`    | Server proxy: cached auth lookups, redirect validation                           |
| `apps/portal/next.config.mjs`    | Next.js config (Turbopack, standalone, Sentry, bundle analyzer)                  |
| `apps/portal/jest.config.js`     | Jest config with 40+ moduleNameMapper, JSDOM, coverage thresholds                |
| `apps/portal/setupTests.ts`      | Global test setup (Redis Map mock, Supabase mocks)                               |
| `e2e/playwright.config.ts`       | Playwright config with chromium/mobile/tablet projects                           |
| `e2e/global.setup.ts`            | E2E auth via cached credentials                                                  |
| `tsconfig.base.json`             | Root TS config with 30+ path aliases                                             |
| `turbo.json`                     | Turborepo 2.x config with task pipelines, global env, cache settings             |
| `pnpm-workspace.yaml`            | Workspace packages + dependency catalogs                                         |
| `tools/repo/policy-compiler.cjs` | SSoT policy compiler → generates rules + eslint boundaries                       |
| `tools/audits/audit-rls.cjs`     | Static RLS policy auditor                                                        |
| `packages/database/migrations/`  | 118 SQL migration files (001_initial.sql → 162_contextual_retrieval_support.sql) |
| `packages/errors/src/index.ts`   | AppError base classes + type guards                                              |
| `packages/contract/src/index.ts` | Canonical Zod schemas + derived types                                            |
| `packages/redis/src/index.ts`    | Cache registry, buildCacheKey, Redis client                                      |
| `packages/supabase/src/index.ts` | Supabase client factories + manual table types                                   |
| `packages/ui/src/index.ts`       | @repo/ui public API (80+ named exports)                                          |
| `packages/theme/src/index.ts`    | @repo/theme tokens, ArchThemeProvider, useArchTheme                              |
| `.mcp.json`                      | MCP server configs (postgres)                                                    |

---

## Runtime/Tooling Preferences

- **Runtime**: Node.js `>=22` (volta-pinned to `24.15.0`). Bun is **not supported** for the portal app.
- **Package manager**: pnpm `9.15.9` only
- **Build**: Turbopack (dev + production). Webpack not used (inngest/node:async_hooks incompatibility)
- **Output**: Next.js standalone for Docker
- **Shared catalogs**: Use `catalog:` prefix in `pnpm-workspace.yaml`
- **Local services**: Supabase on `54321/54322/54323/54329`; Grafana `9091`, Prometheus `9093`, cAdvisor `8082`
- **Monitoring**: Sentry, OpenTelemetry, `prom-client`, custom metrics in `apps/portal/lib/observability/`

---

## Testing & QA

### Test Frameworks

| Framework                                                   | Scope                        | Config                                             |
| ----------------------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| **Jest** (@swc/jest)                                        | Unit tests across 9 packages | `apps/portal/jest.config.js` + per-package configs |
| **Playwright**                                              | E2E + visual regression      | `e2e/playwright.config.ts`                         |
| **Storybook** (`@storybook/test-runner` + `axe-playwright`) | Component a11y               | `pnpm test:a11y`                                   |
| **pytest + DeepEval**                                       | Python LLM eval              | `packages/eval/pyproject.toml`                     |
| **SQL transaction tests**                                   | RLS validation               | `packages/database/tests/`                         |

### Coverage Thresholds (Jest enforced)

- Lines: **40%** | Branches: **30%** | Functions: **35%** | Statements: **40%**

### Mocking Strategy

- **Redis**: Global in-memory `Map` mock in `apps/portal/setupTests.ts` (`get`, `set`, `del`, `incr`, `expire`)
- **Supabase**: Per-test `jest.mock` with chainable spies (`from().select().eq()`)
- **Mock at network boundary** (Supabase, Redis), never at function call

### Test Patterns

- Unit tests: co-located `*.test.ts(x)`, no need for Supabase
- E2E tests: require portal dev server on `:3000` and Chromium
- Visual tests: `toHaveScreenshot()` with 2% pixel variance, mask dynamic elements (clocks, videos, canvas)
- **UI invariant**: Always light mode (`#f3f4f6` background, luminance > 200). No dark mode.
- DB RLS tests: transaction-wrapped SQL, verify non-admin roles cannot self-elevate
- Jest `moduleNameMapper`: Add explicit mappings for any new `@repo/*` import or subpath export in `apps/portal/jest.config.js`

### Quality Gate (`pnpm quality`)

Runs: lint → type-check → test → lint:tokens → lint:css → policy:check → deps:lint → knip → audit:rls → audit:design

---

## CI/CD

- **CI**: `.github/workflows/ci.yml` — parallel jobs for deps-lint, security-audit, knip, policy-check, html-meta-check, md-lint, quality, e2e, lighthouse, a11y, self-healing
- **Deploy**: `.github/workflows/deploy.yml` — quality-check → staging (Vercel/SSH/Docker) → production
- **Release**: Changesets-based via `.github/workflows/release.yml`
- **Canary**: `.github/workflows/deploy-canary.yml` — kubectl, 10% traffic, smoke tests
- **DAST**: `.github/workflows/dast.yml` — OWASP ZAP daily on staging
- **Reviewdog**: ESLint/Prettier/Markdown lint on PRs via `.github/workflows/reviewdog.yml`

---

## Code Generation Pipelines (never edit generated output)

| Source                          | Command                                                          | Output                                    |
| ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| `packages/theme/tokens.json`    | `pnpm --filter @repo/theme build`                                | `generated.ts`, `variables-generated.css` |
| `packages/database/migrations/` | `pnpm --filter @repo/database supabase:push && ... supabase:gen` | `packages/supabase/src/database.types.ts` |

Commit both source and generated files in the same atomic change.

---

## Mandatory Phased Action Plan & Real-World Review Framework

All agents, CLI tools, and automated workflows operating in this repository MUST follow the strict phased execution pipeline before modifying code logic:

1. **Phased Documentation Sequence (`temp/`)**:
   - `temp/outline.md`: High-level strategic vision, problem framing, real-world Council viewpoints, and scope breakdown.
   - `temp/requirements.md`: Functional scope, user stories, and precise acceptance criteria formatted in **EARS** notation (`WHEN [condition] THE SYSTEM SHALL [behavior]`), explicitly detailing normal behavior, error paths, and edge cases. (For bug fixes, replaced by `bugfix.md`).
   - `temp/design.md`: Technical architecture, data models, API contracts, sequence diagrams, and testing strategies ensuring feasibility.
   - `temp/tasks.md`: Executable task breakdown organized into logical execution waves with sub-tasks linked back to `requirements.md`.

2. **Real-World Scoring & Phase Gate Auditing**:
   - Before executing code changes in each wave, review `outline.md`, `requirements.md`, `design.md`, and `tasks.md` using the **Real-World Quality Score**:
     $$\text{Real-World Score} = \frac{\text{Feasibility} + \text{Maintainability} + \text{Security} + \text{Performance} + \text{Reliability}}{5}$$
   - Only proceed to wave execution when the score achieves $\ge 90/100$.

## Compound Engineering & Sequential Thinking Workflow

**CRITICAL RULE:** All agents MUST integrate Compound Engineering (CE) and Sequential Thinking tools to deliberate complex architectures and implementations.

1. **Sequential Thinking**: Before writing any implementation code for complex features, agents MUST invoke the MCP `sequential-thinking` tool (`call_mcp_tool`) to trace out dependencies, side-effects, and edge cases.
2. **Compound Engineering**: Agents MUST utilize the Compound Engineering Plugin flows (`ce-plan`, `ce-work`, `ce-simplify-code`, `ce-code-review`) to ensure iterative dual-mind verification and safe incremental delivery.

## Permanently Deployed Agents

The following agents must ALWAYS be deployed (e.g. running as a daemon or continuous subagent):

- **Responder**: The `responder` agent must be permanently active to generate responses making full use of command references, delegating tasks to specialized agentic agents, and advising until the system goal is reached.

## Arch-CorpOS Business Loops (Win Loops)

This repository implements an autonomous business loop architecture (synthesis of `win.sh`, `CorpOS`, and `ai-company`) located in `.agents/corpos/`.

- **Signal-driven execution:** Automations are not blind cron jobs. They wake on signals (e.g. `scada_alarm`), generate strategic briefs, run verification gates, record artifacts, and log outcomes.
- **Adaptive Scheduling:** Interval polling adapts based on the stability of the environment.
- **Agent Governance:** Subagents are subject to operational boundaries. Level 3 operations strictly require human approval (`corpos approve <id>`).
- **File Structure:** All configurations, scripts, and logs are tracked in git under `.agents/`. See `.agents/README.md` and `.agents/corpos/SPEC.md` for in-depth details.

---

## Tiered Context Architecture, Modular Rules & Skills-First Protocol

All autonomous agents operating within this repository MUST adhere to the tiered context economics and modular rules architecture:

### 1. The 3-Tier Context Model (T0 / T1 / T2+)

- **T0 — Central AI (Main Thread / Orchestrator)**: Pure coordinator and user liaison. Never pollute T0 with multi-thousand-line dependency dumps, wide search sweeps, or raw logs.
- **T1 — Persistent Domain Specialists**: Long-running domain workers (Database Architect, UI Engineer) retaining focused domain context across multi-turn workflows.
- **T2+ — Throwaway Disposable Scouts**: One-shot subagents spawned for wide codebase greps, log sweeps, and external web research. Burns disposable context and returns strictly distilled structured output.

### 2. Skills-First Operational Workflow

$$\text{Request} \longrightarrow \text{Load Skills} \longrightarrow \text{Gather Scoped Context} \longrightarrow \text{Execute} \longrightarrow \text{Verify}$$

- High-level operational workflows reside in `AGENTS.md` and `GEMINI.md`.
- Procedural multi-step runbooks live in `.agents/skills/` (e.g. `supabase`, `agents-md`, `supabase-postgres-best-practices`).
- Domain-specific invariants live in path-targeted modular rules in `.agents/rules/`.

### 3. Path-Targeted Modular Rules Directory (`.agents/rules/`)

All domain rules are decoupled from the root operational core and scoped via YAML frontmatter `paths:`:

- `testing-rules.md`: `paths: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"]`
- `api-guidelines.md`: `paths: ["apps/portal/app/api/**/*.{ts,js}", "packages/contract/src/**/*.{ts,js}"]`
- `database-migrations.md`: `paths: ["packages/database/migrations/**/*.{sql,ts}", "packages/database/tests/**/*.{sql,ts}"]`
- `react-components.md`: `paths: ["packages/ui/**/*.{ts,tsx}", "apps/portal/components/**/*.{ts,tsx}"]`
- `nextjs-use-client.md`: `paths: ["packages/ui/src/**/*.{ts,tsx}", "libs/features/**/ui/**/*.{ts,tsx}"]`
- `turbopack-css-compat.md`: `paths: ["**/*.css", "packages/theme/**/*"]`
- `execution-guardrails.md`: Project-wide execution mandates and compliance gates.
- `realitic-checker.md`: Adaptive Real-World Reasoning (ARWR) verification loop.

### 4. Context Economics & The Golden Test

- **The 80/20 Capacity Rule**: Stop complex multi-file mutations when context reaches 80% capacity. Hand off heavy exploration to subagents.
- **The Golden Test**: _"Would a strong frontier model behave worse without this line?"_ If no, remove it from always-loaded files.
