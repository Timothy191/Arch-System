# Operational Handbook (archived)

> **Not injected every session.** Slim always-on index: [`CLAUDE.md`](../../CLAUDE.md).  
> This file preserves the full onboarding guide moved out of root `CLAUDE.md` for context optimization.

---

## ⚠️ MANDATORY AGENT TRACING RULE

**ALL AGENTS MUST FOLLOW THIS RULE ON EVERY CODE CHANGE:**

1. **Update AGENT_TRACER.md** in the root of the package/app you’re modifying.
   - Log timestamp (ISO 8601), purpose, changes made, and what the next agent should know.
   - Location: `packages/<package>/AGENT_TRACER.md` or `apps/<app>/AGENT_TRACER.md`.

2. **Leave inline breadcrumbs** for complex architectural logic.
   - Use `// AGENT-TRACE: <explanation>` or `/* AGENT-TRACE: ... */` comments.
   - Explain implicit business rules, domain context, and non‑obvious design decisions.

3. **Add runtime telemetry** where applicable.
   - Instrument functions with `prom-client` counters/histograms or OpenTelemetry spans.
   - Ensure any new service interaction (DB, Redis, API) is measurable.

**FAILURE TO FOLLOW THIS RULE IS A VIOLATION OF AGENT CONTRACTS.**
See the bottom of this file for additional hand‑off details.

---

## Table of Contents

