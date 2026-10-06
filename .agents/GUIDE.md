---
name: unified-agent-operations-guide
description: >-
  Provider-neutral operational guide for all AI agents working in Arch-System.
  Consolidates environment details, common commands, debugging tips, conventions,
  and agent workflow rules from the former CLAUDE.md and .cursorrules into a single
  canonical reference under .agents/.
alwaysApply: true
---

# Unified Agent Operations Guide

**Canonical Location:** `.agents/GUIDE.md`
**Governing SSoT:** `AGENTS.md` (root) — architecture, domain, personas, data flow.
**Provider-Specific Redirects:** `CLAUDE.md`, `GEMINI.md`, `.cursorrules` — thin pointers to this file.

> All agents — Claude Code, Gemini/Antigravity, Cursor, Copilot, Cline, Windsurf, Codex, Aider, or any future IDE agent — MUST read this guide and the root `AGENTS.md` before operating. Provider-specific settings (e.g. `.claude/settings.json`) remain at their required locations but contain no behavioral rules.

---

## 1. Project At-a-Glance

| Concern         | Detail                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Name            | Arch-Systems (Plantcor) Mining Operations Portal                                                   |
| Domain          | Surface-mining ops: SCADA telemetry, shift closeout, equipment maintenance, badging/access control |
| Type            | Turborepo monorepo (pnpm workspaces)                                                               |
| Primary App     | `apps/portal` — Next.js 16, React 19, App Router                                                   |
| Backend         | Supabase (PostgreSQL + Auth + RLS)                                                                 |
| Package Manager | pnpm 9.15.9 (pinned via `packageManager` field)                                                    |
| Node Engine     | >=22 (a `volta` field pins 24.15.0, but Volta is NOT installed — see Environment)                  |
| Lint            | Biome + Stylelint + cspell + commitlint                                                            |
| Testing         | Jest 30 (unit), Playwright (e2e), Storybook a11y, DeepEval (AI)                                    |

---

## 2. ⚠️ Environment (this machine)

- Runtime is **mise-managed** (Node 26.8.1), not Volta. The `volta` field in `package.json` is inert here.
- **`pnpm` history note:** until 2026-09-25, `pnpm` hung in this repo (its version-switch step stalled against the `pnpm@9.15.9` pin, so `pnpm dev`/`build`/`test`/`quality` never started). Verified working again on 2026-09-28 (`pnpm -v` → `9.15.9`, instant). If a `pnpm` invocation ever produces no output within seconds, kill it rather than waiting; the `Makefile` targets or direct `node`/`turbo` invocations are the fallback.
- `nx`, `turbo`, `knip`, `cspell`, and `syncpack` are devDependencies, not global binaries — they run through `pnpm`.
- `packages/eval` is fully managed via `uv` (Python 3.12, DeepEval, pytest). Run tests via `cd packages/eval && uv run pytest`.

---

## 3. Common Commands

### Development

```bash
pnpm dev              # Full dev system (scripts/dev-system-reimagined.sh)
pnpm dev:quick        # Headless quick boot (no Docker)
pnpm dev:turbo        # Portal dev via Turborepo
pnpm dev:tools        # Docker tools stack (AI, Redis, analytics) + dev
pnpm dev:ai           # AI tools Docker stack only
pnpm redis:up         # Standalone Redis (compose.redis.yml, UI on :5540)
pnpm monitor:grafana  # Monitoring stack (infra/monitoring/docker-compose.yml)
```

The portal dev server binds `0.0.0.0:3000` (field-terminal LAN access).

### Build & Quality

```bash
pnpm build            # sync-assets + generate-openapi-spec + turbo run build
pnpm type-check       # tsc --noEmit across workspace
pnpm lint             # turbo run lint (Biome in portal)
pnpm quality          # Full gate: lint+type-check+test+tokens+css, then styles,
                      # css-perf, spelling, deps:lint, knip, policy:check,
                      # audit:compliance, html:check, verify:gates
pnpm knip             # Dead-code detection (knip:fix to auto-remove)
pnpm deps:lint        # Dependency version consistency (syncpack)
make help             # Makefile: docker stacks + dash-named aliases (dev, build, test…)
```

### Testing

```bash
pnpm test                     # All unit tests via turbo
pnpm --filter portal test     # Portal unit tests only
pnpm --filter portal test -- --testPathPatterns="<name>"   # Single test file
pnpm test:e2e                 # Playwright (requires portal on :3000 + Chromium)
pnpm test:e2e:visual          # Theme smoke snapshots only
pnpm test:a11y                # Storybook a11y
pnpm audit:browser            # Closed-loop browser, devtools & accessibility probe
pnpm audit:perf               # Headless Lighthouse performance and speed index audit
pnpm turbo run test --filter=...[HEAD~1]   # Only tests affected by last commit
```

Jest coverage thresholds (portal, global): lines 40%, branches 30%, functions 30%, statements 40%.

