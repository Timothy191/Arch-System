# Repository Guidelines

## Project Overview

Arch-Systems (Plantcor) is a mining operations portal built as an **Nx + pnpm monorepo**. It provides authenticated, department-specific dashboards for drilling, production, access control, engineering, control room, safety, training, and satellite monitoring. The stack is deliberately offline-first: manual human data entry is the source of truth; sensor feeds are secondary enrichment.

Primary surface: `apps/portal` (Next.js 15 App Router, React 19, Turbopack). Supporting surfaces: Payload CMS v3 (`apps/cms`), a React Flow architecture visualizer (`apps/overview`), and an Axum + sqlx Rust API (`apps/rust-backend`). Shared code lives in `pkgs/*`, `libs/features/*/*`, `libs/shared/*`, and greenfield modules under `src/*`.

## Architecture & Data Flow

### Application layer

- `apps/portal/app/(auth)/` — login, reset-password, update-password.
- `apps/portal/app/(hub)/` — post-login landing dashboard with department grid.
- `apps/portal/app/(departments)/[department]/` — drilling, production, access-control, engineering, control-room, safety, training, satellite-monitoring, access-card-actions.
- `apps/portal/app/admin/` — restricted admin surface.
- `apps/portal/app/api/**` — 36+ API routes (auth, telemetry, exports, health, metrics, printers, webhooks, agent chat, sync, etc.).
- `apps/portal/app/actions.ts` and department `actions.ts` — Server Actions for logout, RSC revalidation, PDF generation.

### Auth & authorization

- **`employees` table is the source of truth** for role, `department_id`, and `accessible_departments`. Supabase Auth metadata is **not** used for access decisions.
- `apps/portal/middleware.ts` delegates to `apps/portal/server/proxy.ts`, which reads `employees` and gates `RESTRICTED_ROUTES`. Department slugs are resolved to UUIDs via Redis (`dept:uuid:<slug>`).
- RLS policies in `pkgs/database/migrations/` use helpers like `public.is_admin()` and `public.has_department_access(department_id)`. Critical migrations: `043_admin_data_lockdown.sql`, `081_access_control_employees_rls.sql`, `096_tenant_rls_policies.sql`.
- Every new table must enable RLS. Enforced by `pnpm audit:rls` and `pnpm policy:check`.

### Client / server boundaries

- Server-only code imports `createServerSupabaseClient` from `@repo/supabase/server` and validates the user on line one.
- Client code uses `createBrowserSupabaseClient` from `@repo/supabase/client`. UI files must **never** import `server-only`, `@repo/supabase/server`, `@repo/redis`, `scripts/`, or `infra/`.
- Server Components fetch directly via Supabase server client or the read-replica client (`@repo/supabase/read-replica`).
- Complex queries use Kysely (`@repo/supabase/kysely`) against `DATABASE_URL`.
- Client mutations call API routes (e.g., `useLogin` → `POST /api/auth/login`) or Server Actions.
- Telemetry/exports validate with Zod schemas from `@repo/contract`. OpenAPI docs are generated from JSDoc comments.
- Redis caching uses `CacheCategory` + `CACHE_TTL_REGISTRY` with tag-based invalidation.

### Cross-cutting concerns

- Logging: `@repo/logger` (Pino) with server/browser/Next.js entry points.
- Errors: `@repo/errors` structured classes (`AppError`, `ValidationError`, `AuthError`, `ForbiddenError`, etc.).
- Observability: Sentry, OpenTelemetry, Prometheus metrics route, web-vitals reporter.
- Async workflows: Inngest (`@repo/utils/inngest`), n8n webhooks.
- Rate limiting: `@repo/rate-limiter` and `apps/portal/lib/api/rate-limit-middleware.ts` (Redis + in-memory fallback).

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `apps/portal` | Main Next.js 15 App Router portal. |
| `apps/cms` | Payload CMS v3 headless content service. |
| `apps/overview` | React Flow architecture visualizer (Next.js 16, port 3002). |
| `apps/rust-backend` | Axum + sqlx Rust API with Supabase JWT validation. |
| `pkgs/theme` | OKLCH design tokens, Tailwind preset, CSS variables, React theme provider. |
| `pkgs/ui` | Radix + shadcn component library with named subpath exports. |
| `pkgs/supabase` | Browser/server/middleware/read-replica/service-role clients, Kysely, generated DB types. |
| `pkgs/database` | SQL migration source of truth. Never edit the Supabase deploy copy directly. |
| `pkgs/contract` | Zod schemas + inferred TypeScript types for cross-boundary contracts. |
| `pkgs/redis` | Redis client, `cacheGet`/`cacheSet`/`cacheWrap`, TTL registry. |
| `pkgs/errors` | Structured error classes. |
| `pkgs/logger` | Pino logging. |
| `pkgs/utils` | Integrations: Inngest, Novu, Excel, shift helpers. |
| `pkgs/rate-limiter` | Pluggable rate limiter with memory/Redis stores. |
| `libs/features/auth/*` | Auth UI, data-access, and utilities. |
| `libs/features/departments/*` | Department-specific UI and data-access. |
| `libs/features/dashboard/data-access` | Dashboard service/types. |
| `libs/features/hub/ui` | Hub landing components. |
| `libs/features/access-control/ui` | Access-control UI. |
| `libs/features/analytics/data-access` | Analytics utilities. |
| `libs/shared/*` | Shared data-access, hooks, utils, styles. |
| `src/00_core_modules` | Greenfield modules: `portal-auth`, `portal-glass`. |
| `ops/` | Dev, deploy, monitoring, agent-orchestrator, lending-library, memory scripts. |
| `tools/` | Policy compiler, security/design/RLS audits, graph health. |
| `docs/` | VitePress wiki, ADRs, runbooks. |
| `e2e/` | Playwright E2E specs. |

