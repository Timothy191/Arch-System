# Contributing to Arch-System

## Welcome

Arch-System (the Plantcor mining operations portal) is an industrial operations platform built for high-scale vigilance and operational precision. The monorepo hosts the Next.js portal and shared packages (theme, UI, supabase, database, contract, redis, logger, rate-limiter, errors, eval, agents, utils). The mission of this guide is to get you from a fresh clone to a first successful quality-gated PR with as little detective work as possible — and to make sure every contribution leaves the system at least as safe and well-typed as it found it.

## Quick start

### Prerequisites

- **Node.js** `>=24.0.0` (`.nvmrc` and `.node-version` pin `24`)
- **pnpm** `9.15.9` (pinned via the `packageManager` field in root `package.json`)
- **Docker** — required for local Redis (`pnpm redis:up`) and optional local observability stack (`infra/monitoring/docker-compose.yml`, started with `pnpm monitor:grafana`)
- **Cloud Supabase** — all development and production environments connect to cloud-hosted Supabase PostgreSQL 17
- **Git** with hooks enabled (Husky installs automatically on `pnpm install`)

### First clone

```bash
git clone https://github.com/Timothy191/Arch-System.git
cd Arch-System
pnpm install --frozen-lockfile     # installs deps and activates Husky hooks
cp apps/portal/.env.example apps/portal/.env
# edit apps/portal/.env — fill Cloud Supabase keys, Redis URL, Sentry DSN, etc.
```

### Environment setup

Ensure `apps/portal/.env` contains your Cloud Supabase configuration (`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`) and local Redis connection (`REDIS_URL=redis://localhost:6379`).

### Run the app

```bash
pnpm redis:up                           # start local Redis 7.4 + RedisInsight (:5540)
pnpm dev                                # full dev stack + portal on :3000
# or fast headless portal only:
pnpm dev:quick
```

### Verify the install

```bash
pnpm test                               # runs Jest across the workspace
pnpm --filter portal test -- --testPathPatterns=smoke  # single file
pnpm agent:verify                       # mandatory 28-gate fail-fast verification suite
```

If `pnpm test` is green and the portal loads at `http://localhost:3000`, you are ready to contribute.

## Architecture overview

The monorepo is a **Turborepo 2.x + pnpm workspaces** project (`turbo run` is the entry point for every task). Top-level layout:

| Path                    | Purpose                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/portal`           | Next.js 16.4.6 (App Router, React 19) — the mining operations portal. Server Actions and API routes co-located with features.      |
| `packages/ui`           | Shared Radix + Tailwind UI components (`GlassCard`, `Logo`, `EveLogo`, `HeroRotator`, `DepartmentLayout`, `MacMenuBar`).           |
| `packages/theme`        | Light-mode OKLCH design tokens, Metallic Gold (`--accent-gold` / `#d4af37`) tokens, Style Dictionary codegen, and Tailwind preset. |
| `packages/contract`     | Canonical Zod 4 schemas and inferred TypeScript types (`pnpm audit:drift`).                                                        |
| `packages/supabase`     | Browser, server, middleware, proxy, service-role, read-replica Supabase clients, Kysely builder, and generated database types.     |
| `packages/database`     | Immutable PostgreSQL 17 SQL migrations (source of truth, 172+ applied migrations).                                                 |
| `packages/redis`        | Capability-only Redis layer (L1/L2 cache, auth sessions, analytics, RediSearch, streams, distributed locks).                       |
| `packages/intelligence` | Operational mining intelligence engines (anomaly, predictive maintenance, forecast, shift intelligence, copilot).                  |
| `packages/rate-limiter` | Memory & Redis rate-limiting strategies (fixed-window, sliding-window, token-bucket).                                              |
| `packages/utils`        | Shared client/server utilities, VibeMon client, Inngest, Novu, n8n, and offline storage.                                           |
| `packages/errors`       | Domain-specific `AppError` hierarchy and boundary guards.                                                                          |
| `packages/eval`         | Python/DeepEval AI compliance suite (`pyproject.toml`).                                                                            |
| `libs/features/*`       | Domain vertical slices (`auth`, `departments`, `hub` x `ui`, `data-access`, `utils`).                                              |
| `libs/shared/*`         | Cross-cutting SSR-safe hooks (`@repo/shared/hooks`), data-access, and env/cache utilities (`@repo/shared/utils`).                  |
| `tools/`                | Build-time scripts: policy compiler, 28-gate verifier, autonomous CI gatekeeper, wiki sync, Rust swarm orchestrator.               |
| `e2e/`                  | Playwright E2E tests (visual snapshots, a11y, integration) and k6 load scripts.                                                    |

Deep dives live in `AGENTS.md` and `GEMINI.md` — linked at the end of this document.