1. [Project Overview & Runtime Requirements](#project-overview--runtime-requirements)
2. [Monorepo Architecture & Key Packages](#monorepo-architecture--key-packages)
3. [Environment Setup & Quick Start](#environment-setup--quick-start)
4. [Essential Commands](#essential-commands)
5. [Code Generation Pipelines](#code-generation-pipelines)
6. [Database & Migrations (Supabase)](#database--migrations-supabase)
7. [Authentication & Middleware](#authentication--middleware)
8. [Portal App Internals](#portal-app-internals)
9. [Design System & UI Rules](#design-system--ui-rules)
10. [Testing](#testing)
11. [Linting, Formatting & Quality Gates](#linting-formatting--quality-gates)
12. [Git & Quality Infrastructure](#git--quality-infrastructure)
13. [Real-World Development Workflows](#real-world-development-workflows)
14. [Common Pitfalls & Troubleshooting](#common-pitfalls--troubleshooting)
15. [Security & Compliance](#security--compliance)
16. [Agent Contracts (Phase Boundaries & Roles)](#agent-contracts-phase-boundaries--roles)
17. [MCP Servers & Reporecall](#mcp-servers--reporecall)
18. [Key Configuration Files](#key-configuration-files)
19. [Checklist for Adding a Feature](#checklist-for-adding-a-feature)
20. [Self-Correction, Review Checkpoints & Quality Gates](#self-correction-review-checkpoints--quality-gates)
21. [Related Documentation](#related-documentation)

---

## Project Overview & Runtime Requirements

This is a **mining operations portal** monorepo managed with **Nx + pnpm workspaces**.  
The primary application is a Next.js 15+ App Router dashboard, backed by Supabase, Redis, and a shared design system.

### Runtime Requirements

- **Node.js**: `>=22` (Volta‑managed, pinned in `package.json`)
- **pnpm**: `9.15.9` (Volta‑managed; workspace catalog in `pnpm-workspace.yaml`)
- **Project type**: ESM (`"type": "module"` in root `package.json`)
- **Default branch**: `master`

---

## Monorepo Architecture & Key Packages

### Apps (with default ports)

| App      | Port  | Description                                        |
| -------- | ----- | -------------------------------------------------- |
| portal   | :3000 | Next.js 15+ (React 19). Main mining ops dashboard. |
| cms      | :3001 | Payload CMS v3 (headless).                         |
| overview | :3002 | Architectural visualisation (React Flow).          |
| web      | —     | Empty scaffold (no `package.json`).                |

### Packages

| Package          | Key Exports / Purpose                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `@repo/theme`    | `./css`, `./tokens`, `./react`, `./tailwind`, `./motion` — OKLCH design tokens & Tailwind preset                |
| `@repo/ui`       | Shared Radix/shadcn UI components (`cn()` from `lib/utils`), composite widgets in `widgets/`                    |
| `@repo/supabase` | Browser, server, middleware, read‑replica, Kysely, service‑role clients. `database.types.ts` is auto‑generated. |
| `@repo/database` | SQL migrations in `./migrations/*` (source of truth). `tests/` contains security tests.                         |
| `@repo/utils`    | Shared utilities, Inngest & Novu integrations                                                                   |
| `@repo/redis`    | Redis helpers (`./client`, `./cache`) — department‑slug resolution, caching                                     |
| `@repo/errors`   | Domain‑specific error classes                                                                                   |
| `@repo/eval`     | Python/DeepEval AI compliance suite (separate Poetry environment, not in `pnpm quality`)                        |

### Dependency Versioning

`pnpm-workspace.yaml` defines two catalogs:

- `catalog:` — shared dep versions (lucide-react, tailwindcss, eslint, …)
- `catalog:react19:` — React 19 pinned versions (`react`, `react-dom`, `@types/react`, `@types/react-dom`)

Packages reference these via `"catalog:"` or `"catalog:react19:"` in their `package.json`. **Always check the catalog before bumping a shared dependency** — a catalog change propagates to all consumers.

---

## Environment Setup & Quick Start

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment files and fill in secrets:

   ```bash
   cp apps/portal/env/.env.example apps/portal/.env
   cp .env.example .env            # if root .env.example exists
   ```

3. Start local Supabase:

   ```bash
   pnpm --filter @repo/database supabase:dev
   ```

4. Start the portal:

   ```bash
   pnpm dev
   ```

   Portal will be at `http://localhost:3000`.

**Alternative one‑command bootstrap**: `pnpm dev:up` (via `scripts/dev.sh`) supports flags like `--quick`, `--force`, `--tools`, `--cms`, `--overview`, `--all`.

---

## Essential Commands

### Development

| Command                                     | What it does                       |
| ------------------------------------------- | ---------------------------------- |
| `pnpm dev`                                  | Start portal dev server (:3000)    |
| `pnpm --filter <name> dev`                  | Start a specific app/package       |
| `pnpm --filter @repo/database supabase:dev` | Start local Supabase               |
| `pnpm --filter @repo/database supabase:gen` | Regenerate TS types from DB schema |

### Build & Quality

| Command                                                  | What it does                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm build`                                             | Build all packages and apps (`nx run-many -t build`)                                                       |
| `pnpm lint`                                              | Lint all packages                                                                                          |
| `pnpm type-check`                                        | TypeScript checks across all packages                                                                      |
| `pnpm test`                                              | Run all unit tests (Jest)                                                                                  |
| `pnpm --filter portal test -- --testPathPatterns=<file>` | Run a single portal test file                                                                              |
| `pnpm test:e2e`                                          | Playwright E2E tests (requires :3000 running, Chromium only)                                               |
| `pnpm quality`                                           | Full gate: lint → type‑check → test → lint:tokens → lint:css → format‑check → lint‑root → deps:lint → knip |

### Formatting & Cleanup

| Command                             | What it does                        |
| ----------------------------------- | ----------------------------------- |
| `pnpm format` / `pnpm format:check` | Prettier write/check                |
| `pnpm knip` / `pnpm knip:fix`       | Find/fix unused exports & deps      |
| `pnpm deps:lint` / `pnpm deps:fix`  | Dependency consistency via syncpack |
| `pnpm md:lint` / `pnpm md:fix`      | Markdownlint                        |
| `pnpm ui`                           | Open shadcn/ui CLI                  |

### Analysis & Deployment

| Command                                                      | What it does                              |
| ------------------------------------------------------------ | ----------------------------------------- |
| `pnpm analyze`                                               | Bundle analyzer (requires `ANALYZE=true`) |
| `pnpm db:docs`                                               | Generate ER diagrams via `tbls`           |
| `pnpm monitor` / `pnpm monitor:grafana`                      | Docker‑based monitoring                   |
| `pnpm deploy:local` / `deploy:staging` / `deploy:production` | Deployment targets                        |
| `pnpm fresh-start`                                           | Clean rebuild from scratch                |

---

## Code Generation Pipelines

Two automated pipelines produce derived artifacts — **never edit generated files manually**.

### 1. Design Tokens (`@repo/theme`)

- **Source of truth**: `packages/theme/tokens.json`
- **Command**: `pnpm --filter @repo/theme build` (or `codegen`)
- **Output**: `packages/theme/src/tokens/generated.ts`
- **Validation**: `pnpm --filter @repo/theme lint:tokens` checks CSS/Tailwind consistency

**Workflow**: Edit `tokens.json` → run build → commit both `tokens.json` and `generated.ts`.

### 2. Database Types (`@repo/database` → `@repo/supabase`)

- **Source of truth**: `packages/database/migrations/*.sql`
- **Command**: `pnpm --filter @repo/database supabase:gen`
- **Output**: `packages/supabase/src/database.types.ts`

**Workflow**: Create migration → push to DB → run `supabase:gen` → commit migration + updated types.

---

## Database & Migrations (Supabase)

- **Migrations**: Source of truth is `packages/database/migrations/` (zero‑padded sequential numbers, e.g. `001_initial.sql`).
- **Deploy‑time copy** in `packages/supabase/supabase/migrations/` is generated — **never edit directly** (a PreToolUse hook blocks direct edits).
- After any migration, run `supabase:gen` to update `database.types.ts`.
- All tables **must have Row Level Security (RLS)** enabled with appropriate policies.
- The `employees` table is the authorization source of truth — **not** Supabase Auth metadata.
- Connection details are printed by `supabase:dev`. Use `SUPABASE_` prefixed env vars on the server; `NEXT_PUBLIC_` for client‑only exposure.

---

## Authentication & Middleware

- `apps/portal/middleware.ts` delegates to `apps/portal/server/proxy.ts`. It handles:
  - Session refresh
  - Department‑slug → UUID resolution (Redis‑cached, `packages/redis`)
  - Role‑based route gating (`RESTRICTED_ROUTES` and `DEPARTMENT_ROUTES` maps)
- **Route `/api/c66` is exempt from authentication** — never remove this exemption.
- Server Actions must use `createServerSupabaseClient()` from `@repo/supabase/server` and **validate the authenticated user at the top**.
- Always write RLS policies that match your Server Action authorization checks.

---

## Portal App Internals

### Key Directories

| Directory     | Purpose                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`        | Route groups: `(auth)/`, `(departments)/`, `(hub)/`, `admin/`, `api/`                                                                                                                     |
| `features/`   | Feature components: `access-control/`, `admin/`, `departments/`, `hub/`, `shared/` (includes AI sidebar)                                                                                  |
| `lib/`        | Server logic: `ai/` (LangGraph agent), `analytics/`, `jobs/` (Inngest), `observability/`, `sync/`, errors, rate limiting, caching                                                         |
| `components/` | Global UI: `BottomWidgetBar`, `CommandBar`, `FocusMode*`, `OfflineBanner`, `PerformanceListener`, `RouteBackground`, `SmoothScrollProvider` + `ui/`, `nav/`, `ai/`, `control‑room/`, etc. |

### Route Groups & Layouts

- `(auth)/` — Login, password reset/update. Uses auth layout + `AnimatedWavesBackground`.
- `(departments)/[department]/` — Dynamic dashboard per department. Each static sub‑page **must** export its own `layout.tsx` re‑exporting `DepartmentLayout`.
- `(hub)/` — Landing / executive overview.
- `api/` — API routes (ai, c66, export, health, plugins, sync, tools, webhooks). Server Actions should be co‑located with features.
- `admin/` — Admin panel.

Root layout (`apps/portal/app/layout.tsx`) mounts `ArchThemeProvider`, `OfflineBanner`, `AnimatedWavesBackground`, and `AIAssistantSidebarWrapper`. Never bypass these providers without architectural approval.

### Path Aliases

- `~/*` and `@/*` → `apps/portal/*`
- Sub‑imports: `@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*`

### Instrumentation

`instrumentation.ts` initializes OpenTelemetry (NodeSDK with auto‑instrumentations) and Sentry (tracesSampleRate: 0.1 in production, tunnel route `/monitoring`).

---

## Design System & UI Rules

**Always consult `DESIGN.md` for full palette details.** Key constraints:

1. **Light‑only theme**: forced via `<script>` in `<head>` with `data-theme="light"`. Dark mode does not exist.
2. **Shadows**: Raw `box-shadow` and Tailwind `shadow-*` utilities are **forbidden**. Use tokenized `shadow-card`, `shadow-window`, `shadow-diffusion-*` exclusively.
3. **Glass pattern**: `bg-white/70 backdrop-blur-xl border border-black/[0.08]`
4. **Class merging**: Always use `cn()` from `@repo/ui/lib/utils` — never concatenate manually.
5. **Icons**: Named imports only (`import { Drill } from "lucide-react"`). Wildcard imports cause huge chunks (~1.3 MB).
6. **Animation constraints**: Only animate `opacity`, `transform`, `background-color`, `border-color`, `color`. Never layout properties. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
7. **Liquid Glass Motion**: CSS handles hover shape/scale; Framer Motion only handles active press (`whileTap` with `hoverScale={1}`).

---

## Testing

### Unit Tests (Jest)

- Command: `pnpm test`
- **Does not** require Supabase running.
- Coverage thresholds: lines 40%, branches 30%, functions 35%, statements 40%.
- When importing new workspace packages in portal, add a `moduleNameMapper` entry in `apps/portal/jest.config.js`.

### E2E Tests (Playwright)

- Command: `pnpm test:e2e`
- Requires dev server on `:3000`.
- Visual snapshots: `e2e/visual/__snapshots__/` using Chromium `/usr/bin/google-chrome`.
- Write Playwright tests for new critical user flows.

### AI Compliance

- `packages/eval/` contains Python/DeepEval suite — run it when changing AI‑generated code or pipelines.

---

## Linting, Formatting & Quality Gates

Before pushing, run `pnpm quality` — it executes in this order:

```text
deps:lint → lint → type-check → test → lint:tokens → lint:css → format-check → lint-root → deps:lint → knip
```

Additional tools:

- **syncpack** (`deps:lint`/`deps:fix`) — version consistency across workspaces.
- **knip** (`knip`/`knip:fix`) — dead code detection. Update `knip.json` when adding new entry points (routes, features).
- **markdownlint** (`md:lint`/`md:fix`) — markdown quality.
- **secretlint** (`.secretlintrc.json`) — runs on pre‑commit via lint‑staged.

---

## Git & Quality Infrastructure

### Git Hooks (Husky)

| Hook       | Action                                                        |
| ---------- | ------------------------------------------------------------- |
| pre-commit | `pnpm lint-staged` (ESLint fix → Prettier write → secretlint) |
| pre-push   | `pnpm nx run-many -t lint type-check` (filtered to portal)         |
| commit-msg | `pnpm commitlint` (conventional commits enforced)             |

### lint-staged

- `*.{js,ts,tsx}`: `eslint --fix` → `prettier --write`
- `*.{json,md,css,mjs,yaml,yml}`: `prettier --write`
- `*`: `secretlint --secretlintrc .secretlintrc.json`

**Never skip hooks with `--no-verify`.**

### Git Safety Rules for Agents

- One commit per logical task/plan.
- Always create **new** commits; never amend.
- Prefer specific `git add` over `git add -A`.
- Never force‑push to `master`.
- **NEVER execute git write commands without explicit user permission** (`git add`, `commit`, `push`, `checkout`, `reset`).
- **NEVER `git checkout --` on unstaged changes** — it is irreversible.

---

## Real-World Development Workflows

### Adding a New Database Table

1. Create migration: `packages/database/migrations/NNN_description.sql`
2. Enable RLS and add policies.
3. Push: `pnpm --filter @repo/database supabase:push`
4. Regenerate types: `pnpm --filter @repo/database supabase:gen`
5. Update Supabase client queries.
6. Write tests for new RLS policies.
7. Update `AGENT_TRACER.md` in `packages/database` and `packages/supabase`.

### Adding a New UI Component

1. Create component in `packages/ui/src/components/`.
2. Export from `packages/ui/src/index.ts`.
3. If used in portal, add `moduleNameMapper` entry in `apps/portal/jest.config.js`.
4. Follow design system rules (glass, tokens, animations).
5. Add unit tests.
6. Update `AGENT_TRACER.md` in `packages/ui`.

### Adding a New Route in Portal

1. Determine route group and create `page.tsx` + `layout.tsx` if needed.
2. If department static sub‑page, export own `layout.tsx` re‑exporting `DepartmentLayout`.
3. Check middleware coverage (add exemption only if strictly necessary).
4. Register route entry point in `knip.json`.
5. Write E2E test.
6. Update `AGENT_TRACER.md` in `apps/portal`.

### Using Redis Caching

- Add new cached lookup in `packages/redis` with appropriate TTL.
- Use it in `proxy.ts` or Server Actions.
- Instrument cache hit rates (prom‑client/OpenTelemetry).
- Update `AGENT_TRACER.md` in `packages/redis`.

---

## Common Pitfalls & Troubleshooting

| Symptom                               | Likely Fix                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Types not updating after migration    | Run `supabase:gen` and restart TypeScript server.                           |
| Middleware not applying to new routes | Verify the route is inside a covered group; ensure no accidental exemption. |
| Icon chunk too large                  | Never use `import * as Icons`. Run `knip:fix` to remove dead imports.       |
| Design tokens mismatch                | Run `pnpm --filter @repo/theme build` and `lint:tokens`.                    |
| Jest cannot resolve `@repo/ui`        | Add path to `moduleNameMapper` in `jest.config.js`.                         |
| Supabase connection refused           | Docker must be running; check ports 54321/54322.                            |
| `pnpm quality` fails on format        | Run `pnpm format` or configure editor Prettier integration.                 |
| knip false positives                  | Add missing entry points to `knip.json`.                                    |
| `supabase:gen` fails                  | Ensure Supabase is running and latest migrations are applied.               |

---

## Security & Compliance

- **Never commit secrets.** Use `.env.example` as a template.
- Every Supabase table **must** have RLS enabled.
- Server Actions must validate user identity and authorization; never trust client‑sent IDs alone.
- Secret scanning runs on pre‑commit (`.secretlintrc.json`); do not disable.
- Report any security concerns in `AGENT_TRACER.md`.

---

## Agent Contracts (Phase Boundaries & Roles)

### Phase Boundaries

| Phase   | When                                                   | Gate                                            |
| ------- | ------------------------------------------------------ | ----------------------------------------------- |
| Discuss | Gray areas exist (layout, API shape, error handling)   | Capture decisions in plan file                  |
| Plan    | >3 files, architectural decisions, multiple approaches | Verified by checker subagent (max 3 iterations) |
| Execute | Plans pass verification                                | Atomic commits per task, parallel waves         |
| Verify  | Execution complete                                     | Quality gate: lint, type-check, test --related  |
| Ship    | Verification passed                                    | `pnpm quality` passes, PR ready                 |

**Never replan a Complete phase without explicit `--force`.**

### Agent Roles

| Role           | Context    | Rule                                                               |
| -------------- | ---------- | ------------------------------------------------------------------ |
| Orchestrator   | 15% budget | Parse args, validate, spawn agents, collect results                |
| Planner        | Fresh 200k | Produces executable prompts, not documents                         |
| Executor       | Fresh 200k | One atomic commit per plan task                                    |
| Checker        | Fresh 200k | Reviews plan quality before execution (max 3 iterations)           |
| Researcher     | Fresh 200k | Technical research; output feeds into planning                     |
| Spec-Review    | Fresh 200k | Adversarial plan review — gaps, edge cases, requirement mismatches |
| Changes-Review | Fresh 200k | Post‑implementation code review against plan                       |

### Workflow Routing

```text
/spec → Dispatcher → Feature: plan → implement → verify
                   → Bugfix:  investigate → plan → implement → verify
/fix  → fix skill (quick lane). Bails to /spec if scope exceeds quick lane.
/prd  → requirements → hand off to /spec
```

**Dispatcher integrity:** `/spec` dispatcher is a thin router. Only allowed tools: `Bash` (env reads), `Read` (plan files), `AskUserQuestion`, `Skill`. Any Edit/Write/Grep/Glob/Task is a workflow violation.

### Subagent Discipline

- Use for: parallel exploration, background tasks, security review, debugging, planning verification.
- Avoid for: tasks needing conversation context or incremental refinement.
- Main context stays at 30‑40%; heavy work in subagents.
- Launch with `run_in_background=true`.
- Subagents do **not** inherit rules; they can read `.claude/rules/*.md`.

### Context Discipline

- Read before edit.
- Compact at task boundaries (use `/compact` at ~50% context).
- Summarize explorations.
- Use subagents to isolate high‑volume output (tests, logs, docs).
- Track current phase, active plans, locked decisions in task descriptions.

### Concrete Agent Definitions

See `.claude/agents/*.md` for 50+ specialized agent profiles (accessibility, backend, database, frontend, security, testing, etc.).

---

## MCP Servers & Reporecall

### Preflight MCP Server (`preflight-dev`)

Catches vague prompts before they cause wrong‑then‑fix cycles. Tools include prompt discipline, session stats, timeline/vector search (LanceDB), and more.

### Reporecall MCP Server (`@proofofwork-agency/reporecall`)

Local codebase memory system providing:

- Intent‑routed code retrieval
- Auto‑generated wiki pages
- Interactive architecture dashboard
- 3‑8x token reduction compared to traditional approaches
- Persistent memory across sessions

### How to Use Reporecall

1. **Answer from injected context first.** Do not re‑fetch files listed in the injected context header.
2. **Fill gaps** with Reporecall MCP tools (`search_code`, `explain_flow`, `find_callers`, `get_symbol`) or standard Grep/Read/Glob.
3. **Avoid redundant searches** — do not re‑search for symbols already present in injected context.
4. If context is marked “low confidence”, steps 2 and 3 are appropriate immediately.

**Memory management**:

- `store_memory` — Save important context, decisions, patterns.
- `recall_memory` — Retrieve relevant memories.
- `forget_memory` — Remove outdated memories.

Memories are automatically injected alongside code context when relevant.

---

## Key Configuration Files

| File                                     | What it controls                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/database/supabase/config.toml` | Local Supabase ports/keys                                                        |
| `nx.json`                                | Pipeline DAG, caching, env passthrough                                           |
| `apps/portal/next.config.mjs`            | PWA, Sentry, `transpilePackages`                                                 |
| `knip.json`                              | Entry points for dead‑code detection                                             |
| `.mcp.json`                              | n8n MCP server, codebase‑memory MCP                                              |
| `.syncpackrc.js`                         | Inter‑package dependency version rules                                           |
| `.secretlintrc.json`                     | Secret scanning patterns (pre‑commit)                                            |
| `pnpm-workspace.yaml`                    | Package catalog versions                                                         |
| `.claude/settings.json`                  | Hooks for secret‑scanning, auto‑formatting, ESLint, learning capture, compaction |

---

## Checklist for Adding a Feature

- [ ] Migrations created and pushed (if DB changes)
- [ ] RLS policies defined and tested
- [ ] Types regenerated (`supabase:gen`)
- [ ] New env vars added to `.env.example` and CI config
- [ ] UI components follow design system (tokens, glass, shadows, animations)
- [ ] Unit tests cover new logic (maintain coverage thresholds)
- [ ] E2E test for user journey (if UI‑facing)
- [ ] Middleware rules reviewed (auth, caching)
- [ ] `knip.json` updated with new entry points
- [ ] `AGENT_TRACER.md` entries in all modified packages
- [ ] Inline breadcrumbs for complex business logic
- [ ] Runtime telemetry added for new services/critical paths
- [ ] Full `pnpm quality` passes locally

---

## Self-Correction, Review Checkpoints & Quality Gates

### Self-Correction Protocol

When the user corrects me or I make a mistake:

1. Acknowledge specifically what went wrong.
2. Propose a concise rule: `[LEARN] Category: One-line rule`.
3. Wait for user approval before persisting.

### Review Checkpoints

Pause for review at: plan completion, >5 file edits, git operations, auth/security code.

### Quality Gates for Agents

After edits: lint, type‑check, test. Run `pnpm quality` before declaring a task complete.

---

## Related Documentation

Authoritative docs at repository root:

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Complete documentation index and navigation
- **[DESIGN.md](DESIGN.md)** — Color system, typography, spacing, elevation, component rules, animation constraints
- **[PRODUCT.md](PRODUCT.md)** — User personas, product strategy, tone, anti‑references
- **[AGENTS.md](AGENTS.md)** — Development workflow rules, agent contracts, quality gates
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Deployment guide for all environments
- **[SECURITY.md](SECURITY.md)** — Security policy and vulnerability reporting

Domain‑specific rules are auto‑loaded from `.claude/rules/`:

| File               | Covers                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `architecture.md`  | Monorepo structure, apps, packages, dependency versioning, database, AI orchestration           |
| `portal.md`        | Portal config, path aliases, route groups, global shell, data fetching, testing, CI order       |
| `auth.md`          | Proxy/middleware, auth resolution flow, RLS, restricted routes, Server Action auth patterns     |
| `design-system.md` | Light‑only theme, OKLCH colors, glass pattern, shadow tokens, typography, animation constraints |

Workflow rules (verification, testing, development‑practices, code‑review, task‑workflow, thought‑process) are also in `.claude/rules/`.

---

**Now, build safely.**

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