## Runtime / Tooling Preferences

- **Node**: `>=22` (Volta pins `24.15.0`).
- **Package manager**: `pnpm@9.15.9`. Use `pnpm install`; CI uses `--frozen-lockfile`.
- **Monorepo**: Nx 22.7.5 with S3-backed remote cache (`NXCACHE_S3_*` envs).
- **TypeScript**: ES2022, ESNext, bundler resolution, strict mode.
- **Default base branch**: `master` (not `main`).
- **Build graph**: `build` depends on `^build`, `^codegen`, and `sync-assets`. Theme codegen produces `src/tokens/generated.ts`; `assets/` are checksum-synced into `apps/portal/public/`.

## Development Commands

### Core workflow

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Full dev stack | `pnpm dev` or `bash ops/dev.sh` |
| Quick dev (portal only) | `bash ops/dev.sh --quick` |
| Build everything | `pnpm build` |
| Lint | `pnpm lint` |
| Type check | `pnpm type-check` |
| Test | `pnpm test` |
| Full quality gate | `pnpm quality` |
| Format | `pnpm format` |

### Database & local infrastructure

| Task | Command |
|------|---------|
| Start local Supabase | `pnpm --filter @repo/database supabase:dev` |
| Apply migrations | `pnpm --filter @repo/database supabase:push` |
| Regenerate DB types | `pnpm --filter @repo/database supabase:gen` |
| Sync migrations → supabase dir | `pnpm policy:migrations:sync` |
| Audit RLS | `pnpm audit:rls` |
| Start Redis offload | `pnpm redis:dev` |
| Redis status/stop | `pnpm redis:status` / `pnpm redis:stop` |

### Quality, policy & security

| Task | Command |
|------|---------|
| Full quality gate | `pnpm quality` |
| Regenerate policy files | `pnpm policy:gen` |
| Check policy/security | `pnpm policy:check` |
| Run security scan | `pnpm policy:security` |
| Design-system audit | `pnpm audit:design` |
| Dependency lint | `pnpm deps:lint` |
| Dead-code check | `pnpm knip` |
| Root ESLint | `pnpm lint:root` |
| CSS/style lint | `pnpm lint:styles` |

### Testing

| Task | Command |
|------|---------|
| Run unit tests | `pnpm test` |
| Single portal test file | `pnpm --filter portal test -- --testPathPatterns=<file>` |
| Run E2E tests | `pnpm test:e2e` |
| Visual regression | `pnpm test:e2e:visual` |
| Update visual snapshots | `playwright test --update-snapshots` |
| Storybook a11y | `pnpm test:a11y` |
| Start Storybook UI | `pnpm ui` |

### Deployment

| Task | Command |
|------|---------|
| Deploy local | `bash ops/deploy.sh local` |
| Deploy staging/production | `bash ops/deploy.sh staging` / `bash ops/deploy.sh production` |
| Live LAN server | `bash ops/deploy-live-local.sh` |
| Graceful shutdown | `bash ops/shutdown.sh` |
| Monitor HUD | `bash ops/monitor-hud.sh` |

### Agentic harness

| Task | Command |
|------|---------|
| Classify effort tier | `python3 ops/agent-orchestrator/classify-effort.py "<task>"` |
| Verify gate | `bash ops/agent-orchestrator/verify-gate.sh` |
| Turn-close footer | `python3 ops/agent-orchestrator/turn-close-status.py` |
| List skills/tools | `python3 ops/lending-library/list-catalog.py` |
| Checkout skill | `python3 ops/lending-library/checkout-skill.py <name>` |
| Return skill | `python3 ops/lending-library/return-skill.py <name>` |

