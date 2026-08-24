# AGENTS.md

> **Agent contract index** — onboarding index: [`CLAUDE.md`](CLAUDE.md). Full detail: [`.claude/guides/operational-handbook.md`](.claude/guides/operational-handbook.md).

## Contract (non‑negotiable)

- Read affected package `AGENT_TRACER.md` before editing; update it after every change.
- Conclude every turn/response with: Summary of Actions Taken, Token Metrics (Tokens Used, Tokens Cached, Tokens Reused from cached, Tokens Saved), Suggested Next Steps (3 options with `@[path]` metadata references and recommended slash commands like `/goal`, `/plan`, `/schedule`), and Tip (contextual tips on prompting, system prompts, or actions to improve AI output).
- Apply token-saving strategies: bounded file slicing (`StartLine`/`EndLine`), `grep_search` symbol lookup, and surgical contiguous diffs.
- Run `pnpm quality` before marking work complete.
- Delegate multi-file exploration to subagents; scope prompts with paths.
- Git: one commit per task, no amend/force-push without permission, never `--no-verify`.

## Project

Arch-Systems Mining Operations Portal — Nx + pnpm monorepo. Next.js 15+ portal (`apps/portal`, :3000), Payload CMS v3, overview app. Light-only design system (OKLCH), glass surfaces, named shadows only.

Node `>=22`, pnpm `9.15.9`, ESM, packageManager in `package.json`.

## Dev environment

```bash
pnpm install
cp apps/portal/env/.env.example apps/portal/.env   # populate Supabase keys, REDIS_URL, SENTRY_DSN
pnpm --filter @repo/database supabase:dev            # Docker, separate terminal
pnpm dev                                            # :3000
```

Bootstrap variants: `pnpm dev:quick` (skip Docker/Supabase), `pnpm dev:hosted` (hosted Supabase), `pnpm dev:up --all` (all apps). Dev server auto-resolves port conflicts and starts dependencies.