## Quality gates

Every pull request and `main` push is governed by the **28-gate verification suite** (`pnpm agent:verify` / `bash tools/scripts/agent-verify.sh`) and the **6 required GitHub ruleset status checks** published by `pnpm ci:gatekeeper` (`node tools/scripts/autonomous-ci-gatekeeper.mjs`):

| Required GitHub Ruleset Context                  | Local Verification Gate(s)                                                                    | Blocks Merge? |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------- |
| `Quality Gates (Lint, Type Check, Build & Test)` | Gates 1–3, 14, 18–19, 22–23 (`pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`)       | ✅            |
| `Policy Check`                                   | Gates 4–5, 9–10, 13, 16–17 (`pnpm policy:check`, `pnpm audit:drift`, `pnpm audit:rls-matrix`) | ✅            |
| `Dead Code Detection`                            | Gate 15 (`pnpm knip`)                                                                         | ✅            |
| `Dependency Lint`                                | Gate 12 (`pnpm deps:lint` / Syncpack)                                                         | ✅            |
| `Security Audit`                                 | Gates 6, 11, 20, 25 + `pnpm policy:security --ci`                                             | ✅            |
| `Tier 2 Review Policy Check`                     | Gates 7–8, 21, 24, 26–28 (evidence manifest, CodeGraph integrity, observability resilience)   | ✅            |

**Local verification & status publication**:

```bash
pnpm agent:verify       # Runs all 28 gates fail-fast and writes .ci-local/agent-verify-evidence.json
pnpm ci:gatekeeper      # Publishes the 6 required GitHub ruleset commit statuses from verified evidence
pnpm quality            # Full release-grade quality suite
```

Run `pnpm agent:verify` before pushing. Husky's `pre-push` hook enforces the 28-gate suite and auto-publishes the verified commit statuses.

### Coverage thresholds (enforced by Jest)

- Lines 40 %, branches 30 %, functions 30 %, statements 40 %

If your change drops coverage, either add tests or explicitly raise the threshold in `apps/portal/jest.config.cjs` after a maintainer review.

## Adding a new package

The workspace uses pnpm's `catalog:` indirection and project tags. New packages must participate in both.

### 1. Scaffold the package

```bash
mkdir -p packages/my-feature
cd packages/my-feature
pnpm init
```

`package.json` must:

- Set `"name": "@repo/my-feature"`.
- Reference shared dependencies via `"version": "catalog:"` or `"catalog:react19"` (see `pnpm-workspace.yaml`).
- Export its public API from `src/index.ts` (or named entries listed under `exports`).

### 2. Wire it into the workspace

`pnpm-workspace.yaml` already globs `packages/*`; no edit is needed for the package to be discoverable. Add an explicit entry only if the package lives outside the standard layout.

### 3. Register the project with the policy compiler

Add a `DEPENDENCY_RULES` entry to `tools/repo/policy-compiler.cjs` describing what your package can and cannot import (see "Adding a new dependency rule" below). The canonical `scope:*` vocabulary (`scope:app`, `scope:app:my-feature`, `scope:package`, `scope:package:my-feature`, `scope:package:db-internal` for `database`, `scope:tool` for `tools/*`) is defined there. Run `pnpm policy:gen` to regenerate the boundary rules.

### 4. Configure package scripts

Add a `project.json` next to `package.json` (the tag script will create one if missing) and declare `build`, `lint`, `type-check`, and (for apps) `test` targets using the workspace executors. Look at `packages/ui/project.json` for a clean reference.

### 5. Declare dependency rules

Open `tools/repo/policy-compiler.cjs` and add a `DEPENDENCY_RULES` entry that describes what your package can and cannot import (see "Adding a new dependency rule" below). Run `pnpm policy:gen` to regenerate `tools/repo/policy/*.json` and the ESLint boundaries config.

### 6. Verify

```bash
pnpm --filter @repo/my-feature build
pnpm --filter @repo/my-feature lint
pnpm --filter @repo/my-feature type-check
pnpm policy:check
pnpm quality
```

## Modifying architectural rules

All cross-cutting rules — dependency boundaries, required CI checks, intent capabilities, security patterns — flow from a **Single Source of Truth (SSoT)** into deterministic outputs.

```
tools/repo/policy-compiler.cjs       (runtime CJS & Single Source of Truth)
        ↓ generates
tools/repo/policy/dependency.rules.json
tools/repo/policy/architecture.rules.json
tools/repo/policy/security.checks.json
tools/repo/policy/intent-map.json
tools/repo/policy/eslint-boundaries.generated.cjs
```

The compiler has two modes:

