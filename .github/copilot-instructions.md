# Copilot Instructions for Arch-System

Concise, repository-specific guidance for Copilot-style assistants and automated agents working in this Turborepo + pnpm monorepo. `CLAUDE.md` (technical reference) and `AGENTS.md` (domain and architecture narrative) are the authoritative sources; this file is a thin index into them.

---

## 1) Build, test and lint commands

All tasks run through Turborepo (`turbo run`). pnpm `9.15.9` is pinned via the `packageManager` field in root `package.json`; the `volta` block pins Node `24.15.0` (any Node ≥22 works).

| Action                                   | Command                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Install deps                             | `pnpm install`                                                                           |
| Dev server (portal on `0.0.0.0:3000`)    | `pnpm dev`                                                                               |
| Minimal dev server (headless, no Docker) | `pnpm dev:quick`                                                                         |
| Database type generation                 | `pnpm --filter @repo/database db:types`                                                  |
| Build all                                | `pnpm build`                                                                             |
| Build one project                        | `pnpm --filter @repo/<name> build` or `pnpm turbo run build --filter=<name>`             |
| Lint all                                 | `pnpm lint` (Biome in portal; Stylelint/cspell via `pnpm lint:styles` / `lint:spelling`) |
| Type-check all                           | `pnpm type-check`                                                                        |
| Run all unit tests                       | `pnpm test`                                                                              |
| Run one portal test file                 | `pnpm --filter portal test -- --testPathPatterns=<file>`                                 |
| Run E2E                                  | `pnpm test:e2e` (requires portal dev server on `:3000` and Chromium)                     |
| Full local quality gate                  | `pnpm quality`                                                                           |
| Format code                              | `pnpm format`                                                                            |

`pnpm quality` runs: `turbo run lint type-check test lint:tokens lint:css`, then `lint:styles`, `lint:css-perf`, `lint:spelling`, `deps:lint` (syncpack), `knip`, `policy:check`, `audit:compliance`, `html:check`, `verify:gates`. Run it before proposing a merge.

Coverage thresholds (portal Jest, global): lines 40%, branches 30%, functions 30%, statements 40%.

---

## 2) High-level architecture

