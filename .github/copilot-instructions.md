# Copilot instructions for Arch-Mk2

Concise, repository-specific guidance for Copilot-style assistants and automated agents working in this Nx + pnpm monorepo. For deeper rules, consult the authoritative docs listed in section 5.

---

## 1) Build, test and lint commands

All tasks run through Nx (`nx run-many`). Use pnpm as the package manager (Volta pins `node@24.15.0` and `pnpm@9.15.9`).

### Daily commands

| Action                                     | Command                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Install deps                               | `pnpm install`                                                         |
| Dev server (portal on `:3000`)             | `pnpm dev`                                                             |
| Minimal dev server                         | `pnpm dev:minimal`                                                     |
| Bootstrap everything                       | `pnpm dev:up --all` (`--quick`, `--tools`, `--cms`, `--overview`)      |
| Local Supabase (Docker, separate terminal) | `pnpm --filter @repo/database supabase:dev`                            |
| Build all                                  | `pnpm build`                                                           |
| Build one package/app                      | `pnpm --filter @repo/<name> build` or `pnpm nx build <name>`           |
| Lint all                                   | `pnpm lint`                                                            |
| Lint one project                           | `pnpm --filter @repo/<name> lint` or `pnpm nx lint <name>`             |
| Type-check all                             | `pnpm type-check`                                                      |
| Type-check one project                     | `pnpm --filter @repo/<name> type-check` or `pnpm nx type-check <name>` |
| Run all unit tests                         | `pnpm test`                                                            |
| Run one portal test file                   | `pnpm --filter portal test -- --testPathPatterns=<file>`               |
| Run E2E                                    | `pnpm test:e2e` (requires portal dev server on `:3000` and Chromium)   |
| Visual E2E snapshots                       | `pnpm test:e2e:visual`                                                 |
| Storybook UI / a11y                        | `pnpm ui`, `pnpm test:a11y`                                            |
| Format code                                | `pnpm format`                                                          |
| Full local quality gate                    | `pnpm quality`                                                         |

### What `pnpm quality` actually runs

```
nx run-many -t lint type-check test lint:tokens lint:css
pnpm lint:root
pnpm lint:styles
pnpm format:check
pnpm deps:lint       (syncpack)
pnpm knip            (dead-code detection)
pnpm policy:check    (SSoT drift + security checks)
pnpm audit:rls
pnpm audit:design
```

Run `pnpm quality` before proposing a merge.

### Coverage thresholds (enforced by Jest)

- Lines 40%, branches 30%, functions 35%, statements 40%.

---

## 2) High-level architecture

- **Monorepo**: pnpm workspaces + Nx 22 (`nx run-many` is the entry point; `nx.json` orchestrates the pipeline).
- **Apps**:
  - `apps/portal` — Next.js 15+ (App Router), React 19. Server Actions and API routes co-located with features. `:3000`.
  - `apps/cms` — Payload CMS v3 (headless content service).
  - `apps/overview` — Standalone architecture visualization app (React Flow).
  - `apps/ci-observer` — CI observation helper app.
- **Packages**: `theme`, `ui`, `supabase`, `database`, `redis`, `utils`, `errors`, `types`, `eval`.
- **Database**: Supabase/Postgres. The `employees` table is the source of truth for authorization (role + department). Row-Level Security must be enabled on every new table.
- **Middleware**: `apps/portal/proxy.ts` handles session refresh, department slug → UUID resolution (Redis cached), and route gating.
- **Migrations source of truth**: `packages/database/migrations/NNN_description.sql`. Never edit `packages/supabase/supabase/migrations/` (deploy-time copy; PreToolUse hook blocks edits there).
- **Policy Single Source of Truth**: `tools/policy-compiler.cjs` generates `tools/policy/*.json` and `tools/policy/eslint-boundaries.generated.cjs`. Edit the compiler, then run `pnpm policy:gen`; CI runs `pnpm policy:check` and fails on drift.
- **Dependency constraints**: `nx.json` enforces `scope:app` → `scope:package`, etc. Run `node tools/apply-project-tags.cjs` after adding a new project.

### Codegen pipelines (never edit generated output)