### Database & Migrations

```bash
pnpm --filter @repo/database db:types    # Regenerate packages/supabase/src/database.types.ts
pnpm db:seed                             # Seed cloud dev database
pnpm --filter @repo/database supabase:start   # Start local Supabase (migrations from @repo/database/migrations)
pnpm --filter @repo/database supabase:reset   # Reset local database
pnpm --filter @repo/database check-migrations  # Lint migrations + verify tree consolidation
pnpm audit:drift                              # Database↔contract parity check
pnpm audit:rls                                # RLS coverage audit
```

### Agent Verification & Toolchain Onboarding

```bash
pnpm agent:verify     # Unified verification — must exit 0 before completing any task
pnpm mcp:verify       # Verify all 7 agent runtimes have required MCP servers registered
pnpm mcp:onboard      # Provision and synchronize missing MCP server configurations
pnpm verify:gates     # 4-gate reality enforcement (ARWR, tests, modernization, strict TS)
pnpm audit:compliance # Full compliance audit suite
```

---

## 4. Repository Layout

```
apps/portal/           # Next.js 16 App Router (main application)
packages/*             # agents, contract, database, errors, eval, logger,
                       # rate-limiter, redis, supabase, theme, typescript-config, ui, utils
libs/features/         # auth/ departments/ hub/
libs/shared/           # data-access/ hooks/ utils/
services/integrations/ # Third-party API clients (OpenRouter, Cohere, n8n)
tools/                 # Audits, policy compiler, swarm orchestrator, scripts
infra/docker/          # compose.{tools,redis,dashboards,ai-tools}.yml
e2e/ k6/ tests/       # Playwright, load tests
docs/                  # Hand-authored engineering docs — canonical reference
documentation/         # Tool-written operational center (audit suites write here)
.agents/               # ← THIS DIRECTORY: unified agent governance
```

### .agents/ Directory Structure

```
.agents/
├── GUIDE.md              # THIS FILE — unified operational guide
├── README.md             # Governance overview
├── a2a/                  # Agent-to-Agent protocol (SPEC, registry, bus, schemas)
├── agents/               # Specialist agent definitions (35+ agent cards)
├── bin/                  # Agent binary entrypoints
├── corpos/               # Arch-CorpOS autonomous business loops
├── hooks/                # Lifecycle hooks (pre-invocation, pre-tool, post-tool, worktree)
├── hooks.json            # Hook registry
├── loops/                # Background watchdog loops
├── memory_base/          # Cross-session memory (retrospectives, knowledge graph)
├── mcp_config.json       # MCP server configuration
├── plans/                # Active planning artifacts
├── reports/              # Generated audit reports
├── rules/                # Permanent engineering rules (21 rule files)
├── run-manifests/        # Reproducibility manifests
├── skills/               # 60+ agent skills (SKILL.md + scripts + resources)
└── skills.json           # Skill registry
```

---

## 5. Architecture — Key Concepts

### Request Flow

`apps/portal/proxy.ts` is the Edge middleware (Next.js 16 renamed `middleware.ts` → `proxy.ts`; there is no `middleware.ts`). It handles session validation, employee role/department resolution, and security headers. Server Actions must call `createServerSupabaseClient()` and validate the user on the first line.

### Portal Routing

App Router groups: `(auth)/`, `(departments)/[department]/`, `hub/`, `admin/`, `api/`, `overview/`. Static department sub-pages must export their own `layout.tsx` re-exporting `DepartmentLayout`. Path aliases `@/*` and `~/*` both resolve to `apps/portal/*`.

### Codegen Pipelines — Never Edit Generated Output

| Source                          | Command                                 | Generated Output                               |
| ------------------------------- | --------------------------------------- | ---------------------------------------------- |
| `packages/theme/tokens.json`    | `pnpm --filter @repo/theme build`       | `src/tokens/generated.ts`, `src/css/index.css` |
| `packages/database/migrations/` | `pnpm --filter @repo/database db:types` | `packages/supabase/src/database.types.ts`      |

### Policy Single Source of Truth

`tools/repo/policy-compiler.cjs` generates `tools/repo/policy/*.json`. Never hand-edit generated files. After adding a new project or changing dependencies: edit `DEPENDENCY_RULES` in the compiler, run `pnpm policy:gen`, and commit generated files with the change.

### Migrations & RLS

- `packages/database/migrations/NNN_description.sql` is the **single source of truth**. `packages/supabase/migrations/` and `packages/database/supabase/migrations/` are **symlinks** to it (enforced by `pnpm check-migrations`/`sync-migrations`) — never replace them with real directories, and never edit a "copy".
- Every new table must `ENABLE ROW LEVEL SECURITY`.
- Pause for human review before merging any DB schema, RLS, or auth change.

---

## 6. Conventions & Rules

### Code Style

