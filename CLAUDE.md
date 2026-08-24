# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Arch-Systems (Plantcor) is a multi-departmental mining operations portal built as an **Nx 22 + pnpm** monorepo. It serves authenticated, department-specific dashboards (drilling, production, access control, engineering, control room, safety, training, satellite monitoring).

## Environment

- **Node** `>=22` (Volta pins `24.15.0`), **pnpm** `9.15.9`, ESM (`"type": "module"`).
- Docker required for local Supabase. Husky hooks install on `pnpm install`.

## Common commands

```bash
pnpm install
cp apps/portal/env/.env.example apps/portal/.env          # fill Supabase + Sentry keys
pnpm --filter @repo/database supabase:dev                 # local Postgres + Auth (:54321), separate terminal
pnpm dev                                                  # portal on :3000 (scripts/dev.sh)
pnpm quality                                              # full quality gate — run before push
```

| Action | Command |
| --- | --- |
| Build all | `pnpm build` |
| Build one project | `pnpm nx build <name>` or `pnpm --filter @repo/<name> build` |
| Lint all / one | `pnpm lint` · `pnpm nx lint <name>` |
| Type-check all / one | `pnpm type-check` · `pnpm nx type-check <name>` |
| All unit tests | `pnpm test` |
| Single portal test file | `pnpm --filter portal test -- --testPathPatterns=<file>` |
| E2E (needs portal on :3000) | `pnpm test:e2e` |
| Visual E2E snapshots | `pnpm test:e2e:visual` |
| Storybook | `pnpm ui` |
| Storybook a11y | `pnpm test:a11y` |
| Format | `pnpm format` |
| Deploy (local/staging/production) | `pnpm deploy:local` / `:staging` / `:production` |

Prefer `pnpm nx run` / `nx run-many` over invoking underlying tools directly.

### `pnpm quality` runs

`nx run-many -t lint type-check test lint:tokens lint:css`, then `lint:root`, `lint:styles`, `lint:css-perf`, `lint:spelling`, `format:check`, `deps:lint` (syncpack), `knip`, `policy:check`, `audit:suite`, `html:check`. Jest enforces coverage thresholds: lines 40%, branches 30%, functions 35%, statements 40%.

## Architecture

### Apps (`apps/`)
- **`portal`** — Next.js 15+ App Router, React 19. Server Actions and API routes co-located with features. `:3000`. Middleware lives in `apps/portal/proxy.ts` (session refresh, department slug → UUID resolution via Redis cache, route gating).
- **`cms`** — Payload CMS v3, headless content service.
- **`overview`** — standalone architecture-visualization app (React Flow).
- **`ci-observer`** — CI observation helper.

### Packages (`packages/`)
`theme`, `ui`, `supabase`, `database`, `redis`, `utils`, `errors`, `types`, `eval`, `agents`, `contract`, `logger`, `rate-limiter`, `eslint-config`, `typescript-config`.

### Portal routing
App Router groups: `(auth)/` (login, reset/update password), `(departments)/[department]/` (dynamic per-department dashboards with sub-pages like `shift-compilation`, `satellite`, `machines`, `reports`), `(hub)/`, `admin/`. Static department sub-pages must export their own `layout.tsx` re-exporting `DepartmentLayout`.

Path aliases: `~/*` and `@/*` both resolve to `apps/portal/*`. Conventional sub-cuts: `@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*`.

### Database & authorization
- Supabase/Postgres. The **`employees` table is the source of truth for authorization** (role + department).
- Every new table must `ENABLE ROW LEVEL SECURITY`. RLS policies should consult `employees.role` and `employees.department_id`, not `auth.uid()` alone.
- Migrations source of truth: `packages/database/migrations/NNN_description.sql` (zero-padded). **Never edit `packages/supabase/supabase/migrations/`** — it's a deploy-time copy (a PreToolUse hook blocks edits there).
- Migration workflow: add migration → `pnpm --filter @repo/database supabase:push` → `pnpm --filter @repo/database supabase:gen` → commit migration **and** regenerated `packages/supabase/src/database.types.ts` atomically.
- SQL privilege-escalation and index-coverage tests live in `packages/database/tests/`.