## Code Conventions & Common Patterns

### Formatting & style

- Prettier: `semi: true`, double quotes, tab width 2, trailing commas `all`, print width 100.
- Tailwind class merging: use `cn()` from `@repo/ui/lib/utils`. Never template literals.
- CSS: only OKLCH tokens from `@repo/theme`. No hardcoded hex/oklch.
- Shadows: use `shadow-card`, `shadow-window`, `shadow-diffusion-*`. Raw Tailwind shadow utilities are forbidden and asserted against in E2E.
- Icons: named imports only, e.g., `import { Drill } from "lucide-react"`. Wildcard `* as Icons` imports are banned (caused a 1.3 MB chunk).
- Theme: light-only. No dark mode toggle, no cyber/terminal aesthetic.

### Naming

- Root directories use `NN_descriptive_snake_case` ranked by usage (ADR-003). Avoid legacy names like `packages`, `scripts`, `shared`, `10-src`.
- Tests: unit tests `*.test.ts(x)`, co-located with source; E2E specs `*.spec.ts` under `e2e/`.
- Migrations: zero-padded SQL files in `pkgs/database/migrations/`, e.g., `062_add_table.sql`.

### Imports & boundaries

- `@repo/*` aliases are mapped in `tsconfig.base.json`.
- UI files must never import `server-only`, `@repo/supabase/server`, `@repo/redis`, `scripts/`, or `infra/`.
- Server Actions must use `createServerSupabaseClient()` + validate user as line one.
- Adding a new `@repo/*` import in portal tests requires an explicit `moduleNameMapper` entry in `apps/portal/jest.config.js`; wildcards are not enough.

### Error handling & async

- Prefer `async/await`. Server Actions validate and throw structured errors from `@repo/errors`.
- React component tests use `waitFor` from `@testing-library/react`.
- Shell scripts use `set -euo pipefail`.

### State management

- Server state: Supabase + Kysely. Client cache: Redis-backed helpers with `CacheCategory` + `CACHE_TTL_REGISTRY`.
- Forms: `react-hook-form` + Zod validation from `@repo/contract`.
- Global UI state: Zustand where needed; XState for complex workflows.

### Anti-patterns observed

- Some `libs/features/*/ui` components contain Server Actions / RSC data fetches that should eventually move to `data-access` libraries or API routes.
- `.cursor/rules/*.mdc` may still reference old `03_operations_automation/` paths; the canonical paths are under `ops/`.
- Several root `package.json` scripts reference removed scripts; prefer `ops/dev.sh` and `ops/deploy.sh` equivalents.

## Testing & QA

### Frameworks

