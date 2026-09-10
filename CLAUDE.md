# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Arch-Systems (Plantcor) is a multi-departmental mining operations portal built as an **Turborepo 2.x + pnpm** monorepo. It serves authenticated, department-specific dashboards (drilling, production, access control, engineering, control room, safety, training, satellite monitoring).

## Environment

- **Node** `>=22` (Volta pins `24.15.0`), **pnpm** `9.15.9`, ESM (`"type": "module"`).
- Docker required for local Supabase. Husky hooks install on `pnpm install`.
- Follows XDG Base Directory specification - all user files stay in appropriate `~/.config`, `~/.local/share`, etc.

## Common Commands

```bash
pnpm install
cp apps/portal/env/.env.example apps/portal/.env          # fill Supabase + Sentry keys
pnpm --filter @repo/database supabase:dev                 # local Postgres + Auth (:54321), separate terminal
pnpm dev                                                  # portal on :3000 (scripts/dev.sh)
pnpm quality                                              # full quality gate — run before push
```

### Development Targets

| Action                             | Command                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Build all                          | `pnpm build`                                                                 |
| Build one project                  | `pnpm turbo run build --filter=<name>` or `pnpm --filter @repo/<name> build` |
| Lint all / one                     | `pnpm lint` · `pnpm turbo run lint --filter=<name>`                          |
| Type-check all / one               | `pnpm type-check` · `pnpm turbo run type-check --filter=<name>`              |
| All unit tests                     | `pnpm test`                                                                  |
| Single portal test file            | `pnpm --filter portal test -- --testPathPatterns=<file>`                     |
| E2E (needs portal on :3000)        | `pnpm test:e2e`                                                              |
| Visual E2E snapshots               | `pnpm test:e2e:visual`                                                       |
| Storybook                          | `pnpm ui` (opens `@repo/ui` Storybook)                                       |
| Storybook a11y                     | `pnpm test:a11y`                                                             |
| Format                             | `pnpm format`                                                                |
| Deploy (local/staging/production)  | `pnpm deploy:local` / `:staging` / `:production`                             |
| Deploy via Cloudflare Tunnel       | `pnpm deploy:cloudflare` (interactive; dev/production modes)                 |
| Rollback production deploy         | `pnpm deploy:rollback` (`deploy.sh production --rollback`)                   |
| Dev server exposed via tunnel      | `pnpm dev:cloudflare` · `pnpm dev:hosted`                                    |
| Verify prod env + standalone build | `./scripts/verify-prod-env.sh .env.production`                               |
| Generate DB types                  | `pnpm db-gen`                                                                |
| Push DB migrations                 | `pnpm db-push`                                                               |
| Reset local DB                     | `pnpm db-reset` (destructive)                                                |
| Start local Supabase               | `pnpm db-start`                                                              |
| Generate DB docs                   | `pnpm db-docs`                                                               |
| Start monitoring HUD               | `pnpm monitor`                                                               |
| Start Grafana stack                | `pnpm monitor:grafana`                                                       |
| Stop Grafana stack                 | `pnpm monitor:grafana-stop`                                                  |

### Makefile Shortcuts

All common commands are also available via `make`:

- `make dev` - equivalent to `pnpm dev`
- `make dev-quick` - dev mode without Docker/Supabase
- `make dev-tools` - dev with additional tools (Redis, Flowise)
- `make dev-all` - dev with all apps (portal, CMS, overview)
- `make build` - build everything
- `make test` - run unit tests
- `make test:e2e` - run E2E tests
- `make test:watch` - test watch mode
- `make test:coverage` - test with coverage
- `make lint` - run ESLint
- `make lint:fix` - auto-fix lint issues
- `make type-check` - TypeScript checking
- `make format` - Prettier formatting
- `make format:check` - check formatting only
- `make quality` - full quality gate (lint + type-check + test + format + deps + knip + policy)
- `make deps:lint` - check dependency versions
- `make deps:fix` - auto-fix dependency versions
- `make knip` - check for unused exports/deps
- `make knip:fix` - remove unused exports/deps
- `make md:lint` - lint markdown
- `make md:fix` - auto-fix markdown
- `make policy:gen` - generate policy files
- `make policy:check` - validate architectural boundaries
- `make audit:rls` - audit Row-Level Security policies
- `make audit:design` - run design system audit
- `make fresh-start` - clean rebuild from scratch
- `make shutdown` - stop all services
- `make clean` - remove build artifacts & caches
- `make clean-cache` - clear Turborepo cache only
- `make clean-docker` - stop & remove Docker containers/volumes

## Architecture Overview

### Monorepo Structure