**Required env vars** (see `apps/portal/.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `REDIS_URL` (for rate limiting + department slug cache), `N8N_URL`, `FLOWISE_URL`, `NEXT_PUBLIC_FUXA_URL`, `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`. CI uses dummy Supabase keys — `pnpm quality` runs without real credentials.

## Build & test

| Goal                    | Command                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| Install                 | `pnpm install`                                                       |
| Dev server              | `pnpm dev`                                                           |
| Build all               | `pnpm build` (runs `sync-assets-smart.cjs` + `nx run-many -t build`) |
| Lint                    | `pnpm lint`                                                          |
| Type-check              | `pnpm type-check`                                                    |
| Unit tests              | `pnpm test`                                                          |
| E2E (Playwright)        | `pnpm test:e2e` — requires dev server on :3000                       |
| E2E visual smoke        | `pnpm test:e2e:visual` — grep `theme.smoke`                          |
| Full quality gate       | `pnpm quality`                                                       |
| Format                  | `pnpm format`                                                        |
| Format check            | `pnpm format:check`                                                  |
| Stylelint (CSS)         | `pnpm lint:styles`                                                   |
| Spelling (cspell)       | `pnpm lint:spelling`                                                 |
| Dead code (knip)        | `pnpm knip` / `pnpm knip:fix`                                        |
| Dep version consistency | `pnpm deps:lint` / `pnpm deps:fix`                                   |
| RLS audit               | `pnpm audit:rls`                                                     |
| Design audit            | `pnpm audit:design`                                                  |
| Policy check            | `pnpm policy:check`                                                  |
| DB: push migrations     | `pnpm --filter @repo/database supabase:push`                         |
| DB: generate types      | `pnpm --filter @repo/database supabase:gen`                          |
| DB: start local         | `pnpm --filter @repo/database supabase:dev`                          |

`pnpm quality` runs: lint → type-check → test → lint:tokens → lint:css → lint:root → lint:styles → format:check → deps:lint → knip → policy:check → audit:rls → audit:design. Run before every push.

CI order: lint → type-check → test → build. GitHub Actions also runs: deps:lint, security-audit (gitleaks + npm audit), knip, policy:check, md:lint, token/css lint, Trivy, DeepEval (Python/poetry in `packages/eval/`), Lighthouse, a11y audit, self-healing (`nx fix-ci`).

## Codegen — never hand-edit generated output

| Pipeline      | Source                                                 | Generate                                                                      |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Design tokens | `packages/theme/src/css/variables.css` + `tokens.json` | `pnpm --filter @repo/theme build` → `generated.ts`, `variables-generated.css` |
| DB types      | `packages/database/migrations/`                        | `supabase:push` → `supabase:gen` → `packages/supabase/src/database.types.ts`  |

Never edit `packages/supabase/supabase/migrations/` directly (PreToolUse hook blocks it). Source of truth for DB schema is `packages/database/migrations/`.

## Conventions (observed)

- **Auth**: `middleware.ts` delegates to `server/proxy.ts`. Employees table is source of truth for roles/departments — not Supabase Auth metadata. `/api/c66` is auth-exempt. `getUserSafely()` from `@repo/supabase/server` in Server Components; raw `getUser()` in Server Actions.
- **RLS**: Every new Supabase table must have RLS enabled. No exceptions.
- **Path aliases**: `@/` → `apps/portal/*`. `@repo/ui/globals.css` imported in root layout. `@repo/theme/react` `ArchThemeProvider` wraps app.
- **Design**: Light-only — no dark mode, no theme toggles. OKLCH palette via CSS vars (`--arch0`–`--arch15`) + semantic aliases. Glass: `bg-white/70 backdrop-blur-xl border border-black/[0.08]`. Shadows: named tokens only (`shadow-card`, `shadow-window`, `shadow-diffusion-*`) — raw `shadow-*` forbidden. Icons scoped imports (`import { Drill } from "lucide-react"`), never star imports. `cn()` from `@repo/ui/lib/utils` for conditional classes.
- **Animation**: Only `opacity`, `transform`, `background-color`, `border-color`, `color`. Never layout props. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Server Actions**: Co-located near the feature, often `actions.ts`. Enforce Zod schemas from `@repo/contract` before mutations. Validate user at top of every action.
- **Git**: Commitlint with conventional commits (`commitlint --edit`). `commitlint.config.mjs` at `config/tools/`.

## CI & deployment

CI: `.github/workflows/ci.yml` (parallel lint/type/test/build/e2e/lighthouse/a11y/security/deps/knip/policy/md jobs), `release.yml` (Changesets publish), `deploy.yml`, `deploy-canary.yml`, `theme-ci.yml`, `reviewdog.yml`, `dast.yml`, `opencode.yml`.

Deploy: `pnpm deploy:local` / `deploy:staging` / `deploy:production` / `deploy:rollback`. Scripts: `scripts/deploy.sh`. `pnpm fresh-start` = clean rebuild. `pnpm shutdown` = stop all services.

## Rules (read on demand)

| Path                                     | Covers                                                       |
| ---------------------------------------- | ------------------------------------------------------------ |
| `.claude/rules/process.md`               | Consolidated task discipline, TDD, debugging, verification   |
| `.claude/rules/architecture.md`          | Monorepo, packages, DB, AI                                   |
| `.claude/rules/portal.md`                | Routes, shell, CI order, path aliases, Jest moduleNameMapper |
| `.claude/rules/auth.md`                  | Middleware, RLS, `/api/c66` exemption                        |
| `.claude/rules/design-system.md`         | Light-only, glass, shadows, motion                           |
| `.claude/rules/testing.md`               | Jest/Playwright/E2E conventions                              |
| `.claude/rules/development-practices.md` | Dev workflow                                                 |
| `.claude/rules/code-review.md`           | Review checklist                                             |
| `.claude/rules/thought-process.md`       | Token conservation + response format                         |
| `.claude/agents/*.md`                    | Domain specialist agent persona profiles                     |

## Nx Guidelines

- Explore with `nx-workspace` skill first (`pnpm nx run`, `pnpm nx run-many`, `pnpm nx affected`).
- Scaffolding: invoke `nx-generate` skill FIRST. Prefix all CLI tasks with package manager (`pnpm nx build`).
- Run `node tools/apply-project-tags.cjs` after new projects. Dependency constraints in `nx.json`: `scope:app` → `scope:package`/`scope:feature` only.
- Check `nx_docs` or `--help` before using CLI flags.

## Pitfalls

- **Duplicate background video**: `RouteBackground.tsx` mounts one `<video>`. Do not add per-page video elements — the global one handles autoplay.
- **Jest module resolution**: Portal `jest.config.js` uses explicit `moduleNameMapper` entries. Adding a new `@repo/*` import without the corresponding Jest mapping breaks tests.
- **AI functionality removed**: Ollama, AI chat routes, and AI tool modules were removed (2026-06-18). Do not re-add them. Embedding cache remains but generation is disabled.
- **Stray seed scripts**: Untracked `seed.ts`/`pg-seed.js` at repo root have pre-existing lint/tsc errors — exclude them from scoped operations, do not commit them.
- **Coverage threshold**: Global Jest thresholds are 34/24/24/35 (statements/branches/functions/lines). Remaining gap: `app/(departments)/[department]/**` page trees and `features/analytics`. Raising thresholds before covering those areas will fail the gate.
- **Portal build env**: `ENABLE_HEAVY_PLUGINS=true` enables PWA, Sentry source maps, standalone output. `SKIP_TYPE_CHECK=true` bypasses tsc in Next.js build. `ANALYZE=true` enables bundle analyzer.
- **Supabase migrations parity**: `packages/database/migrations/` is source of truth; `packages/supabase/supabase/migrations/` is a deploy-time mirror. Edit only the database package.
- **TranspilePackages**: All 18 entries must stay — `@repo/contract` exports gitignored `dist/`; removing an entry breaks fresh builds.
- **Dev server memory**: Turbopack dev RSS ~133MB (was ~12GB before optimization). Dev memory cap is 2048MB.
