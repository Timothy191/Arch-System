# Repository Guidelines

Arch-Systems (Plantcor) — multi-departmental mining operations portal. **Nx 22 + pnpm** monorepo with Next.js 16 App Router, PostgreSQL/RLS, Redis caching, and Python LLM eval suite.

---

## Project Overview

Portal integrates mining analytics, equipment status, and employee operations into department-specific dashboards with strict role + department-based authorization.

**Key services**: Next.js portal (`:3000`), Payload CMS, Supabase/Postgres, Redis, Python eval suite.
**Version**: 1.5.1 | **License**: MIT | **Private**: true

---

## Architecture & Data Flow

```
Client/UI → apps/portal/proxy.ts (edge middleware) → @repo/supabase (auth + queries)
                              ↓
                     @repo/redis (cached dept slugs, auth profiles)
                              ↓
                     @repo/database (migrations) → PostgreSQL (RLS)
```

- **Auth**: Supabase Auth (JWT), HttpOnly cookies, CSRF validated on login
- **AuthZ**: `public.employees` maps `auth_id` → `role`, `department_id`, `accessible_departments[]`
- **Route gating**: `apps/portal/proxy.ts` resolves dept slugs → UUIDs via Redis cache under `arch:auth:employee:${user.id}`
- **RLS**: Every table has RLS enabled. Policies consult `employees.role` + `employees.department_id`, not just `auth.uid()`
- **Middleware flow**: Session refresh → dept slug→UUID resolution → employee profile query → route gating

---

## Key Directories

| Path                         | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `apps/portal`                | Next.js 16 App Router, React 19, port `:3000`                                         |
| `apps/cms`                   | Payload CMS headless content service                                                  |
| `apps/overview`              | React Flow architecture visualization                                                 |
| `apps/ci-observer`           | CI observation helper                                                                 |
| `packages/ui`                | shadcn/ui + Radix primitives, animated components, topology nodes                     |
| `packages/theme`             | OKLCH tokens, Style Dictionary codegen, CSS variables                                 |
| `packages/supabase`          | Supabase clients (browser/server/middleware/read-replica/service-role), Kysely, types |
| `packages/database`          | SQL migrations (`NNN_description.sql`), RLS assertions                                |
| `packages/redis`             | Cache registry, L1/L2 write-through, TTL, buildCacheKey                               |
| `packages/errors`            | AppError hierarchy (ValidationError, AuthError, ForbiddenError, etc.)                 |
| `packages/contract`          | Canonical Zod schemas + inferred types (SSoT for cross-boundary contracts)            |
| `packages/rate-limiter`      | Fixed/sliding/token-bucket strategies, memory + Redis stores                          |
| `packages/utils`             | Analytics, fetch-client, excel export, Inngest/NOVU                                   |
| `packages/logger`            | Structured logging (Pino: server, browser, Next.js)                                   |
| `packages/agents`            | Coordinator, langfuse tracing, specialists                                            |
| `packages/eval`              | Python LLM evaluation (DeepEval + pytest, uv)                                         |
| `packages/eslint-config`     | ESLint configs (`library.js`, `react-internal.js`, `next.js`)                         |
| `packages/typescript-config` | Shared TS config                                                                      |
| `libs/features/<domain>`     | Domain modules: `<domain>/ui` + `<domain>/data-access`                                |
| `libs/shared`                | Cross-cutting: `data-access`, `utils`, `hooks`                                        |
| `scripts/`                   | Dev, deploy, backup, seed scripts; `AGENT_TRACER.md` per change                       |
| `tools/`                     | Policy compiler, project tag applicator, RLS auditor                                  |
| `e2e/`                       | Playwright E2E + visual regression tests                                              |
| `infra/`                     | Docker Compose, K8s manifests, monitoring stack                                       |

---

## Development Commands

```bash
pnpm install                  # Install deps (pnpm 9.15.9, volta-pinned Node 24.15.0)
pnpm dev                      # Portal dev server on :3000 (Turbopack)
pnpm dev:minimal              # Minimal dev server
pnpm dev:up --all             # Bootstrap everything (Supabase + portal + cms)
pnpm --filter @repo/database supabase:dev  # Local Supabase Docker
pnpm build                    # Build all workspaces
pnpm nx build <name>          # Build single app/package
pnpm test                     # Run all unit tests (Jest + @swc/jest)
pnpm --filter portal test -- --testPathPatterns=<file>  # Single test file
pnpm test:e2e                 # Playwright E2E (requires :3000)
pnpm test:e2e:visual          # Visual E2E snapshots
pnpm ui                       # Storybook UI
pnpm test:a11y                # Storybook a11y checks
pnpm lint                     # Lint all workspaces
pnpm lint:root                # Lint root only
pnpm type-check               # Type-check all workspaces
pnpm quality                  # Full quality gate (lint + type-check + test + lint:tokens + lint:css + policy:check + audit)
pnpm format                   # Format code
pnpm deps:lint                # Syncpack dependency lint
pnpm knip                     # Dead-code detection
pnpm policy:gen               # Regenerate policy files from policy-compiler.cjs
pnpm policy:check             # Verify policy drift (CI)
pnpm --filter @repo/eval test # Python eval suite
```