- **Monorepo**: pnpm workspaces + Turborepo 2.x (`turbo run` is the entry point; `turbo.json` orchestrates the pipeline).
- **Single app**: `apps/portal` — Next.js 16 (App Router), React 19. Server Actions and API routes co-located with features. `/overview` (React Flow visualization) is a portal route.
- **Feature slices**: `libs/features/<name>/{ui,data-access}` (auth, departments, hub) and `libs/shared/{data-access,hooks,utils}`, consumed via `@repo/<feature>/ui`-style aliases.
- **Packages**: `contract` (canonical Zod schemas), `database` (migrations — source of truth), `supabase` (clients + Kysely + generated types), `theme`, `ui`, `redis`, `rate-limiter` (DI-based, does not depend on `@repo/redis`), `logger`, `errors`, `eval`, `agents`, `utils`, `typescript-config`.
- **Middleware**: `apps/portal/proxy.ts` (Next.js 16's renamed `middleware.ts`) handles session refresh, department slug → UUID resolution (Redis cached), and route gating.
- **Database**: Supabase/Postgres. The `employees` table is the source of truth for authorization (role + department). RLS must be enabled on every new table.
- **Policy SSoT**: `tools/repo/policy-compiler.cjs` generates `tools/repo/policy/*.json` and `eslint-boundaries.generated.cjs`. Edit the compiler, run `pnpm policy:gen`; CI's `pnpm policy:check` fails on drift.

### Codegen pipelines (never edit generated output)

| Source                          | Command                                 | Generated output                                              |
| ------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `packages/theme/tokens.json`    | `pnpm --filter @repo/theme build`       | `packages/theme/src/tokens/generated.ts`, `src/css/index.css` |
| `packages/database/migrations/` | `pnpm --filter @repo/database db:types` | `packages/supabase/src/database.types.ts`                     |

Commit both source and generated files in the same atomic change.

---

## 3) Key repository conventions

- Workspace-wide catalogs live in `pnpm-workspace.yaml`. Use `catalog:` or `catalog:react19` for shared dependencies.
- New packages must be named `@repo/<name>`, export a public API from `src/index.ts`, and get a `DEPENDENCY_RULES` entry in `tools/repo/policy-compiler.cjs` (then `pnpm policy:gen`).
- App Router groups: `(auth)/`, `(departments)/[department]/`, `hub/`, `admin/`. Static department sub-pages export their own `layout.tsx` re-exporting `DepartmentLayout`.
- Path aliases `@/*` and `~/*` both resolve to `apps/portal/*`.

### Design system (`@repo/theme`)

- Light theme only. No dark mode.
- Semantic OKLCH tokens only — never hardcode colors.
- Forbidden: raw `box-shadow` and Tailwind `shadow-*`. Use tokenized shadows (`shadow-card`, `shadow-window`, `shadow-diffusion-*`).
- Merge classes with `cn()` from `@repo/ui/lib/utils`.
- Named icon imports from `lucide-react` — never `import * as Icons`.
- Animate only `opacity`, `transform`, `background-color`, `border-color`, `color`. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.

### TypeScript and code style

- Strict TypeScript. No `any`, no `// @ts-ignore`. Use `unknown` + type guards or Zod at boundaries.
- Server Actions must call `createServerSupabaseClient()` and validate the user on line one.
- Conventional commits enforced by commitlint + Husky. Never bypass hooks (`--no-verify`).

### Tests

- Co-locate unit tests as `*.test.ts(x)`. E2E lives in `e2e/`.
- Unit tests do not need Supabase; E2E does.
- `apps/portal/jest.config.cjs` uses explicit `moduleNameMapper` entries. Add explicit mappings for any new `@repo/*` import or subpath export.
- Mock at the network boundary (Supabase, Redis), not at the function call.

### Database and RLS

- Migration files: zero-padded `NNN_description.sql` in `packages/database/migrations/`. Never edit `packages/supabase/supabase/migrations/` (deploy-time copy; a hook blocks edits there).
- Workflow: add migration → apply to cloud Supabase → `pnpm --filter @repo/database db:types` → commit migration + regenerated `database.types.ts` atomically.
- Every new table must `ENABLE ROW LEVEL SECURITY`. Policies consult `employees.role` / `employees.department_id`, not `auth.uid()` alone.
- Pause for human review before merging any DB schema, RLS, or auth change.

### Agent tracing

1. Read the affected package's `AGENT_TRACER.md` before editing; update it after every change.
2. Add `// AGENT-TRACE:` breadcrumbs for non-obvious logic.
3. Instrument new service paths with OpenTelemetry / prom-client where applicable.

### Git

- One commit per task; no amend/force-push without permission; never `--no-verify`.
- Husky runs lint-staged on commit and lint + type-check on push.

---

## 4) Quick heuristics for automated changes

- Small, targeted edits (≤5 files) can be done directly. Larger cross-cutting changes should be planned and validated with `pnpm quality`.
- For DB migrations, RLS changes, and auth changes: stop and request explicit human confirmation.
- When adding a new `@repo/*` import to portal code, update `apps/portal/jest.config.cjs` `moduleNameMapper`.
- When adding a new project, add a `DEPENDENCY_RULES` entry to `tools/repo/policy-compiler.cjs` and run `pnpm policy:gen`.
- If `pnpm policy:check` fails, run `pnpm policy:gen`, inspect the diff, and commit generated files atomically with the source change.
- Prefer `turbo run` over invoking underlying tools directly; prefix with `pnpm turbo run` (e.g., `pnpm turbo run build --filter=portal`).

---

(Prepared from `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`, `package.json`, and `pnpm-workspace.yaml`. Last verified 2026-09-28.)
