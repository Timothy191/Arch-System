# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `poetry` is not installed, which blocks `packages/eval` (Python/DeepEval).

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

The portal dev server binds `0.0.0.0:3000` (field-terminal LAN access) and runs **webpack**, not Turbopack (`next dev -H 0.0.0.0 --webpack`).

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
pnpm turbo run test --filter=...[HEAD~1]   # Only tests affected by last commit
```

Jest coverage thresholds (portal, global): lines 40%, branches 30%, functions 30%, statements 40%.

### Database & Migrations

```bash
pnpm --filter @repo/database db:types    # Regenerate packages/supabase/src/database.types.ts
pnpm db:seed                             # Seed cloud dev database
pnpm db:schema-reload                    # Reload schema cache
pnpm audit:rls                           # RLS policy audit
pnpm audit:rls-matrix                    # RLS coverage matrix
```

### Policy & Audits

```bash
pnpm policy:gen       # Regenerate tools/repo/policy/* from policy-compiler.cjs (the SSoT)
pnpm policy:check     # Fail on drift between compiler and committed generated files
pnpm audit:suite      # Full compliance audit
pnpm audit:design     # Design-token compliance
pnpm audit:drift      # API contract drift
pnpm maps:gen         # Mermaid codebase maps
```

### Deployment

```bash
pnpm deploy:local | deploy:staging | deploy:production   # scripts/deploy.sh
pnpm deploy:rollback                                     # Last production deploy
```

---

## 4. Workspace Layout

```
apps/portal/           # The only app. Next.js 16 App Router.
packages/              # @repo/* packages (below)
libs/features/         # Domain feature slices — each feature has ui/ + data-access/:
  auth/ departments/ hub/
libs/shared/           # data-access/ hooks/ utils/
services/integrations/ # Third-party API clients (OpenRouter, Cohere, n8n)
tools/                 # Audits, policy compiler, swarm orchestrator, scripts
scripts/               # Dev/deploy scripts; scripts/seeds (db seeding)
infra/docker/          # compose.{tools,redis,dashboards,ai-tools}.yml
infra/monitoring/      # Grafana/Prometheus/OTel compose
e2e/ k6/ tests/       # Playwright, load tests
docs/                  # Hand-authored engineering docs (DESIGN, DEPLOYMENT, runbooks) — canonical reference
documentation/         # Tool-written operational center (audit suites write 03-audit-reports/ here)
                       # Keep the boundary: humans edit docs/, tools write documentation/ — do not merge them