- **Unit / component**: Jest 30 with `@swc/jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.
- **E2E / integration**: Playwright 1.60. Auth state is produced by `e2e/global.setup.ts` and reused from `e2e/.auth/user.json`.
- **A11y**: `@storybook/test-runner` + `axe-playwright` on every story in `pkgs/ui`. Opt out via `parameters.a11y.disable`.
- **DB compliance**: SQL scripts in `pkgs/database/tests/` for RLS privilege escalation and index coverage.

### Key test config

- `apps/portal/jest.config.js` — transform, explicit `@repo/*` `moduleNameMapper`, coverage thresholds.
- `apps/portal/setupTests.ts` — global Redis mock, `matchMedia` / `IntersectionObserver` polyfills.
- `playwright.config.ts` — E2E projects (setup, chromium, mobile, tablet), web server, snapshots.
- `pkgs/ui/.storybook/test-runner.ts` — injects axe-playwright.

### Coverage

- Reporters: `text`, `lcov`, `html`.
- Thresholds in `apps/portal/jest.config.js`: lines 40%, branches 30%, functions 35%, statements 40%.
- Coveralls badge in `README.md`.

### Quality gate order

`lint` → `type-check` → `test` → `build`. The root `pnpm quality` script chains these plus root lint, style lint, format check, dependency lint, `knip`, policy check, RLS audit, and design audit.

## Important Files

| Path | Why it matters |
|------|----------------|
| `apps/portal/app/layout.tsx` | Root layout: theme provider, global chrome, PWA manifest. |
| `apps/portal/app/page.tsx` | Landing redirect; middleware handles auth routing. |
| `apps/portal/middleware.ts` | Edge middleware wrapper. |
| `apps/portal/server/proxy.ts` | Auth/authorization proxy; role/department gating. |
| `apps/portal/next.config.mjs` | Next.js 16 config: Turbopack workspaceRoot, standalone output, CSP. |
| `apps/portal/package.json` | Portal scripts and dependencies. |
| `apps/portal/jest.config.js` | Portal test config and `moduleNameMapper`. |
| `apps/portal/.eslintrc.js` | Portal ESLint with restricted imports. |
| `playwright.config.ts` | E2E config. |
| `package.json` | Root scripts, workspace catalog, Volta pins. |
| `pnpm-workspace.yaml` | Workspace globs and catalog versions. |
| `nx.json` | Nx task graph, remote cache, default base `master`. |
| `tsconfig.base.json` | Path mappings for `@repo/*`. |
| `tools/policy-compiler.cjs` | SSoT for dependency/architecture/security rules. |
| `tools/policy/` | Generated policy outputs; must stay in sync with compiler. |
| `tools/audit-rls.cjs` | Static RLS audit. |
| `tools/enforce-security-checks.cjs` | Regex security scan. |
| `tools/design-audit.cjs` | Design-system compliance scan. |
| `pkgs/database/migrations/` | Migration source of truth. |
| `pkgs/supabase/src/database.types.ts` | Regenerated types; commit with migrations. |
| `pkgs/theme/src/css/variables.css` | OKLCH token source. |
| `assets/` | Global static assets synced to `apps/portal/public/`. |
| `ops/dev.sh` | Primary local dev bootstrap. |
| `ops/deploy.sh` | Deployment script. |
| `ops/agent-orchestrator/verify-gate.sh` | Pre-ship verification. |
| `.ai_content/.memory/.cursor-memory/active-context.md` | Continuation brief after compact. |
| `MEMORY.md` / `HOW.md` / `WHY.md` | Persistent memory, active spec, domain authority. |

## Migration Workflow

Source of truth for migrations is `pkgs/database/migrations/`. Supabase CLI reads from `pkgs/supabase/migrations/`, so the workflow is:

1. Add migration to `pkgs/database/migrations/NNN_description.sql`.
2. Run `pnpm policy:migrations:sync` to copy to `pkgs/supabase/migrations/`.
3. Run `pnpm --filter @repo/database supabase:push` to apply.
4. Run `pnpm --filter @repo/database supabase:gen` to regenerate `pkgs/supabase/src/database.types.ts`.
5. Run `pnpm audit:rls` to verify every new table has RLS enabled.
6. Commit migration + regenerated types as one atomic change.

## Agentic / Context Protocols

- Turn start: read `.ai_content/.memory/.cursor-memory/state.json`, `.compact-pending`, `.recall-brief.md`, and `active-context.md`.
- Effort triage: run `python3 ops/agent-orchestrator/classify-effort.py "<task>"` before non-trivial work.
- Capability checkout: `python3 ops/lending-library/checkout-skill.py <name>` → read → execute → `python3 ops/lending-library/return-skill.py <name>`.
- High-tier tasks follow `ops/agent-orchestrator/dynamic-workflow.md`: plan lanes, parallel `Task` subagents (depth = 1), verify, consensus review.
- Pre-ship: run `bash ops/agent-orchestrator/verify-gate.sh`.
- Turn close: run `python3 ops/agent-orchestrator/turn-close-status.py` and append its markdown output to the reply.
- `/summarize`: finish open work, run verification, commit/push/PR, then compact context.
- Auto-compact fires every ~10 user turns. After compact, rely only on `active-context.md`.

## Notable Rules / Warnings

1. **`employees` table is the source of truth for authorization.** Do not use Supabase Auth metadata for access decisions.
2. **Every new table must have RLS enabled.** `pnpm audit:rls` and `pnpm policy:check` enforce this in CI.
3. **Do not edit `pkgs/supabase/migrations/` directly.** Use `pkgs/database/migrations/` and `pnpm policy:migrations:sync`.
4. **Run `pnpm policy:gen` after any change to `tools/policy-compiler.cjs`.** Generated files must be committed in sync.
5. **Frontend UI must never import server-only or infrastructure packages.** Boundary rules will fail CI.
6. **Use design tokens only.** No hardcoded colors, no raw shadows, no dark mode, no wildcard Lucide imports.
7. **Default branch is `master`.** Target `master` for PRs and CI triggers.
8. **Production realism is mandatory.** No `foo`/`bar`, Lorem ipsum, or demo data. Halt for unknown schemas.
9. **Stale generated files break CI.** If `pnpm quality` is green locally but red in CI, run `pnpm policy:gen && pnpm format && pnpm knip:fix`.
10. **Lockfile drift:** use `--no-frozen-lockfile` locally and commit updated `pnpm-lock.yaml`; CI uses `--frozen-lockfile`.
