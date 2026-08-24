# Repository Guidelines

> Concise contributor index. Full detail: [`CLAUDE.md`](../CLAUDE.md) (technical guide) and [`CONTRIBUTING.md`](../CONTRIBUTING.md) (contributor guide).

Arch-Systems (Plantcor) is a multi-departmental mining operations portal — an **Nx 22 + pnpm** monorepo serving authenticated, department-specific dashboards (drilling, production, access control, engineering, control room, safety, training, satellite monitoring). Light-only design system (OKLCH), glass surfaces, named shadows only.

## Project Structure & Module Organization

```
apps/
  portal/      Next.js 15+ App Router, React 19 (:3000). Server Actions + API routes co-located with features.
  cms/         Payload CMS v3 headless content service.
  overview/    Standalone architecture visualization (React Flow).
  ci-observer/ CI observation helper.
packages/
  theme/       OKLCH design tokens + Tailwind preset (single source of truth).
  ui/          Shared Radix + shadcn components; widgets/ for composites.
  supabase/    Browser/server/middleware Supabase clients + auto-generated DB types.
  database/    SQL migrations (source of truth) — never edit the Supabase copy.
  redis/       Redis cache helpers (rate limiting + department slug cache).
  utils/       Shared utilities (Inngest, Novu integrations).
  errors/      Domain-specific error classes.
  types/       Shared TypeScript types.
  contract/    Zod validation schemas.
  logger/      Structured logging.
  rate-limiter/ Rate limiting utilities.
  eval/        Python/DeepEval AI compliance suite (separate Poetry env, not in pnpm quality).
  agents/      Agent orchestration utilities.
tools/         Build-time scripts: policy compiler, tag applicator, circular-dep detector.
e2e/           Playwright E2E tests (visual snapshots, integration).
docs/          Documentation center (symlinked from repo root).
```

**Environment**: Node `>=22` (Volta pins `24.15.0`), pnpm `9.15.9`, ESM (`"type": "module"`). Docker required for local Supabase. Husky hooks install on `pnpm install`.

## Build, Test, and Development Commands

```bash
pnpm install
cp apps/portal/env/.env.example apps/portal/.env   # populate Supabase keys, REDIS_URL, SENTRY_DSN
pnpm --filter @repo/database supabase:dev            # local Postgres + Auth (:54321), separate terminal
pnpm dev                                            # portal on :3000
```

Bootstrap variants: `pnpm dev:quick` (skip Docker/Supabase), `pnpm dev:hosted` (hosted Supabase), `pnpm dev:up --all` (all apps).

| Goal                     | Command                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| Build all                | `pnpm build` (runs `sync-assets-smart.cjs` + `nx run-many -t build`) |
| Build one project        | `pnpm nx build <name>` or `pnpm --filter @repo/<name> build`         |
| Lint all / one           | `pnpm lint` · `pnpm nx lint <name>`                                  |
| Type-check all / one     | `pnpm type-check` · `pnpm nx type-check <name>`                      |
| Unit tests               | `pnpm test`                                                          |
| Single portal test file  | `pnpm --filter portal test -- --testPathPatterns=<file>`             |
| E2E (needs portal :3000) | `pnpm test:e2e`                                                      |
| Visual E2E snapshots     | `pnpm test:e2e:visual`                                               |
| Full quality gate        | `pnpm quality`                                                       |
| Format / check           | `pnpm format` · `pnpm format:check`                                  |
| Stylelint (CSS)          | `pnpm lint:styles`                                                   |
| Spelling (cspell)        | `pnpm lint:spelling`                                                 |
| Dead code (knip)         | `pnpm knip` / `pnpm knip:fix`                                        |
| Dep version consistency  | `pnpm deps:lint` / `pnpm deps:fix`                                   |
| RLS audit                | `pnpm audit:rls`                                                     |
| Design audit             | `pnpm audit:design`                                                  |
| Policy check / gen       | `pnpm policy:check` / `pnpm policy:gen`                              |
| DB: push migrations      | `pnpm --filter @repo/database supabase:push`                         |
| DB: generate types       | `pnpm --filter @repo/database supabase:gen`                          |
| DB: start local          | `pnpm --filter @repo/database supabase:dev`                          |
| Storybook                | `pnpm ui`                                                            |
| Storybook a11y           | `pnpm test:a11y`                                                     |
| Deploy                   | `pnpm deploy:local` / `:staging` / `:production`                     |

`pnpm quality` runs: lint → type-check → test → lint:tokens → lint:css → lint:root → lint:styles → format:check → deps:lint → knip → policy:check → audit:rls → audit:design. **Run before every push.**