- `pnpm policy:gen` — writes outputs to `tools/repo/policy/`.
- `pnpm policy:check` — verifies outputs are in sync; **exits non-zero on drift**. CI runs this on every PR.

### Workflow

1. Edit only `tools/repo/policy-compiler.cjs` (the Single Source of Truth).
2. Run `pnpm policy:gen` locally. Inspect the diff under `tools/repo/policy/`.
3. Commit `tools/repo/policy-compiler.cjs` and every regenerated JSON/CJS file as a single atomic change.
4. Push. The CI drift check will fail if the generated files are out of sync — that is by design.

If the SSoT is wrong (you cannot express your rule), extend the data model in `policy-compiler.cjs` first, regenerate, and only then add a new rule. The compiler is the contract.

## Adding a new dependency rule

Concrete example: forbid `packages/ui` from importing any of the Supabase client modules, so UI stays presentational.

### Step 1 — Express the rule in the SSoT

Edit `tools/repo/policy-compiler.cjs` and add to the `DEPENDENCY_RULES` array:

```js
{
  sourceTag: 'scope:package:ui',
  targetTag: 'scope:package:supabase',
  allowed: false,
  reason: 'UI is presentational; data fetching belongs in features/',
}
```

### Step 2 — Regenerate

```bash
pnpm policy:gen
```

This writes `tools/repo/policy/dependency.rules.json` and `tools/repo/policy/eslint-boundaries.generated.cjs` (which `eslint-plugin-boundaries` consumes).

### Step 3 — Verify drift-free

```bash
pnpm policy:check
```

The check must report no drift. If it reports drift, you edited the SSoT but forgot to commit a regenerated file.

### Step 4 — Confirm the rule actually fires

Add a temporary import in any file under `packages/ui` of `@repo/supabase/client` and run `pnpm turbo run lint`. You should see the rule fire with your `reason` string in the error. Revert the import before committing.

### Step 5 — Commit

Stage `tools/repo/policy-compiler.cjs`, `tools/repo/policy/dependency.rules.json`, and `tools/repo/policy/eslint-boundaries.generated.cjs` together. Use a conventional commit (`feat(policy): forbid ui → supabase imports`).

## Code conventions

These rules are enforced by ESLint, TypeScript, and code review. They are not optional.