### Policy & dependency constraints (Single Source of Truth)
`tools/policy-compiler.cjs` generates `tools/policy/*.json` and `tools/eslint-boundaries.generated.cjs`. Edit the compiler, then run `pnpm policy:gen`; CI runs `pnpm policy:check` and fails on drift. `nx.json` enforces `scope:app` → `scope:package` constraints. Run `node tools/apply-project-tags.cjs` after adding a new project.

### Codegen — never edit generated output
| Pipeline | Source | Generate |
| --- | --- | --- |
| Design tokens | `packages/theme/tokens.json` + `src/css/variables.css` | `pnpm --filter @repo/theme build` → `src/tokens/generated.ts`, `variables-generated.css` |
| DB types | `packages/database/migrations/` | `supabase:push` → `supabase:gen` → `packages/supabase/src/database.types.ts` |

Commit source and generated files in the same atomic change.

## Conventions

### Package management
- Workspace-wide catalogs live in `pnpm-workspace.yaml`. Use `catalog:` or `catalog:react19` for shared deps.
- New packages: name `@repo/<name>`, export public API from `src/index.ts`, add a `project.json`, tag via `node tools/apply-project-tags.cjs`, add a `DEPENDENCY_RULES` entry in `tools/policy-compiler.cjs`, then `pnpm policy:gen`.

### TypeScript & code style
- Strict TS. No `any`, no `// @ts-ignore`. Use `unknown` + type guards or Zod at boundaries.
- Server Actions must call `createServerSupabaseClient()` and validate the user on line one.
- Conventional commits enforced by commitlint; Husky `commit-msg` rejects non-conforming messages.

### Design system (`@repo/theme`)
- Light theme only (`data-theme="light"`). No dark mode.
- Use semantic tokens from `@repo/theme` — never hardcode OKLCH/hex colors.
- Forbidden: raw `box-shadow` and Tailwind `shadow-*`. Use tokenized shadows (`shadow-card`, `shadow-window`, `shadow-diffusion-*`).
- Merge classes with `cn()` from `@repo/ui/lib/utils`.
- Named icon imports only: `import { Drill } from "lucide-react"` (never `import * as Icons`).
- Animate only `opacity`, `transform`, `background-color`, `border-color`, `color`. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Standard glass surface: `bg-white/70 backdrop-blur-xl border border-black/[0.08]`.

### Tests
- Co-locate unit tests as `*.test.ts(x)`. E2E lives in `e2e/`.
- Unit tests do not need Supabase; E2E does. Mock at the network boundary (Supabase, Redis), not at function calls.
- `apps/portal/jest.config.js` uses explicit `moduleNameMapper` entries — add an explicit mapping for any new `@repo/*` import or subpath export.

### Agent tracing (mandatory for every code change)
1. Read the affected package's `AGENT_TRACER.md` before editing; update it after every change (ISO 8601 timestamp, purpose, changes, handoff).
2. Add `// AGENT-TRACE:` breadcrumbs for non-obvious logic.
3. Instrument new service paths with OpenTelemetry / prom-client where applicable.

### Git
- One commit per task. No amend/force-push without permission. Never `--no-verify`.
- Husky runs lint-staged on commit and lint + type-check on push — do not bypass hooks.
- **Pause for human review before merging any DB schema, RLS, or auth/authorization change.**

## Heuristics
- Small targeted edits (≤5 files) can be done directly; larger cross-cutting changes should be planned and validated with `pnpm quality`.
- When adding a new `@repo/*` import to portal code, update `apps/portal/jest.config.js` `moduleNameMapper`.
- When adding a new project, run `node tools/apply-project-tags.cjs` and update `tools/policy-compiler.cjs`.
- If `pnpm policy:check` fails, run `pnpm policy:gen`, inspect the diff, and commit generated files atomically with the source change.

## Further reading
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — full contributor guide, quality gates, new-package workflow, troubleshooting.
- [`AGENTS.md`](AGENTS.md) → `docs/AGENTS.md` — agent contracts, workflow phases, quality gates.
- [`DESIGN.md`](DESIGN.md) → `docs/DESIGN.md` — color system, typography, components, animation.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) · [`SECURITY.md`](SECURITY.md) · [`PRODUCT.md`](PRODUCT.md) — all symlinked into `docs/`.
- [`documentation/`](documentation/) — unified docs center: audit reports, codebase maps, wiki.