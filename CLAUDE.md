# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Arch-Systems (Plantcor) is a multi-departmental mining operations portal built as an **Nx 22 + pnpm** monorepo. It serves authenticated, department-specific dashboards (drilling, production, access control, engineering, control room, safety, training, satellite monitoring).

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

| Action                            | Command                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| Build all                         | `pnpm build`                                                 |
| Build one project                 | `pnpm nx build <name>` or `pnpm --filter @repo/<name> build` |
| Lint all / one                    | `pnpm lint` · `pnpm nx lint <name>`                          |
| Type-check all / one              | `pnpm type-check` · `pnpm nx type-check <name>`              |
| All unit tests                    | `pnpm test`                                                  |
| Single portal test file           | `pnpm --filter portal test -- --testPathPatterns=<file>`     |
| E2E (needs portal on :3000)       | `pnpm test:e2e`                                              |
| Visual E2E snapshots              | `pnpm test:e2e:visual`                                       |
| Storybook                         | `pnpm ui` (opens `@repo/ui` Storybook)                       |
| Storybook a11y                    | `pnpm test:a11y`                                             |
| Format                            | `pnpm format`                                                |
| Deploy (local/staging/production) | `pnpm deploy:local` / `:staging` / `:production`             |
| Generate DB types                 | `pnpm db-gen`                                                |
| Push DB migrations                | `pnpm db-push`                                               |
| Reset local DB                    | `pnpm db-reset` (destructive)                                |
| Start local Supabase              | `pnpm db-start`                                              |
| Generate DB docs                  | `pnpm db-docs`                                               |
| Start monitoring HUD              | `pnpm monitor`                                               |
| Start Grafana stack               | `pnpm monitor:grafana`                                       |
| Stop Grafana stack                | `pnpm monitor:grafana-stop`                                  |

### Makefile Shortcuts

All common commands are also available via `make`:

- `make dev` - equivalent to `pnpm dev`
- `make dev-quick` - dev mode without Docker/Supabase
- `make dev-tools` - dev with additional tools (Redis, n8n, Flowise)
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
- `make clean-cache` - clear Nx cache only
- `make clean-docker` - stop & remove Docker containers/volumes

## Architecture Overview

### Monorepo Structure

```
apps/
├── portal/          # Main Next.js 15+ app (App Router) - user dashboards
├── cms/             # Payload CMS v3 (headless) - content management
└── overview/        # Standalone Next.js app - system architecture visualization

packages/
├── theme/           # Design tokens (OKLCH), Tailwind config (SSOT)
├── ui/              # Shared React components (Radix UI, shadcn/ui)
├── supabase/        # Supabase clients (browser/server/middleware) + auth
├── database/        # SQL migrations & Supabase schema management
├── utils/           # Date/formatting/shift helper functions
└── types/           # Shared TypeScript interfaces & types

tools/
├── policy-compiler.cjs      # Enforces architectural boundaries (nx.json)
├── design-audit.cjs         # Validates OKLCH color usage & theme compliance
├── enforce-security-checks.cjs # Blocks eval, hardcoded secrets, SQL concat
└── apply-project-tags.cjs   # Applies Nx scope tags to new projects

scripts/
├── sync-assets-smart.cjs    # Asset synchronization utility
└── ensure_reachability.py   # Network connectivity validation
```

### Key Architectural Constraints

1. **Boundary Enforcement**: UI packages cannot import from database or Supabase packages directly (checked via `pnpm policy:check`)
2. **Design System**: All colors must use OKLCH format from `@repo/theme` (validated by `pnpm audit:design`)
3. **Security**: Static analysis blocks `eval()`, string-concatenated SQL, and hardcoded secrets
4. **Data Access**: All Supabase interactions go through `@repo/supabase` layer with proper RLS policies
5. **Type Safety**: End-to-end TypeScript with strict `nx.json` boundary rules

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

- **Unit Tests**: Vitest (via Nx test target) - co-located with implementation
- **E2E Tests**: Playwright - requires dev server running on :3000
- **Visual Tests**: Playwright image snapshots for UI regression detection
- **Accessibility**: axe-core automated scanning (`pnpm test:a11y`)
- **Coverage**: `pnpm --filter portal test -- --coverage`

### Code Generation

1. **Design Tokens**: `pnpm nx run theme:codegen` converts CSS variables to TypeScript
2. **Database Types**: `pnpm db-gen` generates TS from Supabase schema
3. **Token Validation**: `pnpm nx run theme:lint:tokens` validates design token usage
4. **CSS Linting**: `pnpm nx run theme:lint:css` ensures Stylelint compliance

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
- **Policy Violations**: Review `tools/policy-compiler.cjs` for boundary rules

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
3. Review `tools/policy-compiler.cjs` for architectural boundaries
4. Look at existing similar features for patterns
5. Run `pnpm lint` and `pnpm type-check` before complex changes
6. Validate design system usage with `pnpm audit:design`
7. Test boundary violations with `pnpm policy:check`