- **TypeScript strict** — `"strict": true` is on. No `any`, no `// @ts-ignore`, no untyped exports. Use `unknown` + a type guard or Zod schema for boundary data.
- **Named icon imports** — always `import { Drill } from "lucide-react"`. Never `import * as Icons from "lucide-react"`. An unscoped import previously produced a 1.3 MB chunk.
- **Class merging** — always use `cn()` from `@repo/ui/lib/utils` (`import { cn } from "@repo/ui/lib/utils"`). Never concatenate class strings with template literals.
- **No raw shadows** — `box-shadow` and Tailwind `shadow-sm/md/lg` are forbidden. Use only the tokenized shadows: `shadow-card`, `shadow-window`, `shadow-diffusion-*`.
- **No hardcoded colors** — pull from design tokens (`@repo/theme`) or Tailwind tokens built from `packages/theme/tokens.json`. Hardcoded OKLCH/hex values in components are a CI lint failure.
- **Light theme only** — `data-theme="light"` is hardcoded in the head script. Do not add a dark-mode toggle, color-scheme overrides, or `prefers-color-scheme: dark` media queries. Dark mode does not exist.
- **Animation discipline** — animate only `opacity`, `transform`, `background-color`, `border-color`, `color`. Never animate layout properties. Easing is `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Glass pattern** — `liquid-glass-light border border-white/40 shadow-window rounded-2xl` is the standard surface.
- **Icon and path aliases** — `@/*` and `~/*` both resolve to `apps/portal/*`. `@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*` are conventional sub-cuts.
- **Server Actions validate first line** — `createServerSupabaseClient()` from `@repo/supabase/server` and validate the user as line one.
- **Conventional commits** — enforced by commitlint. Husky `commit-msg` hook will reject non-conforming messages.

## Testing

| Suite                       | Command                                                  | Notes                                                                                                 |
| --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Unit (Jest, jsdom, ts-jest) | `pnpm test`                                              | Does not need Supabase.                                                                               |
| Single file                 | `pnpm --filter portal test -- --testPathPatterns=<file>` | Fast iteration loop.                                                                                  |
| E2E (Playwright)            | `pnpm test:e2e`                                          | Requires dev server on `:3000` and Chromium at `/usr/bin/google-chrome` (see `playwright.config.ts`). |
| Visual snapshots            | `e2e/visual/__snapshots__/`                              | Update with `playwright test --update-snapshots`.                                                     |
| AI compliance               | `packages/eval/`                                         | Python/DeepEval, separate Poetry env, not in `pnpm quality`.                                          |
| Coverage                    | `pnpm turbo run test --coverage`                         | Thresholds: 40/30/35/40.                                                                              |

### Adding a new `@repo/*` import to a portal test

`apps/portal/jest.config.cjs` uses **explicit** `moduleNameMapper` entries. A new package or subpath import will fail with module-not-found unless you add the mapping. Update the map when introducing new package exports.

### Conventions

- Co-locate unit tests next to source as `*.test.ts(x)`.
- E2E lives in `e2e/` and is grouped by feature.
- Mock at the network boundary (Supabase, Redis), not at the function call.

## Database migrations

The **`employees` table is the source of truth** for authorization (role and department). Supabase Auth metadata is **not** used for authorization decisions.

### Workflow

1. Add a new file in `packages/database/migrations/` with a zero-padded sequence number: `NNN_description.sql` (e.g. `062_add_equipment_table.sql`). Files are processed in lexical order — gaps are allowed but discouraged.
2. Apply migrations to Cloud Supabase using the dashboard or linked Supabase CLI.

3. Regenerate TypeScript types:

   ```bash
   pnpm --filter @repo/database db:types
   ```

4. Commit **both** the migration and the updated `packages/supabase/src/database.types.ts` in a single atomic change.
5. All migrations are tracked in `packages/database/migrations/` and pushed to Cloud Supabase.

### RLS requirements

- Every new table must have Row-Level Security enabled (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`).
- The `no-raw-rls-disable` security check (see `tools/repo/policy-compiler.cjs`) will fail CI if any migration disables RLS.
- Authorization policies should consult `employees.role` and `employees.department_id`, not `auth.uid()` alone.
- SQL privilege-escalation and index-coverage tests live in `packages/database/tests/`. Add tests for new tables that introduce new RLS roles or new index patterns.

### When to stop and ask for confirmation

Schema changes, RLS policy changes, and any change to authentication/authorization logic touch live data and security. **Pause for human review** before merging — at minimum, get a second pair of eyes on the PR.

## Troubleshooting

### `pnpm install` fails on lockfile mismatch

Run `pnpm install --no-frozen-lockfile` locally, then commit the updated `pnpm-lock.yaml`. CI uses `--frozen-lockfile` and will fail on any drift.

### `pnpm policy:check` reports drift

You (or a previous commit) edited `tools/repo/policy-compiler.cjs` without regenerating. Run `pnpm policy:gen` and commit the output under `tools/repo/policy/`.

### Supabase types are stale after a migration

```bash
pnpm --filter @repo/database db:types
```

If the script errors, confirm your cloud project configuration is active.

### Portal Jest cannot resolve `@repo/something`

Add the package to `moduleNameMapper` in `apps/portal/jest.config.cjs`. Wildcard mappings are not always sufficient for subpath exports — add explicit entries when needed.

### Pre-commit hook complains about secrets

Secretlint and gitleaks both run. If a real secret slipped in, rotate the credential first, then remove the value from the file (and history if necessary — see `SECURITY.md` for incident response).

### `pnpm quality` passes locally but CI fails

Most common cause: a generated file is missing or stale. Run `pnpm policy:gen && pnpm format && pnpm knip:fix` and re-push. If CI still fails, the most likely culprit is environment — check that the failing step does not require a service (Supabase, Redis) that the local run had.

### Circular dependency detected

`tools/circular-dep-detect.cjs` exits non-zero on cycles. Identify the cycle with `turbo query` or `madge --circular packages/<pkg>`, then break it by moving the shared code into a new package or by introducing an interface at the boundary.

### Husky hook skipped with `--no-verify`

**Don't.** Pre-commit (lint-staged) and pre-push (lint + type-check) are there to keep `master` green. If a hook is broken, fix the hook or the underlying script — do not bypass it.

### Knock-on issues from codegen

After editing `packages/theme/tokens.json`, run `pnpm --filter @repo/theme build` and commit **both** the source tokens and the regenerated `packages/theme/src/tokens/generated.ts`. After applying migrations, run `pnpm --filter @repo/database db:types` and commit the regenerated `database.types.ts`.

## Further reading

- **[CLAUDE.md](CLAUDE.md)** — Complete technical guide, commands, and architecture details.
- **[AGENTS.md](AGENTS.md)** — Workflow rules, agent contracts, codegen pipelines, and quality gates.
- **[DESIGN.md](docs/DESIGN.md)** — Color system, typography, components, animation rules.
- **[PRODUCT.md](docs/PRODUCT.md)** — User personas, product strategy, tone.
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Deployment guide for all environments.
- **[SECURITY.md](docs/SECURITY.md)** — Security policy and vulnerability reporting.
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Full documentation index and quick navigation.