**Pre-commit**: Husky runs lint-staged → lint + type-check on push. Never `--no-verify`.

---

## Code Conventions & Common Patterns

### Formatting & Quality

- Prettier: `semi`, `tabWidth 2`, `trailingComma all`, `printWidth 100`
- ESLint extends `@repo/eslint-config`; strict TS, **no `any`**, **no `// @ts-ignore`**
- Stylelint with `declaration-strict-value` plugin
- Conventional commits enforced by commitlint; Husky `commit-msg` rejects non-conforming

### Naming

- **Packages**: `@repo/<name>`, public API strictly from `src/index.ts`
- **Routes**: `page.tsx` for pages, `layout.tsx` for parent interfaces
- **Migrations**: `packages/database/migrations/NNN_description.sql` (zero-padded)
- **Feature modules**: `libs/features/<domain>/ui` (components), `libs/features/<domain>/data-access` (hooks/services)
- **Test files**: Co-located `*.test.ts(x)`; E2E in `e2e/`

### Error Handling

- **All errors** subclass `@repo/errors` (`AppError` base). **Never throw generic `Error`**.
- Server Actions/API Routes must catch via `isAppError(err)` and return `{ success, error, code }`
- Error codes: `MISSING_PAYLOAD`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, etc.

### Async & Server Actions

- Server Actions must declare `"use server"` and call `createServerSupabaseClient()` on line 1
- Return `{ success: boolean; data?: T; error?: string }` — never throw uncaught promises
- Mutating actions must call `revalidatePath()` or `revalidateTag()`

### Client State Management

- **Zustand 5**: UI chrome only (menus, modals, toggles). **Never server data in Zustand**
- **TanStack React Query**: All server-side data
- **XState**: Complex async workflows (e.g., `apps/portal/lib/plugins/machines/`)

### Architectural Boundaries

- `tools/policy-compiler.cjs` is the SSoT for package boundaries
- `pnpm policy:gen` regenerates `tools/policy/*.json` and `tools/policy/eslint-boundaries.generated.cjs`
- **Constraints**: `scope:package:ui` cannot import `@repo/supabase`, `@repo/redis`, `@repo/database`; `scope:app` cannot import `@repo/database-internal`; `scope:feature` cannot depend on `scope:app`
- After adding a new project: run `node tools/apply-project-tags.cjs` and update `tools/policy-compiler.cjs`

### Agent Tracing

- Every package has `AGENT_TRACER.md` — append ISO 8601 timestamped entry after changes
- Annotate non-obvious logic with `// AGENT-TRACE: <explanation>`

### Dependency Management

- Workspace catalogs in `pnpm-workspace.yaml`; use `catalog:` or `catalog:react19` prefix
- New packages must be `@repo/<name>`, have `project.json`, get tags via `node tools/apply-project-tags.cjs`, and add `DEPENDENCY_RULES` to `tools/policy-compiler.cjs`

---

## Important Files

| File                             | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `apps/portal/proxy.ts`           | Edge middleware: session refresh, dept gating, Redis cache         |
| `apps/portal/server/proxy.ts`    | Server proxy: cached auth lookups, redirect validation             |
| `apps/portal/next.config.mjs`    | Next.js config (Turbopack, standalone, Sentry, bundle analyzer)    |
| `apps/portal/jest.config.js`     | Jest config with 40+ moduleNameMapper, JSDOM, coverage thresholds  |
| `apps/portal/setupTests.ts`      | Global test setup (Redis Map mock, Supabase mocks)                 |
| `e2e/playwright.config.ts`       | Playwright config with chromium/mobile/tablet projects             |
| `e2e/global.setup.ts`            | E2E auth via cached credentials                                    |
| `tsconfig.base.json`             | Root TS config with 30+ path aliases                               |
| `nx.json`                        | Nx 22 config with targetDefaults, dependency constraints, S3 cache |
| `pnpm-workspace.yaml`            | Workspace packages + dependency catalogs                           |
| `tools/policy-compiler.cjs`      | SSoT policy compiler → generates rules + eslint boundaries         |
| `tools/apply-project-tags.cjs`   | Nx project tagging script                                          |
| `tools/audit-rls.cjs`            | Static RLS policy auditor                                          |
| `packages/database/migrations/`  | 110+ SQL migration files (001*initial.sql → 153*\*.sql)            |
| `packages/errors/src/index.ts`   | AppError base classes + type guards                                |
| `packages/contract/src/index.ts` | Canonical Zod schemas + derived types                              |
| `packages/redis/src/index.ts`    | Cache registry, buildCacheKey, Redis client                        |
| `packages/supabase/src/index.ts` | Supabase client factories + manual table types                     |
| `packages/ui/src/index.ts`       | @repo/ui public API (80+ named exports)                            |
| `packages/theme/src/index.ts`    | @repo/theme tokens, ArchThemeProvider, useArchTheme                |
| `.mcp.json`                      | MCP server configs (nx-mcp, postgres)                              |