CI order: lint → type-check → test → build. GitHub Actions also runs deps:lint, security-audit (gitleaks + npm audit), knip, policy:check, md:lint, token/css lint, Trivy, DeepEval (Python/poetry in `packages/eval/`), Lighthouse, a11y audit, self-healing (`nx fix-ci`).

Prefer `pnpm nx run` / `nx run-many` over invoking underlying tools directly.

## Coding Style & Naming Conventions

- **TypeScript strict** — `"strict": true`. No `any`, no `// @ts-ignore`. Use `unknown` + type guards or Zod schemas at boundaries.
- **Server Actions** — call `createServerSupabaseClient()` and validate the user on line one. Co-located near the feature, often `actions.ts`. Enforce Zod schemas from `@repo/contract` before mutations.
- **Class merging** — use `cn()` from `@repo/ui/lib/utils`. Never concatenate class strings with template literals.
- **Named icon imports** — `import { Drill } from "lucide-react"`. Never `import * as Icons` (star imports produced a 1.3 MB chunk).
- **No raw shadows** — `box-shadow` and Tailwind `shadow-sm/md/lg` are forbidden. Use tokenized shadows only: `shadow-card`, `shadow-window`, `shadow-diffusion-*`.
- **No hardcoded colors** — pull from semantic tokens (`@repo/theme`) or Tailwind tokens from `packages/theme/tokens.json`. Hardcoded OKLCH/hex in components is a CI lint failure.
- **Light theme only** — `data-theme="light"` is hardcoded. No dark mode, no toggles, no `prefers-color-scheme: dark`. Glass surface: `bg-white/70 backdrop-blur-xl border border-black/[0.08]`.
- **Animation** — only `opacity`, `transform`, `background-color`, `border-color`, `color`. Never layout props. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Path aliases** — `@/*` and `~/*` both resolve to `apps/portal/*`. Sub-cuts: `@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*`.
- **Auth** — `employees` table is source of truth for roles/departments, not Supabase Auth metadata. `getUserSafely()` from `@repo/supabase/server` in Server Components; raw `getUser()` in Server Actions.
- **RLS** — every new Supabase table must `ENABLE ROW LEVEL SECURITY`. Policies consult `employees.role` and `employees.department_id`, not `auth.uid()` alone.
- **Formatting** — Prettier (`pnpm format`). ESLint + Stylelint + cspell enforced in CI.

## Testing Guidelines

| Suite                       | Command                                                  | Notes                                                               |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Unit (Jest, jsdom, ts-jest) | `pnpm test`                                              | Does not need Supabase.                                             |
| Single file                 | `pnpm --filter portal test -- --testPathPatterns=<file>` | Fast iteration loop.                                                |
| E2E (Playwright)            | `pnpm test:e2e`                                          | Requires dev server on :3000.                                       |
| Visual snapshots            | `e2e/visual/__snapshots__/`                              | Update with `playwright test --update-snapshots`.                   |
| AI compliance               | `packages/eval/`                                         | Python/DeepEval, separate Poetry env, not in `pnpm quality`.        |
| Coverage                    | `pnpm nx run-many -t test -- --coverage`                 | Thresholds: lines 40%, branches 30%, functions 35%, statements 40%. |

- Co-locate unit tests next to source as `*.test.ts(x)`.
- E2E lives in `e2e/`, grouped by feature.
- Mock at the network boundary (Supabase, Redis), not at function calls.
- **Jest module resolution pitfall**: `apps/portal/jest.config.js` uses explicit `moduleNameMapper` entries. Adding a new `@repo/*` import without the corresponding mapping breaks tests.

## Commit & Pull Request Guidelines

