# Arch-System — Development Commands

> Extracted from the former monolithic `AGENTS.md`. Loaded on demand.

## Development Commands

### Package Management & Setup

```bash
# Bootstrap entire repository (Node validation, dependencies, tokens, policies)
./setup.sh

# Bootstrap with clean slate
./setup.sh --clean

# Install via pnpm directly (runs postinstall: patch-glass-css.mjs)
pnpm install
```

### Development & Local Run

```bash
# Full interactive local dev system (smart asset sync + Turbopack + Monitor HUD)
pnpm dev

# Fast development server targeting the portal application directly
pnpm dev:turbo

# Fast headless startup
pnpm dev:quick

# Start development companion services in Docker (Postgres, Redis, tools)
pnpm dev:tools

# Start local AI tooling stack (Docker)
pnpm dev:ai

# Start dev server with Cloudflare tunnel
pnpm dev:cloudflare

# Start dev server connecting to hosted remote services
pnpm dev:hosted

# Start Storybook component workbench (port 6006)
pnpm --filter @repo/ui storybook

# Start local Inngest background event dev server
pnpm inngest:dev
```

### Build & Production

```bash
# Full monorepo build via Turborepo (syncs assets + builds all packages)
pnpm build

# Build only the portal application
pnpm --filter portal build

# Start production Next.js server (binds to 0.0.0.0:3000)
pnpm start

# Clear Next.js, Turborepo, and system runtime caches
pnpm clean:caches

# Analyze production bundle distribution
pnpm analyze
```

### Type Checking, Linting & Quality

```bash
# Comprehensive full-suite quality verification (Turborepo lint, typecheck, test, tokens, CSS, knip, policy, gates)
pnpm quality

# Type-check all packages via Turborepo (tsc --noEmit)
pnpm type-check

# Type-check single workspace
pnpm --filter @repo/contract type-check
pnpm --filter portal type-check

# Format entire codebase with Biome
pnpm format

# Verify formatting compliance without modifying files
pnpm format:check

# Run Biome linter across all workspaces
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Stylelint on CSS/tokens (verifies OKLCH token usage & animation performance)
pnpm lint:styles
pnpm lint:css-perf

# Spellcheck across codebase
pnpm lint:spelling

# Detect dead code and unused exports
pnpm knip
pnpm knip:fix

# Syncpack dependency alignment across package.json files
pnpm deps:check
pnpm deps:fix
pnpm deps:lint
```

### Policy & Quality Gates

```bash
# Compile architectural rules into ESLint boundaries
pnpm policy:gen

# Verify architectural rules and security checks in CI
pnpm policy:check

# Run 4-gate reality enforcement script (ARWR, tests, modernization, strict TS)
pnpm verify:gates

# Audit database schema vs contract synchronization
pnpm audit:drift

# Audit Row Level Security coverage and InitPlan optimizations
pnpm audit:rls
pnpm audit:rls-matrix

# Audit design token compliance (detects raw colors and forbidden dark: classes)
pnpm audit:tokens

# Audit Tailwind utility composition (class chain budget + repeated chain extraction)
pnpm audit:tailwind

# Audit & synchronize MCP server registrations across all 7 agent runtimes
pnpm mcp:verify
pnpm mcp:onboard
```

### Local CI Runner (Actions Substitute)

`pnpm agent:verify` is a monorepo-wide gate; it is **not** a mirror of
`.github/workflows/ci.yml`. When Actions cannot run at all (account billing
lock, runner outage, self-hosted runner offline), pushes get no server-side
verification. `tools/scripts/local-ci.mjs` replays the runnable subset of the
three gate workflows (`ci.yml`, `ga.yml`, `theme-ci.yml`) locally, job by job
and step by step.

```bash
# Core suite: static/deterministic jobs against the current checkout
pnpm ci:local

# Add build, test, e2e, lighthouse, redis-integration, migration-replay jobs
pnpm ci:local:full

# Validate a pull request in an isolated detached worktree (fetch + merge-base + install)
pnpm ci:local -- --pr=182

# Narrow to specific jobs; see the resolved plan without executing anything
pnpm ci:local -- --jobs=policy-check,knip
pnpm ci:local -- --list

# Flags: --suite=core|full  --redis=auto|off  --no-install  --keep  --dry-run  --help
```

Behaviour worth knowing before trusting the output:

- **Allowlist execution.** Steps are matched by `"<job> :: <step name>"`
  against a reviewed table. Anything unrecognised is reported `unmp`
  (UNMAPPED) and never executed, so the runner cannot be talked into running
  an arbitrary `run:` block. Edit `LOCAL_STEPS` in the script to widen coverage.
- **Two statuses are not pass.** `gh—` is an Actions-only `uses:` step with no
  local analogue; `skip` means a required binary or service is absent. Both are
  echoed under _not covered locally_ and recorded in `uncovered` in the report.
- **Reports** land in `.ci-local/report-<utc>.json` plus
  `.ci-local/report-latest.json` (git-ignored) with per-step status, detail,
  captured output, ref, suite, and Node version — attach that content as merge
  evidence when Actions is red for non-gate reasons.
- **Exit code** is 1 if any job has a failing step.
- PR mode fetches `pull/<n>/head` into `refs/ci-local/pr-<n>`, creates a
  detached worktree, symlinks the local `.env` files (values are never
  printed), runs a frozen install, then removes the worktree. `--keep` retains
  it for inspection; the ref is always deleted.
- Redis jobs reuse a live `localhost:6379` if reachable, otherwise start an
  ephemeral `redis:7.4-alpine` container and stop it on exit. gitleaks runs
  through the upstream Docker image pointed at
  `config/tools/.gitleaks.toml` (the workflow's `GITLEAKS_CONFIG` path does not
  exist).

Drift the runner cannot close: CodeQL init/analyze, Trivy, tflint, SBOM
generation, tier-2 `actions/github-script` checks, and every deploy/preview
workflow are excluded by design. `pnpm audit --audit-level=high --prod` and
`pnpm md:lint` currently fail on pre-existing debt that was never gated because
Actions never ran — read them as a backlog, not as a regression from the change
under test.

### Database & Migrations

```bash
# Start local Supabase container stack (migrations live in @repo/database/migrations)
pnpm --filter @repo/database supabase:start

# Reset local database and re-apply all migrations cleanly
pnpm --filter @repo/database supabase:reset

# Generate TypeScript database types (src/database.types.ts)
pnpm --filter @repo/supabase supabase:gen-types

# Lint migrations + verify tree consolidation (symlinks, drift, relation hygiene)
pnpm --filter @repo/database check-migrations

# Run migration rollback safety static analysis + offline mutation security checks
pnpm --filter @repo/database test

# Seed local database via tsx
pnpm db:seed

# Reload PostgREST schema cache
pnpm db:schema-reload

# Generate database markdown documentation
pnpm db:docs
```

---