```
apps/
├── portal/          # Main Next.js 16 app (App Router, React 19) - user dashboards
├── cms/             # Payload CMS v3 (headless) - content management
├── overview/        # Standalone Next.js app - system architecture visualization
└── ci-observer/     # CI observation helper app

packages/
├── theme/           # Design tokens (OKLCH), Tailwind config (SSOT)
├── ui/              # Shared React components (Radix UI, shadcn/ui)
├── supabase/        # Supabase clients (browser/server/middleware) + auth
├── database/        # SQL migrations & SSoT for all schema changes
├── redis/           # Redis caching & rate-limiting clients
├── rate-limiter/    # Rate limiting primitives
├── errors/          # Shared error types & handling
├── logger/          # Structured logging
├── eval/            # Evaluation utilities
├── contract/        # API contract tests / drift detection
├── utils/           # Date/formatting/shift helper functions
└── types/           # Shared TypeScript interfaces & types

tools/
├── repo/policy-compiler.cjs      # SSoT policy compiler → generates rules + eslint boundaries
├── audits/design-audit.cjs        # Validates OKLCH color usage & theme compliance
├── audits/enforce-security-checks.cjs # Blocks eval, hardcoded secrets, SQL concat
└── audits/audit-rls.cjs          # Static RLS policy auditor

scripts/
├── sync-assets-smart.cjs    # Asset synchronization utility
└── ensure_reachability.py   # Network connectivity validation
```

### Key Architectural Constraints

1. **Boundary Enforcement**: UI packages cannot import from database or Supabase packages directly (checked via `pnpm policy:check`)
2. **Design System**: All colors must use OKLCH format from `@repo/theme` (validated by `pnpm audit:design`)
3. **Security**: Static analysis blocks `eval()`, string-concatenated SQL, and hardcoded secrets
4. **Data Access**: All Supabase interactions go through `@repo/supabase` layer with proper RLS policies
5. **Type Safety**: End-to-end TypeScript with strict `turbo.json` boundary rules
6. **Authorization SSoT**: The `employees` table is the source of truth for role + department. RLS must be enabled on every new table.
7. **Auth Middleware**: `apps/portal/middleware.ts` is a thin edge shim delegating to `apps/portal/server/proxy.ts` (session refresh, role/department route gating, Redis-cached department slug → UUID resolution). API routes `/api/c66`, `/api/health`, `/api/metrics` and static assets are exempt.
8. **Migrations SSoT**: Only `packages/database/migrations/NNN_description.sql` is source of truth. NEVER edit `packages/supabase/supabase/migrations/` — it's a deploy-time copy (a PreToolUse hook blocks edits there).
9. **Policy SSoT**: `tools/repo/policy-compiler.cjs` generates `tools/repo/policy/*.json` + `tools/repo/policy/eslint-boundaries.generated.cjs`. Edit the compiler, then run `pnpm policy:gen`; CI fails on drift (`pnpm policy:check`).
10. **Generated output**: Never hand-edit generated files (`packages/theme/src/tokens/generated.ts`, `variables-generated.css`, generated DB types). Regenerate via their source commands instead.

## Deployment (Cloudflare Tunnel + Edge CDN)

Primary edge topology (post-Tailscale migration): **Cloudflare Edge WAF → cloudflared tunnel → local services**. No inbound ports are opened on the host. Full guide: `docs/DEPLOYMENT.md`; config: `infra/cloudflared/`.

| Concern                                                                                                                                       | Where                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Unified deploy orchestrator (pre-flight checks, backups, rollback, deploy lock, `--dry-run`, `--skip-build`/`--skip-tests`, `--migrate-only`) | `scripts/deploy.sh` (`local`/`staging`/`production`) |
| Tunnel orchestrator (interactive dev/production modes, Supabase stack orchestration, ingress validation)                                      | `scripts/deploy-cloudflare.sh`                       |
| Production tunnel ingress (portal `:3000`, FUXA SCADA UI `:8088`, `fuxa-api`, optional Supabase REST `:54321`, catch-all 404)                 | `infra/cloudflared/production-tunnel.yml.example`    |
| SCADA tunnel config                                                                                                                           | `infra/cloudflared/fuxa-tunnel.yml`                  |
| Prod setup (systemd unit, Docker tools/monitoring stacks, Rocky/RHEL guidance)                                                                | `scripts/setup-production-environment.sh`            |

### Production serving mode

Portal is built with `output: "standalone"` (`apps/portal/next.config.mjs`) — the deploy artifact is `apps/portal/.next/standalone/apps/portal/server.js`. Post-build you must sync static/public assets into the standalone bundle:

```bash
pnpm --filter portal build
cp -r apps/portal/public apps/portal/.next/standalone/apps/portal/public
cp -r apps/portal/.next/static apps/portal/.next/standalone/apps/portal/.next/static
```

After editing the tunnel ingress YAML, validate before running:

```bash
cloudflared tunnel --config infra/cloudflared/production-tunnel.yml.example ingress validate
```