- **Conventional commits** — enforced by commitlint (`config/tools/commitlint.config.mjs`). Format: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`. Husky `commit-msg` rejects non-conforming messages.
- **One commit per task.** No amend/force-push without permission. Never `--no-verify`.
- Husky runs lint-staged on commit (pre-commit) and lint + type-check on push (pre-push). Do not bypass hooks — fix the underlying script if a hook is broken.
- **Pause for human review** before merging any DB schema, RLS, or auth/authorization change.
- Migration workflow: add migration → `pnpm --filter @repo/database supabase:push` → `supabase:gen` → commit migration **and** regenerated `packages/supabase/src/database.types.ts` atomically.

## Codegen — Never Hand-Edit Generated Output

| Pipeline      | Source                                                 | Generate                                                                      |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Design tokens | `packages/theme/src/css/variables.css` + `tokens.json` | `pnpm --filter @repo/theme build` → `generated.ts`, `variables-generated.css` |
| DB types      | `packages/database/migrations/`                        | `supabase:push` → `supabase:gen` → `packages/supabase/src/database.types.ts`  |

Never edit `packages/supabase/supabase/migrations/` directly — it's a deploy-time copy (a PreToolUse hook blocks edits there). Source of truth for DB schema is `packages/database/migrations/`. Commit source and generated files in the same atomic change.

## Agent-Specific Instructions

- Read the affected package's `AGENT_TRACER.md` before editing; update it after every change (ISO 8601 timestamp, purpose, changes, handoff).
- Add `// AGENT-TRACE:` breadcrumbs for non-obvious logic. Instrument new service paths with OpenTelemetry / prom-client where applicable.
- Conclude every turn with: Summary of Actions Taken, Token Metrics (Tokens Used, Cached, Reused, Saved), Suggested Next Steps (3 options with `@[path]` references and recommended slash commands), and a contextual Tip.
- Apply token-saving strategies: bounded file slicing, symbol lookup, surgical contiguous diffs.
- Run `pnpm quality` before marking work complete. Delegate multi-file exploration to subagents; scope prompts with paths.
- **Nx**: explore with the `nx-workspace` skill first. Scaffolding: invoke the `nx-generate` skill BEFORE other exploration. Prefix all CLI tasks with package manager (`pnpm nx build`). Run `node tools/apply-project-tags.cjs` after adding a new project. Dependency constraints in `nx.json`: `scope:app` → `scope:package`/`scope:feature` only. Check `nx_docs` or `--help` before using CLI flags.
- **Policy SSoT**: `tools/policy-compiler.cjs` generates `tools/policy/*.json` and `tools/eslint-boundaries.generated.cjs`. Edit the compiler, then run `pnpm policy:gen`; CI runs `pnpm policy:check` and fails on drift. Commit source and generated files atomically.

## CI & Deployment

CI workflows in `.github/workflows/`: `ci.yml` (parallel lint/type/test/build/e2e/lighthouse/a11y/security/deps/knip/policy/md jobs), `release.yml` (Changesets publish), `deploy.yml`, `deploy-canary.yml`, `theme-ci.yml`, `reviewdog.yml`, `dast.yml`, `opencode.yml`.

Deploy: `pnpm deploy:local` / `deploy:staging` / `deploy:production` / `deploy:rollback` (scripts in `scripts/deploy.sh`). `pnpm fresh-start` = clean rebuild. `pnpm shutdown` = stop all services.

## Common Pitfalls

- **Duplicate background video**: `RouteBackground.tsx` mounts one `<video>`. Do not add per-page video elements — the global one handles autoplay.
- **Jest module resolution**: Portal `jest.config.js` uses explicit `moduleNameMapper` entries. A new `@repo/*` import without the corresponding mapping breaks tests.
- **AI functionality removed**: Ollama, AI chat routes, and AI tool modules were removed (2026-06-18). Do not re-add them. Embedding cache remains but generation is disabled.
- **Stray seed scripts**: Untracked `seed.ts`/`pg-seed.js` at repo root have pre-existing lint/tsc errors — exclude them from scoped operations, do not commit them.
- **Coverage gap**: remaining uncovered areas are `app/(departments)/[department]/**` page trees and `features/analytics`. Raising thresholds before covering those will fail the gate.
- **Portal build env**: `ENABLE_HEAVY_PLUGINS=true` enables PWA, Sentry source maps, standalone output. `SKIP_TYPE_CHECK=true` bypasses tsc in Next.js build. `ANALYZE=true` enables bundle analyzer.
- **Supabase migrations parity**: `packages/database/migrations/` is source of truth; `packages/supabase/supabase/migrations/` is a deploy-time mirror. Edit only the database package.
- **TranspilePackages**: All 18 entries must stay — `@repo/contract` exports gitignored `dist/`; removing an entry breaks fresh builds.
- **Dev server memory**: Turbopack dev RSS ~133MB (was ~12GB before optimization). Dev memory cap is 2048MB.

## Further Reading

- [`CLAUDE.md`](../CLAUDE.md) — complete technical guide, commands, architecture details.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — full contributor guide, quality gates, new-package workflow, troubleshooting.
- [`DESIGN.md`](../DESIGN.md) — color system, typography, components, animation rules.
- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — deployment guide for all environments.
- [`SECURITY.md`](../SECURITY.md) — security policy and vulnerability reporting.
- [`PRODUCT.md`](../PRODUCT.md) — user personas, product strategy, tone.
