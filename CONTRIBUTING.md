# Contributing to Arch-Mk2

## Welcome

Arch-Mk2 (the Plantcor mining operations portal) is an industrial operations platform built for high-scale vigilance and operational precision. The monorepo hosts the Next.js portal, a Payload CMS, the architecture overview app, and shared packages (theme, UI, supabase, database, redis, eval, types, utils, errors). The mission of this guide is to get you from a fresh clone to a first successful quality-gated PR with as little detective work as possible — and to make sure every contribution leaves the system at least as safe and well-typed as it found it.

## Quick start

### Prerequisites

- **Node.js** ≥ 22 (pinned via Volta in `package.json` to `24.15.0`)
- **pnpm** `9.15.9` (Volta-managed; see root `package.json` `volta` block)
- **Docker** — required for local Supabase
- **Git** with hooks enabled (Husky installs automatically on `pnpm install`)

### First clone

```bash
git clone <repo-url> arch-mk2
cd arch-mk2
pnpm install                       # installs deps and activates Husky hooks
cp apps/portal/env/.env.example apps/portal/.env
# edit apps/portal/.env — fill Supabase keys, Sentry DSN, etc.
```

### Start local services

In a separate terminal, start Supabase (requires Docker):

```bash
pnpm --filter @repo/database supabase:dev   # local Postgres + Auth on :54321
```

### Run the app

```bash
pnpm dev                                # portal on :3000 (uses ops/dev.sh)
# or, more explicit:
pnpm --filter portal dev
```

### Verify the install

```bash
pnpm test                               # runs Jest across the workspace
pnpm --filter portal test -- --testPathPatterns=smoke  # single file
```

If `pnpm test` is green and the portal loads at `http://localhost:3000`, you are ready to contribute.

## Architecture overview

The monorepo is an **Nx + pnpm workspaces** project (Turbo is a transitive dependency, but `nx run-many` is the entry point for every task). Top-level layout:

| Path                | Purpose                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/portal`       | Next.js 15+ (App Router, React 19) — the mining operations portal. Server Actions and API routes co-located with features. |
| `apps/cms`          | Payload CMS v3 headless content service.                                                                                   |
| `apps/overview`     | Standalone architecture visualization (React Flow).                                                                        |
| `apps/ci-observer`  | CI observation helper app.                                                                                                 |
| `pkgs/ui`       | Shared Radix + shadcn UI components. `widgets/` for composites.                                                            |
| `pkgs/theme`    | OKLCH design tokens + Tailwind preset (single source of truth).                                                            |
| `pkgs/supabase` | Browser, server, middleware, read-replica Supabase clients, and auto-generated database types.                             |
| `pkgs/database` | SQL migrations (source of truth) — never edit the Supabase copy.                                                           |
| `pkgs/redis`    | Redis cache helpers (used by `apps/portal/proxy.ts`).                                                                      |
| `pkgs/utils`    | Shared utilities (Inngest, Novu integrations).                                                                             |
| `pkgs/errors`   | Domain-specific error classes.                                                                                             |
| `pkgs/eval`     | Python/DeepEval AI compliance suite (separate Poetry env, not in `pnpm quality`).                                          |
| `tools/`            | Build-time scripts: policy compiler, tag applicator, circular-dep detector, MCP servers.                                   |
| `e2e/`              | Playwright E2E tests (visual snapshots, integration).                                                                      |

Deep dives live in `docs/DOCUMENTATION_INDEX.md` and `MONOREPO.md` — links at the end of this document.

## Quality gates

CI runs every gate on every PR. The order matters — each step is a hard fail.

| Order | Step                          | Command                                    | Blocks PR?  |
| ----- | ----------------------------- | ------------------------------------------ | ----------- |
| 1     | Dependency version lint       | `pnpm deps:lint` (syncpack)                | ✅          |
| 2     | Security audit                | `pnpm audit --audit-level=high --prod`     | ✅          |
| 3     | Dead-code detection           | `pnpm knip`                                | ✅          |
| 4     | Circular-dependency detection | `node tools/circular-dep-detect.cjs`       | ✅          |
| 5     | **Policy SSoT drift**         | `pnpm policy:check`                        | ✅          |
| 6     | Markdown lint                 | `pnpm md:lint`                             | ✅          |
| 7     | Secret scan (gitleaks)        | `gitleaks/gitleaks-action@v2`              | ✅          |
| 8     | Lint + Type-check             | `pnpm nx run-many -t lint type-check`      | ✅          |
| 9     | Token + CSS lint              | `pnpm nx run-many -t lint:tokens lint:css` | ✅          |
| 10    | Test with coverage            | `pnpm nx run-many -t test -- --coverage`   | ✅          |
| 11    | Build                         | `pnpm nx run-many -t build`                | ✅          |
| 12    | Bundle size check             | `pnpm bundlesize`                          | ✅          |
| 13    | Lighthouse CI (preview)       | `npx @lhci/cli@0.14.x autorun`             | ✅          |
| 14    | Self-healing CI               | `pnpm exec nx fix-ci` (best-effort)        | ⚠️ advisory |

**Local fast lane** (most changes do not need steps 12–14):

```bash
pnpm quality    # lint → type-check → test → lint:tokens → lint:css → format-check → lint-root → deps:lint → knip
```

Run `pnpm quality` before pushing. Husky's `pre-push` hook re-runs lint and type-check on the portal; CI re-runs the full list.

### Coverage thresholds (enforced by Jest)

- Lines 40 %, branches 30 %, functions 35 %, statements 40 %

If your change drops coverage, either add tests or explicitly raise the threshold in `jest.config.js` after a maintainer review.

## Adding a new package

The workspace uses pnpm's `catalog:` indirection and Nx project tags. New packages must participate in both.

### 1. Scaffold the package

```bash
mkdir -p pkgs/my-feature
cd pkgs/my-feature
pnpm init
```

`package.json` must:

- Set `"name": "@repo/my-feature"`.
- Reference shared dependencies via `"version": "catalog:"` or `"catalog:react19"` (see `pnpm-workspace.yaml`).
- Export its public API from `src/index.ts` (or named entries listed under `exports`).

### 2. Wire it into the workspace

`pnpm-workspace.yaml` already globs `pkgs/*`; no edit is needed for the package to be discoverable. Add an explicit entry only if the package lives outside the standard layout.

### 3. Tag the project for the policy compiler

```bash
node tools/apply-project-tags.cjs
```

This auto-tags every project under `apps/`, `pkgs/`, and `tools/` with the canonical `scope:*` vocabulary (`scope:app`, `scope:app:my-feature`, `scope:package`, `scope:package:my-feature`, `scope:package:db-internal` for `database`, `scope:tool` for `tools/*`). It writes/updates each `project.json` deterministically — review the diff before committing.

### 4. Register Nx targets

Add a `project.json` next to `package.json` (the tag script will create one if missing) and declare `build`, `lint`, `type-check`, and (for apps) `test` targets using the workspace executors. Look at `pkgs/ui/project.json` for a clean reference.

### 5. Declare dependency rules

Open `tools/policy-compiler.cjs` and add a `DEPENDENCY_RULES` entry that describes what your package can and cannot import (see "Adding a new dependency rule" below). Run `pnpm policy:gen` to regenerate `tools/policy/*.json` and the ESLint boundaries config.

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
tools/policy-compiler.cjs       (runtime CJS & Single Source of Truth)
        ↓ generates
tools/policy/dependency.rules.json
tools/policy/architecture.rules.json
tools/policy/security.checks.json
tools/policy/intent-map.json
tools/policy/eslint-boundaries.generated.cjs
```

The compiler has two modes:

- `pnpm policy:gen` — writes outputs to `tools/policy/`.
- `pnpm policy:check` — verifies outputs are in sync; **exits non-zero on drift**. CI runs this on every PR.

### Workflow

1. Edit only `tools/policy-compiler.cjs` (the Single Source of Truth).
2. Run `pnpm policy:gen` locally. Inspect the diff under `tools/policy/`.
3. Commit `tools/policy-compiler.cjs` and every regenerated JSON/CJS file as a single atomic change.
4. Push. The CI drift check will fail if the generated files are out of sync — that is by design.

If the SSoT is wrong (you cannot express your rule), extend the data model in `policy-compiler.cjs` first, regenerate, and only then add a new rule. The compiler is the contract.

## Adding a new dependency rule

Concrete example: forbid `pkgs/ui` from importing any of the Supabase client modules, so UI stays presentational.

### Step 1 — Express the rule in the SSoT

Edit `tools/policy-compiler.cjs` and add to the `DEPENDENCY_RULES` array:

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

This writes `tools/policy/dependency.rules.json` and `tools/policy/eslint-boundaries.generated.cjs` (which `@nx/enforce-module-boundaries` consumes).

### Step 3 — Verify drift-free

```bash
pnpm policy:check
```

The check must report no drift. If it reports drift, you edited the SSoT but forgot to commit a regenerated file.

### Step 4 — Confirm the rule actually fires

Add a temporary import in any file under `pkgs/ui` of `@repo/supabase/client` and run `pnpm nx run-many -t lint`. You should see the rule fire with your `reason` string in the error. Revert the import before committing.

### Step 5 — Commit

Stage `tools/policy-compiler.cjs`, `tools/policy/dependency.rules.json`, and `tools/policy/eslint-boundaries.generated.cjs` together. Use a conventional commit (`feat(policy): forbid ui → supabase imports`).

## Code conventions

These rules are enforced by ESLint, TypeScript, and code review. They are not optional.

- **TypeScript strict** — `"strict": true` is on. No `any`, no `// @ts-ignore`, no untyped exports. Use `unknown` + a type guard or Zod schema for boundary data.
- **Named icon imports** — always `import { Drill } from "lucide-react"`. Never `import * as Icons from "lucide-react"`. An unscoped import previously produced a 1.3 MB chunk.
- **Class merging** — always use `cn()` from `@repo/ui/lib/utils` (`import { cn } from "@repo/ui/lib/utils"`). Never concatenate class strings with template literals.
- **No raw shadows** — `box-shadow` and Tailwind `shadow-sm/md/lg` are forbidden. Use only the tokenized shadows: `shadow-card`, `shadow-window`, `shadow-diffusion-*`.
- **No hardcoded colors** — pull from design tokens (`@repo/theme`) or Tailwind tokens built from `pkgs/theme/tokens.json`. Hardcoded OKLCH/hex values in components are a CI lint failure.
- **Light theme only** — `data-theme="light"` is hardcoded in the head script. Do not add a dark-mode toggle, color-scheme overrides, or `prefers-color-scheme: dark` media queries. Dark mode does not exist.
- **Animation discipline** — animate only `opacity`, `transform`, `background-color`, `border-color`, `color`. Never animate layout properties. Easing is `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Glass pattern** — `bg-white/70 backdrop-blur-xl border border-black/[0.08]` is the standard surface.
- **Icon and path aliases** — `@/*` and `~/*` both resolve to `apps/portal/*`. `@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*` are conventional sub-cuts.
- **Server Actions validate first line** — `createServerSupabaseClient()` from `@repo/supabase/server` and validate the user as line one. See `.claude/rules/auth.md`.
- **Conventional commits** — enforced by commitlint. Husky `commit-msg` hook will reject non-conforming messages.

## Testing

| Suite                       | Command                                                  | Notes                                                                                                 |
| --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Unit (Jest, jsdom, ts-jest) | `pnpm test`                                              | Does not need Supabase.                                                                               |
| Single file                 | `pnpm --filter portal test -- --testPathPatterns=<file>` | Fast iteration loop.                                                                                  |
| E2E (Playwright)            | `pnpm test:e2e`                                          | Requires dev server on `:3000` and Chromium at `/usr/bin/google-chrome` (see `playwright.config.ts`). |
| Visual snapshots            | `e2e/visual/__snapshots__/`                              | Update with `playwright test --update-snapshots`.                                                     |
| AI compliance               | `pkgs/eval/`                                         | Python/DeepEval, separate Poetry env, not in `pnpm quality`.                                          |
| Coverage                    | `pnpm nx run-many -t test -- --coverage`                 | Thresholds: 40/30/35/40.                                                                              |

### Adding a new `@repo/*` import to a portal test

`apps/portal/jest.config.js` uses **explicit** `moduleNameMapper` entries. A new package or subpath import will fail with module-not-found unless you add the mapping. Update the map when introducing new package exports.

### Conventions

- Co-locate unit tests next to source as `*.test.ts(x)`.
- E2E lives in `e2e/` and is grouped by feature.
- Mock at the network boundary (Supabase, Redis), not at the function call.

## Database migrations

The **`employees` table is the source of truth** for authorization (role and department). Supabase Auth metadata is **not** used for authorization decisions.

### Workflow

1. Add a new file in `pkgs/database/migrations/` with a zero-padded sequence number: `NNN_description.sql` (e.g. `062_add_equipment_table.sql`). Files are processed in lexical order — gaps are allowed but discouraged.
2. Apply locally:

   ```bash
   pnpm --filter @repo/database supabase:push
   ```

3. Regenerate TypeScript types:

   ```bash
   pnpm --filter @repo/database supabase:gen
   ```

4. Commit **both** the migration and the updated `pkgs/supabase/src/database.types.ts` in a single atomic change.
5. **Never** edit `pkgs/supabase/supabase/migrations/` directly — that directory is a deploy-time copy produced by the build pipeline. A PreToolUse hook blocks edits there.

### RLS requirements

- Every new table must have Row-Level Security enabled (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`).
- The `no-raw-rls-disable` security check (see `tools/policy-compiler.cjs`) will fail CI if any migration disables RLS.
- Authorization policies should consult `employees.role` and `employees.department_id`, not `auth.uid()` alone.
- SQL privilege-escalation and index-coverage tests live in `pkgs/database/tests/`. Add tests for new tables that introduce new RLS roles or new index patterns.

### When to stop and ask for confirmation

Schema changes, RLS policy changes, and any change to authentication/authorization logic touch live data and security. **Pause for human review** before merging — at minimum, get a second pair of eyes on the PR.

## Troubleshooting

### `pnpm install` fails on lockfile mismatch

Run `pnpm install --no-frozen-lockfile` locally, then commit the updated `pnpm-lock.yaml`. CI uses `--frozen-lockfile` and will fail on any drift.

### `pnpm policy:check` reports drift

You (or a previous commit) edited `tools/policy-compiler.cjs` without regenerating. Run `pnpm policy:gen` and commit the output under `tools/policy/`.

### Supabase types are stale after a migration

```bash
pnpm --filter @repo/database supabase:gen
```

If the script errors, confirm the local Supabase stack is running (`pnpm --filter @repo/database supabase:dev`).

### Portal Jest cannot resolve `@repo/something`

Add the package to `moduleNameMapper` in `apps/portal/jest.config.js`. Wildcard mappings are not always sufficient for subpath exports — add explicit entries when needed.

### Pre-commit hook complains about secrets

Secretlint and gitleaks both run. If a real secret slipped in, rotate the credential first, then remove the value from the file (and history if necessary — see `SECURITY.md` for incident response).

### `pnpm quality` passes locally but CI fails

Most common cause: a generated file is missing or stale. Run `pnpm policy:gen && pnpm format && pnpm knip:fix` and re-push. If CI still fails, the most likely culprit is environment — check that the failing step does not require a service (Supabase, Redis) that the local run had.

### Circular dependency detected

`tools/circular-dep-detect.cjs` exits non-zero on cycles. Identify the cycle with `pnpm graph` (Nx) or `madge --circular pkgs/<pkg>`, then break it by moving the shared code into a new package or by introducing an interface at the boundary.

### Husky hook skipped with `--no-verify`

**Don't.** Pre-commit (lint-staged) and pre-push (lint + type-check) are there to keep `master` green. If a hook is broken, fix the hook or the underlying script — do not bypass it.

### Knock-on issues from codegen

After editing `pkgs/theme/tokens.json`, run `pnpm --filter @repo/theme build` and commit **both** the source tokens and the regenerated `pkgs/theme/src/tokens/generated.ts`. After editing migrations, run `supabase:gen` and commit the regenerated `database.types.ts`.

## Further reading

- **[MONOREPO.md](MONOREPO.md)** — Monorepo layout, packages, and Nx conventions.
- **[docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)** — Complete documentation index.
- **[DESIGN.md](DESIGN.md)** — Color system, typography, components, animation rules.
- **[PRODUCT.md](PRODUCT.md)** — User personas, product strategy, tone.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Deployment guide for all environments.
- **[SECURITY.md](SECURITY.md)** — Security policy and vulnerability reporting.
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Full documentation index and quick navigation.
- **[.claude/rules/](.claude/rules/)** — Auto-loaded domain rules (portal, auth, design-system, architecture, testing, verification).