Deploy failures leave a `deploy-*.log` at repo root — `tail -f deploy-*.log` to debug.

### Critical Development Flows

#### Database Changes

1. Modify SQL in `packages/database/migrations/`
2. Run `pnpm db-push` to apply to local Supabase
3. Run `pnpm db-gen` to regenerate TypeScript types
4. Commit both migration files and generated types

#### UI/Component Development

1. Develop in `packages/ui/` with Storybook (`pnpm ui`)
2. Follow shadcn/ui + Radix UI patterns
3. Use tokens from `@repo/theme` exclusively
4. Test accessibility with `pnpm test:a11y`

#### Feature Development (Portal)

1. Create route in `apps/portal/app/` using Next.js App Router
2. Access data via `@repo/supabase` clients (browser/server)
3. Use shared components from `@repo/ui`
4. Apply layouts from `@repo/ui` (DepartmentLayout, etc.)
5. Validate with `pnpm --filter portal test -- --testPathPatterns=<feature>`

#### Supabase Setup

1. Requires Docker: `pnpm db-start` launches Supabase stack
2. Studio available at <http://localhost:54323>
3. Anonymous API: <http://localhost:54321>
4. Service role key available for server-side operations
5. Database resets: `pnpm db-reset` (WARNING: destructive)

### Testing Strategy

- **Unit Tests**: Vitest (via Turborepo test pipeline) - co-located with implementation
- **E2E Tests**: Playwright - requires dev server running on :3000
- **Visual Tests**: Playwright image snapshots for UI regression detection
- **Accessibility**: axe-core automated scanning (`pnpm test:a11y`)
- **Coverage**: `pnpm --filter portal test -- --coverage` (thresholds enforced: lines 40%, branches 30%, functions 35%, statements 40%)

### Code Generation

1. **Design Tokens**: `pnpm turbo run codegen --filter=theme` converts CSS variables to TypeScript
2. **Database Types**: `pnpm db-gen` generates TS from Supabase schema
3. **Token Validation**: `pnpm turbo run lint:tokens --filter=theme` validates design token usage
4. **CSS Linting**: `pnpm turbo run lint:css --filter=theme` ensures Stylelint compliance

### Pre-Commit & CI

- Husky runs `pnpm lint --fix` and `pnpm format` on commit
- Commitlint enforces conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- CI runs full `pnpm quality` gate on all PRs
- Never use `--no-verify` - fixes must pass local quality checks

### Troubleshooting

- **Port Conflicts**: If :3000 is busy, kill existing Next.js processes
- **Supabase Connection**: Verify `pnpm db-start` running and .env credentials
- **Type Errors**: Run `pnpm type-check` to catch TS issues early
- **Lint Failures**: Use `pnpm lint --fix` for auto-fixable issues
- **Tests Flaky**: Check for missing awaits or race conditions in test setup
- **Policy Violations**: Review `tools/repo/policy-compiler.cjs` for boundary rules

## File Conventions

- **Component Files**: PascalCase with `.tsx` extension
- **Hook Files**: `use*` prefix in `packages/utils/hooks/` or feature-specific
- **Utils**: Pure functions in `packages/utils/` with descriptive names
- **Tests**: `.test.ts` or `.test.tsx` files co-located with source
- **Styles**: CSS modules (`*.module.css`) or Tailwind utility classes
- **Env Vars**: Prefixed with `NEXT_PUBLIC_` for client-side exposure
- **Database**: SQL migrations in `packages/database/migrations/` with timestamp prefix
- **Config**: Environment-specific in `/env/` directories, never committed raw

## When in Doubt

1. Check `MONOREPO.md` for detailed workspace structure
2. Consult `README.md` for department-specific dashboard info
3. Review `tools/repo/policy-compiler.cjs` for architectural boundaries
4. Look at existing similar features for patterns
5. Run `pnpm lint` and `pnpm type-check` before complex changes
6. Validate design system usage with `pnpm audit:design`
7. Test boundary violations with `pnpm policy:check`

<!-- turbo configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Turbo

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `turbo` (i.e. `turbo run <task>`, `turbo run <task> --filter=<name>`) instead of using the underlying tooling directly
- Prefix turbo commands with the workspace's package manager (e.g., `pnpm turbo run build`) - avoids using globally installed CLI
- Use `--filter=<name>` to scope a task to a single app/package (e.g. `pnpm turbo run lint --filter=portal`)
- Use `--filter=...[HEAD~1]` for affected-only runs (e.g. `pnpm turbo run test --filter=...[HEAD~1]`)
- NEVER guess CLI flags - always check `pnpm turbo run <task> --help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), follow the existing package layout in `packages/` and `apps/`; there is no generator CLI in the Turbo setup

<!-- turbo configuration end-->