- **TypeScript strict.** No `any`, no `@ts-ignore`. Use `unknown` + type guards or Zod at boundaries.
- **Light mode only.** No `dark:` classes. Use semantic OKLCH tokens from `@repo/theme` — never raw hex/OKLCH values.
- **Shadows:** tokenized only (`shadow-card`, `shadow-window`, `shadow-diffusion-*`). Raw `box-shadow`/Tailwind `shadow-*` are forbidden.
- **Cards:** use `<GlassCard>`. `SpotlightCard`/`GlowBorderCard` are removed.
- **Animations:** only `opacity`, `transform`, `background-color`, `border-color`, `color`; easing `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Icons:** named imports from `lucide-react` — never `import * as Icons`.
- **Logging:** `@repo/logger` only — never `console.log` in production code.

### Architectural Boundaries

- `apps/portal` must not import DB internals directly; go through `@repo/supabase`.
- `packages/contract` is the canonical Zod schema source — never hand-edit generated types.
- Public package APIs export strictly from `src/index.ts`.
- New runtime dependencies require written justification and human sign-off.

### Testing Gotchas

- `apps/portal/jest.config.cjs` uses an explicit `moduleNameMapper`. **When you add a new `@repo/*` import or subpath export, add an explicit mapping** or portal tests will fail to resolve it.
- Co-locate unit tests as `*.test.ts(x)`. Unit tests need no Supabase; E2E does.
- Mock at the network boundary (Supabase, Redis), not at function calls.
- Bugfixes require a reproducing test that fails without the fix.

### Git

- Conventional commits (commitlint + Husky enforce them; lint-staged runs on commit, lint + type-check on push). Never use `--no-verify`.
- One commit per task; no amend/force-push without permission.

### Agent Tracing

- Read the affected package's `AGENT_TRACER.md` before editing; update it after changes.
- Add `// AGENT-TRACE:` breadcrumbs for non-obvious logic.
- Instrument new service paths with OpenTelemetry / prom-client where applicable.

---

## 7. Debugging Tips

- **Type errors after migration**: regenerate types (`pnpm --filter @repo/database db:types`).
- **RLS issues**: `pnpm audit:rls`.
- **Design violations**: `pnpm audit:design` or `pnpm lint:tokens`.
- **Jest can't resolve a workspace import**: add it to `moduleNameMapper` (§ Testing gotchas).
- **Policy drift failure**: run `pnpm policy:gen`, inspect the diff, commit generated files with the source change.
- **Cache issues**: `pnpm clean:caches` (`status:caches` to inspect).
- **Auth not working**: check `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_KEY` in `apps/portal/.env`.

---

## 8. Environment Files

- Portal env: `apps/portal/.env` (copy from `apps/portal/env/.env.example`).
- Root `.env` is tooling (Docker, monitoring, AI providers); `.env.tools` for the tools stack.
- Full reference: `docs/ENVIRONMENT_FILES_GUIDE.md`.

---

## 9. Agent Governance — Hard Stops

These hard stops are **always in force**, with no approval path:

- No edits to secrets, credentials, or key material.
- No force-push, history rewrite, or branch deletion.
- No disabling, skipping, or weakening tests, linters, or gates.
- No production data access from agent context.
- No writes outside the declared `allow:` list.
- No new runtime dependency without approval.
- No edits to CI/CD pipelines without Tier 2 approval.
- No silent retries on destructive operations.

### Halt and Escalate When

- A denylist action is required or rule conflict is unresolvable.
- Cost ceiling reached or 2 consecutive validation failures occur.
- Plan touches deny path or Tier 2 change lacks second reviewer.

---

## 10. Cross-References

| Resource                       | Location               | Purpose                                                                    |
| :----------------------------- | :--------------------- | :------------------------------------------------------------------------- |
| **Architecture & Domain SSoT** | `AGENTS.md` (root)     | Full architecture, data flow, personas, invariants, SSoT table             |
| **skills-mcp Registry**        | `skills-mcp/`          | Anti-bloat on-demand skill, context, and persona registry (MCP stdio)      |
| **Engineering Rules**          | `.agents/rules/`       | 22 permanent rule files covering security, verification, testing, thinking |
| **Agent Skills**               | `skills-mcp/` / `.agents/skills/` | 60+ reusable workflow skills (dynamically leased via `acquire_skill`) |
| **Agent Cards & Personas**     | `skills-mcp/` / `.agents/agents/` | 35+ specialist agent definitions (queried via `list_available_personas`) |
| **A2A Protocol**               | `.agents/a2a/SPEC.md`  | Agent-to-Agent communication protocol                                      |
| **Memory Base**                | `.agents/memory_base/` | Cross-session error retrospectives and knowledge graph                     |
| **CorpOS Loops**               | `.agents/corpos/`      | Autonomous business loop engine                                            |
| **Lifecycle Hooks**            | `.agents/hooks/`       | Pre/post tool guards and tracing                                           |

Last updated: 2026-10-06
