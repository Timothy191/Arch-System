# AGENTS.md

## What this is

Nx + pnpm monorepo: Next.js 15 portal (`apps/portal`), Payload CMS (`apps/cms`), React Flow (`apps/overview`), and `@repo/*` platform packages in `pkgs/`. Root folders use `NN_descriptive_snake_case` ranked by usage (see ADR-003).

## Before editing

- Run `pnpm policy:gen` after any change to `tools/policy-compiler.cjs` — generated output in `tools/policy/` must be committed in-sync.
- Adding a new `@repo/*` import in a portal test requires an explicit `moduleNameMapper` entry in `apps/portal/jest.config.js`.

## Commands (non-obvious ones)

| Task | Command |
|------|---------|
| Onboarding & Verification | Slash command `/init` (Workspace onboarding & health checks) |
| Full quality gate | `pnpm quality` |
| Single unit test | `pnpm --filter portal test -- --testPathPatterns=<file>` |
| E2E tests | `pnpm test:e2e` (needs `:3000` dev server + `/usr/bin/google-chrome`) |
| Start local Supabase | `pnpm --filter @repo/database supabase:dev` (Docker required) |
| Start Redis offload stack | `pnpm redis:dev` (`cache/` on `127.0.0.1:6380`) |
| Redis offload status | `pnpm redis:status` |
| Apply migrations locally | `pnpm --filter @repo/database supabase:push` |
| Regenerate DB types | `pnpm --filter @repo/database supabase:gen` |
| Token/CSS lint | `pnpm nx run-many -t lint:tokens lint:css` |
| Stylelint | `pnpm lint:styles` |
| Markdown lint | `pnpm md:lint` |
| Knip (dead-code) | `pnpm knip` |
| Lending library catalog | `python3 ops/lending-library/list-catalog.py` |
| Checkout / return skill | `python3 ops/lending-library/checkout-skill.py <name>` → `return-skill.py` |
| Effort triage | `python3 ops/agent-orchestrator/classify-effort.py "<task>"` |
| Pre-ship verify gate | `bash ops/agent-orchestrator/verify-gate.sh` |
| Audit RLS | `pnpm audit:rls` |

Order matters: lint → type-check → test → build. `pnpm quality` chains the main ones.

## Critical schemas & conventions

- `employees` table is the **authoritative source of truth** for authorization. Supabase Auth metadata is **not** used for access decisions.
- Every new table must have RLS enabled. `policy:check` and `audit:rls` both enforce this in CI.
- Migrations are zero-padded SQL files in `pkgs/database/migrations/` (e.g. `062_add_table.sql`), applied lexically. Commit migration + regenerated `pkgs/supabase/src/database.types.ts` as one atomic change.
- Design tokens: only use OKLCH tokens from `@repo/theme`. No hardcoded hex/oklch. No dark-mode toggle — light theme enforced.
- No raw CSS shadows: use `shadow-card`, `shadow-window`, `shadow-diffusion-*`.
- `cn()` from `@repo/ui/lib/utils` for class merging, never template literals.
- Named icon imports only: `import { Drill } from "lucide-react"`. Unscoped `* as Icons` created a 1.3 MB chunk.
- Server Actions: `createServerSupabaseClient()` + validate user as line one.
- Commitlint enforces conventional commits. Pre-commit (lint-staged) and pre-push (lint + type-check) are Husky hooks.

## pnpm / pnpm workspace

- Manager: pnpm 9.15.9 (Volta pins `24.15.0` node). Install deps with `pnpm install`.
- `apps/*` and `pkgs/*` are workspace roots; feature libs live under `libs/features/*/*`.
- Shared dependencies use `catalog:` or `catalog:react19` indirection (see `pnpm-workspace.yaml`).

## Architecture & Boundaries

- **Frontend Boundaries**: The frontend UI layer (`apps/portal/components`, `libs/features/*/ui`, `"use client"` modules) MUST NEVER import from `scripts/`, `infra/`, `@repo/redis`, or `@repo/supabase/server` directly. Backend utilities and data access should be encapsulated in `data-access` libraries or API routes.

## Nx specifics

- Build depends on `^build` + `^codegen` + `sync-assets`. The `sync-assets` target copies `assets/` into `apps/portal/public/`.
- Nx remote cache is S3-backed (reads `NXCACHE_S3_*` envs); targets without those envs still work.
- Default base branch: `master` (not `main`).

## E2E / Playwright

- Tests in `e2e/` use a global setup that produces `e2e/.auth/user.json` storage state reused across chromium/mobile/tablet projects.
- In CI, workers = 1 and retries = 2; locally uses default parallelism.
- Snapshots directory: `e2e/visual/__snapshots__/`; update with `playwright test --update-snapshots`.

## Failure modes to watch for

- `pnpm quality` green locally, red on CI: stale generated file. Run `pnpm policy:gen && pnpm format && pnpm knip:fix`.
- `pnpm install` lockfile drift: use `--no-frozen-lockfile` locally, commit updated `pnpm-lock.yaml`. CI uses `--frozen-lockfile`.
- Supabase types staleness: `supabase:gen` fails if local stack isn't running.
- Next.js 15 + Turbopack: `turbopack.root` is set to workspaceRoot so `pkgs/` deps compile.
