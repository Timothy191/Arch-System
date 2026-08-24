# Repository Guidelines

Arch-Systems (Plantcor) is a multi-departmental mining operations portal — an **Nx 22 + pnpm** monorepo serving authenticated, department-specific dashboards. Node `>=22` (Volta pins `24.15.0`), pnpm `9.15.9`, ESM, Docker for local Supabase.

> Concise contributor index. Each section links to the authoritative detail in [`CLAUDE.md`](../CLAUDE.md) (technical guide) or [`CONTRIBUTING.md`](../CONTRIBUTING.md) (full contributor guide). Nothing is lost — just one click away.

## Project Structure & Module Organization

- `apps/portal` — Next.js 15+ App Router, React 19 (:3000). Server Actions + API routes co-located with features.
- `apps/cms` — Payload CMS v3. `apps/overview` — architecture visualization (React Flow).
- `packages/` — `theme`, `ui`, `supabase`, `database`, `redis`, `utils`, `errors`, `types`, `contract`, `logger`, `rate-limiter`, `eval`, `agents`.
- `tools/` — build-time scripts (policy compiler, tag applicator). `e2e/` — Playwright tests.
- Migrations source of truth: `packages/database/migrations/`. Never edit `packages/supabase/supabase/migrations/` (deploy-time copy).

Full architecture detail: [CLAUDE.md > Architecture](../CLAUDE.md#architecture) · [CONTRIBUTING.md > Architecture overview](../CONTRIBUTING.md#architecture-overview).

## Build, Test, and Development Commands

```bash
pnpm install
cp apps/portal/env/.env.example apps/portal/.env
pnpm --filter @repo/database supabase:dev   # local Postgres + Auth (:54321), separate terminal
pnpm dev                                    # portal on :3000
pnpm quality                                # full quality gate — run before push
```

| Goal              | Command                                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| Build all / one   | `pnpm build` · `pnpm nx build <name>`                                               |
| Lint / type-check | `pnpm lint` · `pnpm type-check`                                                     |
| Unit tests        | `pnpm test` · single file: `pnpm --filter portal test -- --testPathPatterns=<file>` |
| E2E               | `pnpm test:e2e` (needs portal on :3000)                                             |

Prefer `pnpm nx run` / `nx run-many` over invoking underlying tools directly.
Full command table + `pnpm quality` breakdown: [CLAUDE.md > Common commands](../CLAUDE.md#common-commands).
Quality gate order + 14-step CI pipeline: [CONTRIBUTING.md > Quality gates](../CONTRIBUTING.md#quality-gates).

## Coding Style & Naming Conventions

- TypeScript strict. No `any`, no `// @ts-ignore`. Use `unknown` + type guards or Zod at boundaries.
- Server Actions call `createServerSupabaseClient()` and validate the user on line one.
- Merge classes with `cn()` from `@repo/ui/lib/utils`. Named icon imports only (`import { Drill } from "lucide-react"`).
- Use semantic design tokens from `@repo/theme` — never hardcode OKLCH/hex. Light theme only.
- No raw `box-shadow` / Tailwind `shadow-*`. Use tokenized shadows: `shadow-card`, `shadow-window`, `shadow-diffusion-*`.
- Animate only `opacity`, `transform`, color props. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Path aliases: `@/*` and `~/*` resolve to `apps/portal/*`.
- Formatting: Prettier. Linting: ESLint + Stylelint + cspell.

Full conventions (package management, portal routing, design system, codegen): [CLAUDE.md > Conventions](../CLAUDE.md#conventions) · [CONTRIBUTING.md > Code conventions](../CONTRIBUTING.md#code-conventions).
Design system rules (OKLCH, glass surface, typography, motion): [DESIGN.md](DESIGN.md).

## Testing Guidelines

- Unit tests: Jest (jsdom, ts-jest). Co-locate as `*.test.ts(x)` next to source.
- E2E: Playwright in `e2e/`. Mock at the network boundary (Supabase, Redis), not at function calls.
- Coverage thresholds: lines 40%, branches 30%, functions 35%, statements 40%.
- Jest pitfall: `apps/portal/jest.config.js` uses explicit `moduleNameMapper` — add a mapping for any new `@repo/*` import.

Full testing detail + new `@repo/*` import workflow: [CONTRIBUTING.md > Testing](../CONTRIBUTING.md#testing).

## Commit & Pull Request Guidelines

- Conventional commits enforced by commitlint: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`.
- One commit per task. No amend/force-push without permission. Never `--no-verify`.
- Husky runs lint-staged on commit, lint + type-check on push. Do not bypass hooks.
- Pause for human review before merging any DB schema, RLS, or auth change.
- Commit migrations and regenerated `packages/supabase/src/database.types.ts` atomically.

Full migration workflow + RLS requirements: [CONTRIBUTING.md > Database migrations](../CONTRIBUTING.md#database-migrations).
Git + agent tracing rules: [CLAUDE.md > Git](../CLAUDE.md#git).

## Agent-Specific Instructions

- Read the affected package's `AGENT_TRACER.md` before editing; update it after every change (ISO 8601 timestamp, purpose, changes, handoff).
- Add `// AGENT-TRACE:` breadcrumbs for non-obvious logic. Instrument new service paths with OpenTelemetry / prom-client.
- Run `pnpm quality` before marking work complete.
- Policy SSoT: edit `tools/policy-compiler.cjs`, run `pnpm policy:gen`, commit source and generated files atomically. CI fails on drift.
- Codegen pipelines (design tokens, DB types): [CLAUDE.md > Codegen](../CLAUDE.md#codegen--never-edit-generated-output).
- Policy + dependency rules: [CLAUDE.md > Policy & dependency constraints](../CLAUDE.md#policy--dependency-constraints-single-source-of-truth).
- New package workflow (6 steps): [CONTRIBUTING.md > Adding a new package](../CONTRIBUTING.md#adding-a-new-package).
- Nx: explore with the `nx-workspace` skill first. Scaffolding: invoke the `nx-generate` skill before other exploration.
- Common pitfalls (duplicate video, Jest resolution, transpilePackages, AI removal): [CLAUDE.md > Heuristics](../CLAUDE.md#heuristics).

## CI & Deployment

- CI workflows in `.github/workflows/`: `ci.yml` (parallel lint/type/test/build/e2e/lighthouse/a11y/security/deps/knip/policy), `release.yml`, `deploy.yml`, `theme-ci.yml`, `dast.yml`.
- Deploy: `pnpm deploy:local` / `:staging` / `:production` / `:rollback`. `pnpm fresh-start` = clean rebuild. `pnpm shutdown` = stop all services.

Full deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md). Security policy: [SECURITY.md](SECURITY.md).

## Further Reading

[`CLAUDE.md`](../CLAUDE.md) (technical guide) · [`CONTRIBUTING.md`](../CONTRIBUTING.md) (full contributor guide) · [`DESIGN.md`](DESIGN.md) · [`DEPLOYMENT.md`](DEPLOYMENT.md) · [`SECURITY.md`](SECURITY.md) · [`PRODUCT.md`](PRODUCT.md).
