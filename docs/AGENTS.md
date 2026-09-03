# Repository Guidelines

Arch-Systems (Plantcor) is a multi-departmental mining operations portal — an **Nx 22 + pnpm** workspaces monorepo serving authenticated, department-specific dashboards. Enforces strict role and department-based authorization.

---

## Project Overview

The portal integrates mining analytics, equipment status, and employee operations into department-specific dashboards. It relies on a Next.js frontend, Payload CMS headless content provider, PostgreSQL database with Row-Level Security, Redis caching, and a Python LLM evaluation suite.

**Version**: 1.5.1 | **License**: MIT | **Private**: true

---

## Architecture & Data Flow

### Conceptual Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT / UI                               │
│  - apps/portal (Next.js 16)   - apps/overview (React Flow Topology)     │
│  - @repo/ui (shadcn/ui)       - libs/features/* (Domain Feature Modules)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Http/WS Requests
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        EDGE / MIDDLEWARE GATEWAY                       │
│  - apps/portal/proxy.ts (Next.js edge middleware router)              │
│  - apps/portal/server/proxy.ts (Auth verification & Redis gating)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐   ┌────────────────────────────────┐
│            CACHING                │   │        EXTERNAL SERVICES       │
│  - @repo/redis (L1/L2 Write-Through│  │  - @repo/supabase (SSR Wrapper)│
│    Cache with Coalescing)         │   │  - Supabase Auth & Realtime    │
└─────────────────┬─────────────────┘   └────────────────┬───────────────┘
                  │ Cached Auth Profiles                 │ Queries & Auth
                  ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             DATABASE LAYER                             │
│  - PostgreSQL (local Supabase CLI container)                           │
│  - Row-Level Security (RLS) policies enforcing auth.uid() isolation     │
│  - Sequential Zero-Padded SQL migrations (@repo/database/migrations/)  │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Data & Auth Flows

1. **Authentication**: Managed via Supabase Auth (JWT). Session tokens are stored in HttpOnly Secure cookies. CSRF and Origin headers are validated on login.
2. **Authorization Mapping**: The `public.employees` table maps user `auth_id` to an operational `role` (e.g. operator, manager, admin), a `department_id`, and `accessible_departments` (an array of UUIDs).
3. **Route Gating**: Next.js Edge middleware (`apps/portal/proxy.ts`) gates department directories (`/drilling`, `/production`, `/access-control`, `/engineering`, `/control-room`, `/safety`, `/training`, `/satellite-monitoring`, `/access-card-actions`). It extracts the user session, resolves department UUIDs, and queries the employee profile. Access profiles are cached in Redis under `arch:auth:employee:${user.id}` to eliminate DB overhead.
4. **Database RLS Isolation**: Every PostgreSQL table has RLS enabled. Policies consult `auth.uid()` and cross-reference roles or departments against `public.employees` to restrict rows on select, insert, update, and delete. Transaction-wrapped SQL unit tests verify that non-admin roles cannot self-elevate permissions or access unauthorized departments.

---

## Key Directories

- `apps/portal` — Next.js 16 App Router portal frontend (Turbopack dev, standalone output) containing all department dashboards and the integrated React Flow system architecture visualizer (`/overview`).
- `libs/features/` — Domain feature modules organized as `<domain>/ui` (components) and `<domain>/data-access` (hooks/services):
  - `auth/ui`, `auth/data-access`, `auth/utils`
  - `departments/ui`, `departments/data-access`
  - `dashboard/data-access`
  - `analytics/data-access`
  - `hub/ui`
  - `access-control/ui`
- `libs/shared/` — Cross-cutting shared modules:
  - `libs/shared/data-access`
  - `libs/shared/utils`
  - `libs/shared/hooks`
- `packages/` — Shared monorepo libraries (all named `@repo/<name>`):
  - `packages/contract` — Canonical Zod schemas and inferred types (Data Contract SSoT).
  - `packages/supabase` — Supabase SSR client factories (browser, server, middleware, read-replica, service-role), Kysely query builder, cookies config, and telemetry tracers.
  - `packages/redis` — Redis client, L1/L2 write-through cache wrapper, TTL registry, and invalidation routines.
  - `packages/database` — Sequential zero-padded SQL migrations, SQL privilege assertions, and rollback validation scripts.
  - `packages/errors` — Standardized application domain errors (`AppError` base class with `ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `DatabaseError`, `RateLimitError`, `APIError`, `FetchTimeoutError`, `NetworkError`).
  - `packages/rate-limiter` — Sliding-window, fixed-window, and token-bucket rate limit controls with memory/Redis stores.
  - `packages/theme` — OKLCH design tokens, Style Dictionary code generation, Tailwind preset, and CSS variables.
  - `packages/ui` — shadcn/ui + Radix component primitives, animated components, data grids, workflow builders, and Storybook stories.
  - `packages/logger` — Structured logging with Pino (server, browser, Next.js helpers).
  - `packages/utils` — Third-party integrations: Novu notifications, Inngest workflows, ExcelJS exports.
  - `packages/agents` — Agent Coordination engine using MCP and OpenAI/Together APIs with Langfuse tracing.
  - `packages/eval` — Python LLM metrics and code compliance evaluations (DeepEval + Pytest via Poetry).
  - `packages/eslint-config` — Shared ESLint configurations (`library.js`, `react-internal.js`, `next.js`).
  - `packages/typescript-config` — Shared TypeScript configuration.
- `scripts/seeds` — Database seeding scripts (workspace package).
- `tools/` — Repository verification scripts, tag applicators, policy compilers, and audit tools.
- `e2e/` — Playwright end-to-end and visual regression test suites.
- `infra/` — Docker Compose files, Kubernetes manifests, monitoring stack (Prometheus, Grafana, cAdvisor), Redis config, and Cloudflared tunnels.
- `scripts/` — Shell scripts for deployment, development, monitoring, backups, and database operations.

---

## Development Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment vars
cp apps/portal/env/.env.example apps/portal/.env

# 3. Spin up local Supabase container (Postgres, Auth, Studio) in a separate terminal
pnpm --filter @repo/database supabase:dev

# 4. Launch Next.js dev server (Turbopack)
pnpm dev

# 5. Execute full quality validation gate (run prior to merging or pushing code)
pnpm quality
```

### Build, Test, and Lint Tasks

Nx handles target execution and caching. Prefer `pnpm nx run` over underlying tools:

| Task Goal                        | Command                                                        |
| :------------------------------- | :------------------------------------------------------------- |
| Build all workspaces             | `pnpm build`                                                   |
| Build single app/package         | `pnpm nx build <name>` (e.g. `pnpm nx build portal`)           |
| Run all unit tests               | `pnpm test`                                                    |
| Run single Jest spec file        | `pnpm --filter portal test -- --testPathPatterns=<file_path>`  |
| Run all Playwright E2E           | `pnpm test:e2e` (requires portal dev server active on `:3000`) |
| Run visual spec tests            | `pnpm test:e2e:visual`                                         |
| Spin up Storybook UI             | `pnpm ui`                                                      |
| Execute accessibility checks     | `pnpm test:a11y`                                               |
| Regenerate architecture policies | `pnpm policy:gen`                                              |
| Run Python eval suite            | `pnpm --filter @repo/eval test`                                |
| Type-check all workspaces        | `pnpm type-check`                                              |
| Lint all workspaces              | `pnpm lint`                                                    |
| Check dependency mismatches      | `pnpm deps:check`                                              |
| Find unused exports/deps         | `pnpm knip`                                                    |

### Deployment Commands

| Task Goal                        | Command                                                        |
| :------------------------------- | :------------------------------------------------------------- |
| Deploy local stack               | `pnpm deploy:local`                                            |
| Deploy to staging                | `pnpm deploy:staging`                                          |
| Deploy to production             | `pnpm deploy:production`                                       |
| Rollback production              | `pnpm deploy:rollback`                                         |
| Fresh start (clean local)        | `pnpm fresh-start`                                             |

---

## Code Conventions & Common Patterns

### Code Formatting & Quality

- **Enforcement**: Prettier formats code; ESLint, Stylelint, and cspell lint styles and spellings.
- **Strictness**: TypeScript strict mode is enabled. No `any` types; no `// @ts-ignore` exceptions. Cast dynamic boundaries to `unknown` and validate via Zod.
- **Commit Messages**: Enforced via commitlint with conventional commits (`@commitlint/config-conventional`).
- **Pre-commit Hooks**: Husky runs lint-staged on commit.

### Naming Conventions

- **Routing**: Portal pages must be named `page.tsx` and parent interfaces `layout.tsx`.
- **Packages**: Monorepo packages must be named `@repo/<name>` and export a public API strictly from `src/index.ts`.
- **Database Migrations**: SQL files under `packages/database/migrations/` must use zero-padded serial naming: `NNN_description.sql` (e.g. `001_initial.sql`). Verified by `migration-rollback-safety.mjs`.
- **Feature Modules**: Follow the pattern `libs/features/<domain>/ui` for components and `libs/features/<domain>/data-access` for hooks/services.

### Error Handling Pattern

- All modules must throw subclassed exceptions from `@repo/errors` (e.g., `ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`).
- **Prohibited**: Throwing generic `Error` instances is forbidden.
- **Catching**: Server Actions and API Routes must catch exceptions and check type safety using `isAppError(error)` before returning error structures to the UI.
- **Example**:

  ```typescript
  import { ValidationError, isAppError } from "@repo/errors";

  try {
    if (!data) throw new ValidationError("Data payload is missing", { code: "MISSING_PAYLOAD" });
  } catch (err) {
    if (isAppError(err)) {
      return { success: false, error: err.message, code: err.params?.code };
    }
    return { success: false, error: "Internal system failure" };
  }
  ```

### Async & Mutating Patterns

- **Server Actions**: Must declare `"use server"` and call `createServerSupabaseClient()` to authenticate and validate session claims on line one.
- **Returns**: Server Actions must return a safe object `{ success: boolean; data?: T; error?: string }` instead of throwing uncaught promises that crash the client-side UI.
- **Invalidation**: Actions mutating state must run `revalidatePath()` or `revalidateTag()` to purge portal router caches.

### Client-Side State Management

- **Zustand 5**: Strictly limited to UI chrome state (e.g., active menu indices, modal open states, sidebar toggles). **Do not store server-sourced data caches in Zustand.**
- **TanStack React Query**: Manages and caches all server-side data retrieved by client components.
- **XState**: Reserved for complex async workflows requiring structured state charts (such as plugin pipelines in `apps/portal/lib/plugins/machines/`).

### Architectural Boundary Enforcement

- `tools/policy-compiler.cjs` is the Single Source of Truth (SSoT) for package boundaries.
- Run `pnpm policy:gen` to synchronize policies. This script invokes `tools/apply-project-tags.cjs` to tag folders (e.g. `scope:app`, `scope:package:ui`, `scope:package:db`) and generates the ESLint import rules in `tools/policy/eslint-boundaries.generated.cjs`.
- **Constraints**:
  - UI components (`scope:package:ui`) must remain pure: they are prohibited from importing data packages (`@repo/supabase`, `@repo/redis`, `@repo/database`).
  - Theme (`scope:package:theme`) cannot depend on UI components.
  - Apps (`scope:app`) cannot import `@repo/database-internal` or other internal db utilities directly; they must query via `@repo/supabase`.
  - Feature modules (`scope:feature`) cannot depend on apps (`scope:app`).

### Architectural Pre-Flight Research Gate

- All upcoming architectural changes, major boundary shifts, data contract alterations, or non-trivial structural refactors must leverage the `researchSpecialist` (`SubagentCoordinator.evaluateArchitecturalPreFlight()`) to evaluate frontier industry benchmarks (Netflix Chaos, Uber AST graphs, Shopify Packwerk, Airbnb Data Contracts, Meta perceptual diffing) before committing to structural code edits.

### Agent Tracing & Breadcrumbs

- Every workspace package contains an `AGENT_TRACER.md` recording changes. **Assistants must append an ISO 8601 timestamped entry describing the modification and handover details.**
- Annotate complex or non-obvious logic inline using `// AGENT-TRACE: <explanation>` breadcrumbs.

### Task Reporting

- **Full Report Required**: Upon completion of any task, the assistant must provide a comprehensive report summarizing:
  - What was done (summary of changes/actions performed)
  - Files modified, created, or deleted (with paths)
  - Commands executed and their outcomes
  - Any tests run and their results (pass/fail)
  - Outstanding issues, blockers, or follow-up actions required
  - Verification steps taken to confirm correctness
- The report should be structured, concise, and actionable — enabling the user to quickly understand the full scope of work performed without re-examining the conversation.

---

## Important Files

- `apps/portal/proxy.ts` — Edge middleware entry point routing portal directories.
- `apps/portal/server/proxy.ts` — Proxy implementation containing cached Redis auth profile lookups, redirect validation, and department route gating.
- `apps/portal/next.config.mjs` — Next.js configuration (Turbopack, standalone output, transpile packages, Sentry, bundle analyzer).
- `apps/portal/docker/Dockerfile` — Multi-stage Docker build (pruner → deps → builder → distroless production).
- `tools/policy-compiler.cjs` — Architecture rules compiler and SSoT.
- `tools/apply-project-tags.cjs` — Nx project tagging script mapping folders to scope tags.
- `tools/enforce-security-checks.cjs` — Pre-commit script auditing codebase for eval, SQL concatenation, or disabled RLS.
- `packages/database/tests/migration-rollback-safety.mjs` — Validates migration SQL naming and checks rollback (`DROP TABLE IF EXISTS`) requirements.
- `packages/errors/src/index.ts` — AppError base classes and type guards.
- `packages/contract/src/index.ts` — Canonical Zod schemas re-exports and derived types.
- `packages/redis/src/index.ts` — Redis client and caching helpers.
- `packages/supabase/src/index.ts` — Supabase client factories and database types.
- `packages/eval/pyproject.toml` — Python eval suite dependencies (DeepEval, pytest, httpx).
- `packages/ui/.stylelintrc.mjs` — Stylelint config with Tailwind at-rule allowances.
- `packages/eslint-config/library.js` — Base ESLint config (restricts direct Zod imports; use `@repo/contract`).
- `tsconfig.base.json` — Root TypeScript config with path aliases for all packages and feature modules.
- `nx.json` — Nx workspace configuration (target defaults, dependency constraints, plugins).
- `pnpm-workspace.yaml` — Workspace packages and shared dependency catalogs.
- `infra/docker/compose.portal.yml` — Portal Docker Compose (portal + nginx with healthchecks).
- `infra/docker/compose.production.yml` — Production overrides (resource limits, restart policies).
- `scripts/deploy.sh` — Sequential stable deployment script (local/staging/production modes).

---

## Runtime/Tooling Preferences

- **Runtime Engine**: Node.js `>=22` (pinned via Volta to Node `24.15.0`). Bun is **not** supported for running the portal application.
- **Package Manager**: pnpm `9.15.9`.
- **Build Tool**: Turbopack for both dev (`next dev --turbopack`) and production builds (`next build`). Webpack is not used due to `inngest`/`node:async_hooks` incompatibility.
- **Output**: Next.js standalone output for Docker deployment.
- **Shared Catalogs**: Workspace dependencies are consolidated in `pnpm-workspace.yaml`. Shared libraries must declare imports using the `catalog:` prefix (or `catalog:react19` for React-related dependencies).
- **Local Services (Docker)**:
  - **Supabase CLI Container**: API gateway on `54321`, Postgres DB on `54322`, Studio UI on `54323`, Pooler on `54329`.
  - **Metrics Stack**: Grafana dashboard on `9091`, Prometheus on `9093`, cAdvisor on `8082`.
- **Monitoring**: Sentry (`@sentry/nextjs`), OpenTelemetry (`@opentelemetry/*`), Prom Client (`prom-client`), and custom metrics in `apps/portal/lib/observability/`.
- **Agent Skills & Spec Tooling**:
  - Always use `npx skills add <owner/repo>` when adding or installing new skills into `.agents/skills/`.
  - Always use `npm install -g mmx-cli` (or run via `mmx-cli`) for all specification, architecture blueprint, schema, and API contract spec work. When creating or refining specifications, use `mmx-cli` to produce standardized contract blueprints before running `pnpm audit:drift`.
  - Always trigger both `pnpm audit:drift` and `pnpm audit:compliance` before committing new features to guarantee complete compliance across all monorepo boundaries.

---

## Testing & QA

### Test Environments

- **Node**: For data adapters, schemas, and API contracts (`@repo/contract`, `libs/shared/data-access`).
- **JSDOM**: For layouts, hooks, and React page elements (`apps/portal`, `libs/features/*`). Jest uses `@swc/jest` for compilation.

### Mocking Boundaries in Unit Tests

- **Redis**: Mocked globally using an in-memory `Map` database implemented in `apps/portal/setupTests.ts` and `libs/features/jest.setup.ts`. Mocks standard operations (`get`, `set`, `del`, `incr`, `expire`).
- **Supabase**: Mocked on a per-test basis using `jest.mock`. Mock clients return chainable spies simulating query structures: `from().select().eq()`.

### Playwright E2E & Visual Testing

- **E2E tests** run against the local Docker database. Authentication is handled globally in `playwright.config.ts` via `e2e/global.setup.ts` using cached credentials (`admin@plantcor.os` / `Yugioh@123#`) saved to `e2e/.auth/user.json`.
- **Visual specs** (`e2e/visual/`) use `toHaveScreenshot()` with a 2% pixel variance tolerance (`0.02`). They mask dynamic UI elements (clocks, videos, canvas, pulsed animations) to ensure determinism.
- **UI theme invariant**: Visual tests check that the interface stays in light-mode (macOS-style gray background `#f3f4f6`, luminance > 200). Dark mode is not supported.

### Storybook Accessibility Testing

- Runs on the component library (`packages/ui`) via `@storybook/test-runner` using `axe-playwright`.
- **Hooks**: The `preVisit` hook injects the Axe auditor; the `postVisit` hook runs validation against the `#storybook-root` component context on every story (unless disabled via the `storyContext.parameters?.a11y?.disable` flag).

### Database Row-Level Security Validation

- Sequential SQL transaction-wrapped unit tests in `packages/database/tests/` verify RLS permissions (e.g. checking that role modifications fail for non-admins) and auto-rollback to verify DB invariants safely.
- Key test files: `p0_signup_role_self_elevation.sql`, `accessible_departments_priv_esc.sql`, `rls_extension_safety.sql`, `index_coverage.sql`.

### Python Eval Suite

- Located in `packages/eval/` with its own `pyproject.toml` (Poetry-based).
- Uses DeepEval for LLM evaluation and Pytest for test execution.
- Test categories: `ai_service/` (translation, shift handoff, safety compliance, predictive maintenance, equipment manual) and `code_generation/` (shift closeout compliance, conventions).
- Metrics: `supabase_import_compliance.py`, `rls_completeness.py`, `design_system_compliance.py`, `department_pattern_compliance.py`.
- Requires `OPENAI_API_KEY` for LLM-judge tests (skipped if not set).

### Coverage Thresholds

Enforced via Jest in `apps/portal/jest.config.js`:

- **Lines**: 35%
- **Branches**: 24%
- **Functions**: 24%
- **Statements**: 34%
  _(Note: These are set to represent a sustainable baseline accounting for extensive presentational page components; do not artificially depress these rates)._

---

## Security Considerations

- **Row-Level Security (RLS)**: Every PostgreSQL table has RLS enabled. Policies consult `auth.uid()` and cross-reference roles/departments against `public.employees`.
- **Middleware Validation**: `apps/portal/server/proxy.ts` validates redirect targets against an allowlist to prevent open redirect vulnerabilities.
- **Pre-commit Security Audit**: `tools/enforce-security-checks.cjs` audits codebase for `eval`, SQL concatenation, or disabled RLS.
- **Dependency Security**: `pnpm-workspace.yaml` includes `overrides` to pin vulnerable transitive dependencies (handlebars, brace-expansion, minimatch, braces, glob, serialize-javascript, kysely, tmp, uuid, smol-toml, esbuild, @babel/runtime, js-yaml).
- **Secrets**: Never commit `.env` files. Use `.env.example` as a template. The `.env.bak` and `.env.local` files are gitignored.
- **Rate Limiting**: `@repo/rate-limiter` provides sliding-window, fixed-window, and token-bucket strategies enforced via `apps/portal/lib/api/rate-limit-middleware.ts`.

---

## Technology Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend Framework | Next.js 16 (App Router, Turbopack) |
| UI Library | React 19, shadcn/ui, Radix UI |
| State Management | Zustand 5 (UI), TanStack Query (server), XState (workflows) |
| Styling | Tailwind CSS 3.4, OKLCH design tokens, CSS variables |
| Backend/API | Supabase (Auth, DB, Realtime), Payload CMS v3 |
| Database | PostgreSQL with Row-Level Security |
| Caching | Redis (L1/L2 write-through with coalescing) |
| Testing | Jest, Playwright, Storybook test-runner, axe-playwright |
| Logging | Pino (structured logging) |
| Monitoring | Sentry, OpenTelemetry, Prometheus, Grafana |
| AI/ML | OpenAI/Together APIs, MCP, Langfuse tracing |
| Python | DeepEval, Pytest (Poetry) |
| Deployment | Docker, Docker Compose, Nginx, systemd |
| Package Management | pnpm 9.15.9 with catalogs |
| Build System | Nx 22 with caching and remote cache (S3) |
| Node.js | >=22 (Volta-pinned to 24.15.0) |