```

**Workspace packages (`packages/*`):** `agents`, `contract` (Zod schemas — canonical data shapes), `database` (SQL migrations — source of truth), `errors`, `eval` (DeepEval, Python), `logger` (Pino), `rate-limiter` (DI-based; does NOT depend on `@repo/redis`), `redis`, `supabase` (clients + Kysely), `theme` (OKLCH tokens), `typescript-config`, `ui` (Radix/shadcn; GlassCard, KPI, DepartmentLayout), `utils` (Novu, Inngest, Excel).

`libs/` slices are consumed via `@repo/`-style aliases: `@repo/auth/ui`, `@repo/departments/ui`, `@repo/shared/utils`, etc. (see `apps/portal/package.json` dependencies).

**Catalogs:** shared dependency versions live in `pnpm-workspace.yaml` under `catalog:` and `catalogs:react19`. Use `catalog:` / `catalog:react19` instead of repeating version ranges.

---

## 5. Architecture — the parts that span files

### Request flow

`apps/portal/proxy.ts` is the Edge middleware (Next.js 16 renamed `middleware.ts` → `proxy.ts`; there is no `middleware.ts`). It handles session validation, employee role/department resolution, and security headers. Server Actions must call `createServerSupabaseClient()` and validate the user on the first line.

### Portal routing

App Router groups: `(auth)/`, `(departments)/[department]/`, `hub/`, `admin/`, `api/`, `overview/` (architecture visualization). Static department sub-pages must export their own `layout.tsx` re-exporting `DepartmentLayout`. Path aliases `@/*` and `~/*` both resolve to `apps/portal/*`.

### Codegen pipelines — never edit generated output

| Source                          | Command                                 | Generated output                               |
| ------------------------------- | --------------------------------------- | ---------------------------------------------- |
| `packages/theme/tokens.json`    | `pnpm --filter @repo/theme build`       | `src/tokens/generated.ts`, `src/css/index.css` |
| `packages/database/migrations/` | `pnpm --filter @repo/database db:types` | `packages/supabase/src/database.types.ts`      |

Commit source and generated files atomically. The `turbo` `codegen` task runs the theme token generation (`scripts/generate-tokens.mjs` + Style Dictionary `sd.config.mjs`).

### Policy Single Source of Truth

`tools/repo/policy-compiler.cjs` generates `tools/repo/policy/*.json` and `tools/repo/policy/eslint-boundaries.generated.cjs` (architecture, dependency, and security rules). Never hand-edit the generated files. After adding a new project or changing allowed dependencies: edit `DEPENDENCY_RULES` in the compiler, run `pnpm policy:gen`, and commit generated files with the change. CI runs `pnpm policy:check` and fails on drift.

### Migrations & RLS

- `packages/database/migrations/NNN_description.sql` (zero-padded, currently 119 files) is the source of truth. **Never edit `packages/supabase/supabase/migrations/`** — it is a deploy-time copy (a PreToolUse hook blocks edits there).
- Workflow: add migration → apply to cloud Supabase → `pnpm --filter @repo/database db:types` → commit migration + regenerated types together.
- Every new table must `ENABLE ROW LEVEL SECURITY`. RLS policies consult `employees.role` / `employees.department_id`, not `auth.uid()` alone. Privilege-escalation and index-coverage tests live in `packages/database/tests/`.
- Pause for human review before merging any DB schema, RLS, or auth change.

### Background engines

Inngest event workflows (`@repo/utils/inngest`, `pnpm inngest:dev`), Arch-CorpOS autonomous loops (`.agents/corpos/bin/corpos`), and Rust Tokio swarms (`tools/swarms-orchestrator`).

---

## 6. Conventions & Rules

### Code style

- **TypeScript strict.** No `any`, no `@ts-ignore`. Use `unknown` + type guards or Zod at boundaries.
- **Light mode only.** No `dark:` classes. Use semantic OKLCH tokens from `@repo/theme` — never raw hex/OKLCH values.
- **Shadows:** tokenized only (`shadow-card`, `shadow-window`, `shadow-diffusion-*`). Raw `box-shadow`/Tailwind `shadow-*` are forbidden (a stylelint rule enforces this).
- **Cards:** use `<GlassCard>`. `SpotlightCard`/`GlowBorderCard` are removed.
- **Animations:** only `opacity`, `transform`, `background-color`, `border-color`, `color`; easing `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Icons:** named imports from `lucide-react` — never `import * as Icons`.
- **Logging:** `@repo/logger` only — never `console.log` in production code.

### Architectural boundaries

- `apps/portal` must not import DB internals directly; go through `@repo/supabase`.
- `packages/contract` is the canonical Zod schema source — never hand-edit generated types.
- Public package APIs export strictly from `src/index.ts`.
- New runtime dependencies require written justification and human sign-off.

### Testing gotchas

- `apps/portal/jest.config.cjs` uses an explicit `moduleNameMapper`. **When you add a new `@repo/*` import or subpath export, add an explicit mapping** or portal tests will fail to resolve it.
- Co-locate unit tests as `*.test.ts(x)`. Unit tests need no Supabase; E2E does.
- Mock at the network boundary (Supabase, Redis), not at function calls.
- Bugfixes require a reproducing test that fails without the fix.

### Git

- Conventional commits (commitlint + Husky enforce them; lint-staged runs on commit, lint + type-check on push). Never use `--no-verify`.
- One commit per task; no amend/force-push without permission.

### Agent tracing

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

## 8. Environment Files

- Portal env: `apps/portal/.env` (copy from `apps/portal/env/.env.example`).
- Root `.env` is tooling (Docker, monitoring, AI providers); `.env.tools` for the tools stack.
- Full reference: `docs/ENVIRONMENT_FILES_GUIDE.md`.

## 9. Agent Workflow Rules

`AGENTS.md` (root, 575 lines) holds the domain description, personas, and architecture narrative; `CONTRIBUTING.md` documents the CI quality gates and the add-a-package workflow. `.cursorrules` is an agent constitution whose hard stops are in-force here:

- No edits to secrets, credentials, or key material; no production data access from agent context.
- No force-push, history rewrite, or branch deletion.
- No disabling, skipping, or weakening tests, linters, or gates — and no silent retries on destructive operations.
- Non-trivial changes (multi-file, new dep, schema/API change) require a written plan before code; trivial is ≤1 file, ≤30 LOC, no new dep.

Last updated: 2026-09-28