---

## Runtime/Tooling Preferences

- **Runtime**: Node.js `>=22` (volta-pinned to `24.15.0`). Bun is **not supported** for the portal app.
- **Package manager**: pnpm `9.15.9` only
- **Build**: Turbopack (dev + production). Webpack not used (inngest/node:async_hooks incompatibility)
- **Output**: Next.js standalone for Docker
- **Shared catalogs**: Use `catalog:` prefix in `pnpm-workspace.yaml`
- **Local services**: Supabase on `54321/54322/54323/54329`; Grafana `9091`, Prometheus `9093`, cAdvisor `8082`
- **Monitoring**: Sentry, OpenTelemetry, `prom-client`, custom metrics in `apps/portal/lib/observability/`

---

## Testing & QA

### Test Frameworks

| Framework                                                   | Scope                        | Config                                             |
| ----------------------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| **Jest** (@swc/jest)                                        | Unit tests across 9 packages | `apps/portal/jest.config.js` + per-package configs |
| **Playwright**                                              | E2E + visual regression      | `e2e/playwright.config.ts`                         |
| **Storybook** (`@storybook/test-runner` + `axe-playwright`) | Component a11y               | `pnpm test:a11y`                                   |
| **pytest + DeepEval**                                       | Python LLM eval              | `packages/eval/pyproject.toml`                     |
| **SQL transaction tests**                                   | RLS validation               | `packages/database/tests/`                         |

### Coverage Thresholds (Jest enforced)

- Lines: **40%** | Branches: **30%** | Functions: **35%** | Statements: **40%**

### Mocking Strategy

- **Redis**: Global in-memory `Map` mock in `apps/portal/setupTests.ts` (`get`, `set`, `del`, `incr`, `expire`)
- **Supabase**: Per-test `jest.mock` with chainable spies (`from().select().eq()`)
- **Mock at network boundary** (Supabase, Redis), never at function call

### Test Patterns

- Unit tests: co-located `*.test.ts(x)`, no need for Supabase
- E2E tests: require portal dev server on `:3000` and Chromium
- Visual tests: `toHaveScreenshot()` with 2% pixel variance, mask dynamic elements (clocks, videos, canvas)
- **UI invariant**: Always light mode (`#f3f4f6` background, luminance > 200). No dark mode.
- DB RLS tests: transaction-wrapped SQL, verify non-admin roles cannot self-elevate
- Jest `moduleNameMapper`: Add explicit mappings for any new `@repo/*` import or subpath export in `apps/portal/jest.config.js`

### Quality Gate (`pnpm quality`)

Runs: lint → type-check → test → lint:tokens → lint:css → policy:check → deps:lint → knip → audit:rls → audit:design

---

## CI/CD

- **CI**: `.github/workflows/ci.yml` — parallel jobs for deps-lint, security-audit, knip, policy-check, nx-agents (CodeQL, Trivy, SBOM, DeepEval), e2e, lighthouse
- **Deploy**: `.github/workflows/deploy.yml` — quality-check → staging (Vercel/SSH/Docker) → production
- **Release**: Changesets-based via `.github/workflows/release.yml`
- **Canary**: `.github/workflows/deploy-canary.yml` — kubectl, 10% traffic, smoke tests
- **DAST**: `.github/workflows/dast.yml` — OWASP ZAP daily on staging
- **Reviewdog**: ESLint/Prettier/Markdown lint on PRs via `.github/workflows/reviewdog.yml`

---

## Code Generation Pipelines (never edit generated output)

| Source                          | Command                                                          | Output                                    |
| ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| `packages/theme/tokens.json`    | `pnpm --filter @repo/theme build`                                | `generated.ts`, `variables-generated.css` |
| `packages/database/migrations/` | `pnpm --filter @repo/database supabase:push && ... supabase:gen` | `packages/supabase/src/database.types.ts` |

Commit both source and generated files in the same atomic change.

---

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
