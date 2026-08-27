# Repository Guidelines

Arch-Systems (Plantcor) is a multi-departmental mining operations portal — an **Nx 22 + pnpm** workspaces monorepo serving authenticated, department-specific dashboards. Enforces strict role and department-based authorization.

---

## Project Overview

The portal integrates mining analytics, equipment status, and employee operations into department-specific dashboards. It relies on a Next.js frontend, Payload CMS headless content provider, PostgreSQL database with Row-Level Security, Redis caching, and a Python evaluation suite.

---

## Architecture & Data Flow

### Conceptual Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT / UI                               │
│  - apps/portal (Next.js)      - apps/overview (React Flow Topology)     │
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
│  - @repo/redis (L1/L2 Write-Through│  │  - apps/cms (Payload CMS v3)   │
│    Cache with Coalescing)         │   │  - @repo/supabase (SSR Wrapper)│
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

- `apps/portal` — Next.js 15+ App Router portal frontend.
- `apps/cms` — Headless Payload CMS v3.
- `apps/overview` — Architecture and DB schema visualizer (React Flow).
- `libs/features/` — Domain feature modules (e.g. `hub/ui`, `departments/ui`, `auth/ui`, `dashboard/data-access`).
- `packages/` — Shared monorepo libraries:
  - `packages/contract` — Shared Zod schemas and inferred types (Data Contract SSoT).
  - `packages/supabase` — Supabase SSR client factories, cookies config, and telemetry tracers.
  - `packages/redis` — Write-Through local + Redis cache wrapper and invalidation routines.
  - `packages/database` — Migration scripts, SQL privilege assertions, and rollback validation scripts.
  - `packages/errors` — Standardized application domain errors.
  - `packages/rate-limiter` — Sliding-window and token-bucket rate limit controls.
  - `packages/theme` & `packages/ui` — Design token CSS compilation and component primitives.
  - `packages/eval` — Python LLM metrics and code compliance evaluations (DeepEval + Pytest).
- `tools/` — Repository verification scripts, tag applicators, and policy compilers.
- `e2e/` — Playwright end-to-end and visual regression test suites.

---

## Development Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment vars
cp apps/portal/env/.env.example apps/portal/.env

# 3. Spin up local Supabase container (Postgres, Auth, Studio) in a separate terminal
pnpm --filter @repo/database supabase:dev

# 4. Launch Next.js dev server
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

---

## Code Conventions & Common Patterns

### Code Formatting & Quality

- **Enforcement**: Prettier formats code; ESLint, Stylelint, and cspell lint styles and spellings.
- **Strictness**: TypeScript strict mode is enabled. No `any` types; no `// @ts-ignore` exceptions. Cast dynamic boundaries to `unknown` and validate via Zod.

### Naming Conventions

- **Routing**: Portal pages must be named `page.tsx` and parent interfaces `layout.tsx`.
- **Packages**: Monorepo packages must be named `@repo/<name>` and export a public API strictly from `src/index.ts`.
- **Database Migrations**: SQL files under `packages/database/migrations/` must use zero-padded serial naming: `NNN_description.sql` (e.g. `001_initial_schema.sql`).

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
- **XState**: Reserved for complex async workflows requiring structured state charts (such as plugin pipelines).

### Architectural Boundary Enforcement

- `tools/policy-compiler.cjs` is the Single Source of Truth (SSoT) for package boundaries.
- Run `pnpm policy:gen` to synchronize policies. This script invokes `tools/apply-project-tags.cjs` to tag folders (e.g. `scope:app`, `scope:package:ui`, `scope:package:db`) and generates the ESLint import rules in `eslint-boundaries.generated.cjs`.
- **Constraints**:
  - UI components (`scope:package:ui`) must remain pure: they are prohibited from importing data packages (`@repo/supabase`, `@repo/redis`, `@repo/database`).
  - Theme (`scope:package:theme`) cannot depend on UI components.
  - Apps (`scope:app`) cannot import `@repo/database-internal` or other internal db utilities directly; they must query via `@repo/supabase`.

### Agent Tracing & breadcrumbs

- Every workspace package contains an `AGENT_TRACER.md` recording changes. **Assistants must append an ISO 8601 timestamped entry describing the modification and handover details.**
- Annotate complex or non-obvious logic inline using `// AGENT-TRACE: <explanation>` breadcrumbs.

---

## Important Files

- `apps/portal/proxy.ts` — Edge middleware entry point routing portal directories.
- `apps/portal/server/proxy.ts` — Proxy implementation containing cached Redis auth profile lookups.
- `tools/policy-compiler.cjs` — Architecture rules compiler and SSoT.
- `tools/apply-project-tags.cjs` — Nx project tagging script mapping folders to scope tags.
- `tools/enforce-security-checks.cjs` — Pre-commit script auditing codebase for eval, SQL concatenation, or disabled RLS.
- `packages/database/tests/migration-rollback-safety.mjs` — Validates migration SQL naming and checks rollback (`DROP TABLE IF EXISTS`) requirements.
- `packages/errors/src/index.ts` — AppError base classes and type guards.

---

## Runtime/Tooling Preferences

- **Runtime Engine**: Node.js `>=22` (pinned via Volta to Node `24.15.0`). Bun is **not** supported for running the portal application.
- **Package Manager**: pnpm `9.15.9`.
- **Shared Catalogs**: Workspace dependencies are consolidated in `pnpm-workspace.yaml`. Shared libraries must declare imports using the `catalog:` prefix (or `catalog:react19` for React-related dependencies).
- **Local Services (Docker)**:
  - **Supabase CLI Container**: API gateway on `54321`, Postgres DB on `54322`, Studio UI on `54323`, Pooler on `54329`.
  - **Metrics Stack**: Grafana dashboard on `9091`, Prometheus on `9093`, cAdvisor on `8082`.
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

### Coverage Thresholds

Enforced via Jest in `apps/portal/jest.config.js`:

- **Lines**: 35%
- **Branches**: 24%
- **Functions**: 24%
- **Statements**: 34%
  _(Note: These are set to represent a sustainable baseline accounting for extensive presentational page components; do not artificially depress these rates)._