| Source                          | Command                                                                                   | Generated output                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/theme/tokens.json`    | `pnpm --filter @repo/theme build`                                                         | `packages/theme/src/tokens/generated.ts`, `variables-generated.css` |
| `packages/database/migrations/` | `pnpm --filter @repo/database supabase:push && pnpm --filter @repo/database supabase:gen` | `packages/supabase/src/database.types.ts`                           |

Commit both source and generated files in the same atomic change.

---

## 3) Key repository conventions

### Package management

- Workspace-wide catalogs live in `pnpm-workspace.yaml`. Use `catalog:` or `catalog:react19` for shared dependencies.
- New packages must be named `@repo/<name>`, export a public API from `src/index.ts`, have a `project.json`, and be tagged via `node tools/apply-project-tags.cjs`.
- New packages must also get a `DEPENDENCY_RULES` entry in `tools/policy-compiler.cjs`; regenerate with `pnpm policy:gen`.

### Portal routing and layout

- App Router groups: `(auth)/`, `(departments)/[department]/`, `(hub)/`, `admin/`.
- Static department sub-pages must export their own `layout.tsx` that re-exports `DepartmentLayout`.
- Path aliases: `~/*` and `@/*` both resolve to `apps/portal/*`. Conventional sub-cuts: `@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*`.

### Design system (`@repo/theme`)

- Light theme only (`data-theme="light"`). No dark mode.
- Use semantic tokens from `@repo/theme` — never hardcode OKLCH/hex colors.
- Forbidden: raw `box-shadow` and Tailwind `shadow-*`. Use tokenized shadows (`shadow-card`, `shadow-window`, `shadow-diffusion-*`).
- Merge classes with `cn()` from `@repo/ui/lib/utils`.
- Import icons as named imports: `import { Drill } from "lucide-react"`. Never `import * as Icons`.
- Animate only `opacity`, `transform`, `background-color`, `border-color`, `color`. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Standard glass surface: `bg-white/70 backdrop-blur-xl border border-black/[0.08]`.

### TypeScript and code style

- Strict TypeScript is on. No `any`, no `// @ts-ignore`. Use `unknown` + type guards or Zod at boundaries.
- Server Actions must call `createServerSupabaseClient()` and validate the user on line one.
- Conventional commits are enforced by commitlint; Husky `commit-msg` rejects non-conforming messages.

### Tests

- Co-locate unit tests as `*.test.ts(x)`. E2E lives in `e2e/`.
- Unit tests do not need Supabase; E2E does.
- `apps/portal/jest.config.js` uses explicit `moduleNameMapper` entries. Add explicit mappings for any new `@repo/*` import or subpath export.
- Mock at the network boundary (Supabase, Redis), not at the function call.

### Database and RLS

- Migration files: zero-padded `NNN_description.sql`.
- Workflow: add migration → `pnpm --filter @repo/database supabase:push` → `pnpm --filter @repo/database supabase:gen` → commit migration + regenerated `database.types.ts`.
- Every new table must `ENABLE ROW LEVEL SECURITY`.
- RLS policies should consult `employees.role` and `employees.department_id`, not `auth.uid()` alone.
- SQL privilege-escalation and index-coverage tests live in `packages/database/tests/`.

### Agent tracing (mandatory for every code change)

1. Read the affected package's `AGENT_TRACER.md` before editing; update it after every change.
2. Add `// AGENT-TRACE:` breadcrumbs for non-obvious logic.
3. Instrument new service paths with OpenTelemetry / prom-client where applicable.

### Git

- One commit per task; no amend/force-push without permission; never `--no-verify`.
- Husky runs lint-staged on commit and lint + type-check on push. Do not bypass hooks.
- Pause for human review before merging any DB schema, RLS, or auth/authorization change.

---

## 4) Other AI assistant configs to consult (authoritative sources)

- `CLAUDE.md` — technical guide, commands, architecture, codegen.
- `AGENTS.md` — agent contracts, workflow phases, quality gates.
- `CONTRIBUTING.md` — full contributor guide, quality gates, new-package workflow, policy compiler, troubleshooting.
- `DESIGN.md` — color system, typography, components, animation.
- `SECURITY.md` — security policy and incident response.

Domain rules (architecture, portal, auth, design-system, testing, code review) are consolidated in `CLAUDE.md` (Conventions) and `CONTRIBUTING.md`.

---

## 5) Quick heuristics for automated changes

- Small, targeted edits (≤5 files) can be done directly. Larger cross-cutting changes should be planned and validated with `pnpm quality`.
- For DB migrations, RLS changes, and auth changes: stop and request explicit human confirmation.
- When adding a new `@repo/*` import to portal code, update `apps/portal/jest.config.js` `moduleNameMapper`.
- When adding a new project, run `node tools/apply-project-tags.cjs` and update `tools/policy-compiler.cjs`.
- If `pnpm policy:check` fails, run `pnpm policy:gen`, inspect the diff, and commit generated files atomically with the source change.
- Prefer `nx run` / `nx run-many` over invoking underlying tools directly; prefix with `pnpm nx` (e.g., `pnpm nx run portal:build`).

---

(Prepared from `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`, `package.json`, and `pnpm-workspace.yaml`.)
