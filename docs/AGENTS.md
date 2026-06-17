# AGENTS.md

> **AI Agent Onboarding & Operational Guide** — Read first before making any changes.  
> This document outlines the rules, workflows, and context every agent must follow.  
> **Non-compliance is a contract violation.**

---

## 📋 Table of Contents

1. [Mandatory Agent Tracing Rule](#mandatory-agent-tracing-rule)
2. [Project Overview](#project-overview)
3. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
4. [Quick Start](#quick-start)
5. [Monorepo Structure](#monorepo-structure)
6. [Code Generation Pipelines](#code-generation-pipelines)
7. [Essential Commands](#essential-commands)
8. [Database & Migrations (Supabase)](#database--migrations-supabase)
9. [Authentication & Middleware](#authentication--middleware)
10. [Front‑end Architecture (Portal)](#front-end-architecture-portal)
11. [Design System & UI Rules](#design-system--ui-rules)
12. [Testing](#testing)
13. [Linting, Formatting & Quality Gates](#linting-formatting--quality-gates)
14. [CI/CD & Deployment](#cicd--deployment)
15. [Key Configuration Files](#key-configuration-files)
16. [Real‑World Development Workflows](#real-world-development-workflows)
17. [Common Pitfalls & Troubleshooting](#common-pitfalls--troubleshooting)
18. [Security & Compliance](#security--compliance)
19. [Checklist for Adding a Feature](#checklist-for-adding-a-feature)
20. [Final Notes](#final-notes)

---

## ⚠️ MANDATORY AGENT TRACING RULE

**ALL AGENTS MUST FOLLOW THIS RULE ON EVERY CODE CHANGE:**

1. **Update AGENT_TRACER.md** in the root of the package/app you’re modifying.
   - Log timestamp (ISO 8601), purpose, changes made, and what the next agent should know.
   - Location: `packages/<package>/AGENT_TRACER.md` or `apps/<app>/AGENT_TRACER.md`.

2. **Leave inline breadcrumbs** for complex architectural logic.
   - Use `// AGENT-TRACE: <explanation>` or `/* AGENT-TRACE: ... */` comments.
   - Explain implicit business rules, domain context, and non‑obvious design decisions.

3. **Add runtime telemetry** where applicable.
   - Instrument functions with `prom-client` counters/histograms or OpenTelemetry spans.
   - Ensure any new service interaction (DB, Redis, API) is measurable.

**FAILURE TO FOLLOW THIS RULE IS A VIOLATION OF AGENT CONTRACTS.**

- Before starting a task, **read the AGENT_TRACER.md** of the affected packages to understand recent activity.
- Tracing files are part of the repository and must be committed—they are the handover protocol between agents.
- If a package doesn’t have an AGENT_TRACER.md yet, create one with the first entry.

---

## Project Overview

This is a **mining operations portal** built as a monorepo with **Nx + pnpm workspaces**. The main application is a Next.js 15 dashboard (`apps/portal`) backed by Supabase, Redis caching, and a shared design system. Additional apps and packages support content management, architectural visualization, AI evaluation, and more.

All technical details, commands, and architecture decisions are documented in the files referenced below—this AGENTS.md focuses on **agent obligations and working procedures**.

---

## Related Documentation

| File                         | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `DOCUMENTATION_INDEX.md`     | Complete index of all documentation and quick‑nav           |
| `CLAUDE.md`                  | Full technical reference (commands, architecture, patterns) |
| `DEPLOYMENT.md`              | Deployment guides for all environments                      |
| `DESIGN.md`                  | Design system tokens, components, and rules                 |
| `PRODUCT.md`                 | Product strategy, user personas, and feature rationale      |
| `packages/*/AGENT_TRACER.md` | Per‑package agent handoff logs                              |

**Agents must consult the relevant doc before implementing any major change.**

---

## Prerequisites & Environment Setup

- **Node.js**: `>=22` (managed via Volta, see `package.json` `volta` field)
- **pnpm**: `9.15.9` (enforced by `packageManager` field)
- **Docker**: required for local Supabase & Redis (use `docker compose` if available)
- **Python 3.11+**: only for the AI evaluation suite (`packages/eval`)

### Environment Variables

1. Copy the example files and fill in secrets:

   ```bash
   cp apps/portal/.env.example apps/portal/.env
   cp .env.example .env            # root‑level vars (sometimes needed)
   ```

2. For local Supabase, get credentials from `pnpm --filter @repo/database supabase:dev` output.
3. **Never commit real secrets.** Use CI‑synthetic values in test/CI environments.
4. All Supabase variables use the `SUPABASE_` prefix (no `NEXT_PUBLIC_` on the server).  
   The portal’s Next.js config exposes `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the browser.

---

## Quick Start

```bash
pnpm install                                  # install all dependencies
cp apps/portal/.env.example apps/portal/.env  # then edit the .env files
pnpm --filter @repo/database supabase:dev     # start local Supabase (separate terminal)
pnpm dev                                      # start Next.js on http://localhost:3000
```

To verify everything works:

```bash
pnpm quality                                  # run full quality gate
```

---

## Monorepo Structure

```
apps/
  portal/          Next.js 15 mining operations portal (main app)
  cms/             Payload CMS v3 (headless content)
  overview/        Standalone architectural visualisation (excalidraw-like)
packages/
  ui/              Shared Radix/shadcn UI components, cn() utility, glass primitives
  theme/           Design tokens (OKLCH) + Tailwind preset (single source of truth)
  supabase/        Browser, server, and middleware Supabase clients
  database/        SQL migrations (source of truth for DB schema)
  redis/           Redis helpers (department‑slug → UUID resolution)
  eval/            Python/DeepEval AI code‑generation compliance suite
```

**Dependency versions** are defined via pnpm catalogs (`pnpm-workspace.yaml`).  
Example: `"react": "catalog:react19"`. Before changing a shared dependency, locate its catalog block and update it there.

---

## Code Generation Pipelines

Two automated pipelines produce derived artifacts. **Never edit generated files manually.**

### 1. Design Tokens (`@repo/theme`)

- **Source of truth**: `packages/theme/tokens.json`
- **Command**: `pnpm --filter @repo/theme build` (or `codegen`)
- **Output**: `packages/theme/src/tokens/generated.ts`
- **Validation**: `pnpm --filter @repo/theme lint:tokens` checks consistency between tokens and CSS/Tailwind.

**Workflow**: edit `tokens.json` → run build → commit both `tokens.json` and `generated.ts`.

### 2. Database Types (`@repo/database` → `@repo/supabase`)

- **Source of truth**: `packages/database/migrations/*.sql`
- **Command**: `pnpm --filter @repo/database supabase:gen`
- **Output**: `packages/supabase/src/database.types.ts`

**Workflow**: create migration → push to local DB → run `supabase:gen` → commit migration + updated types.

If generation fails, check that the local Supabase instance is running and the latest migrations have been applied.

---

## Essential Commands

| Command                                       | What it does                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm dev`                                    | Starts portal dev server (:3000)                                                               |
| `pnpm --filter <name> dev`                    | Starts a specific app/package                                                                  |
| `pnpm quality`                                | Full gate: lint → type‑check → test → tokens‑lint → css‑lint → format‑check → deps‑lint → knip |
| `pnpm test`                                   | Run all unit tests (Jest)                                                                      |
| `pnpm test:e2e`                               | Run Playwright E2E tests (requires :3000 running)                                              |
| `pnpm --filter @repo/database supabase:push`  | Push local migrations to the database                                                          |
| `pnpm --filter @repo/database supabase:reset` | **Destructive**: wipes local DB and re‑applies migrations                                      |
| `pnpm --filter @repo/database supabase:gen`   | Regenerate TypeScript types from the DB                                                        |
| `pnpm knip:fix`                               | Auto‑remove unused exports/dependencies (knip)                                                 |
| `pnpm md:fix`                                 | Auto‑fix Markdown lint issues                                                                  |
| `pnpm monitor:grafana-stop`                   | Stop the local Grafana monitoring stack                                                        |

**Running a single test file:**

```bash
pnpm --filter portal test -- --testPathPatterns=<file>
```

---

## Database & Migrations (Supabase)

- **Migrations live in**: `packages/database/migrations/` (zero‑padded sequential numbers, e.g. `001_initial.sql`).
- **Deploy‑time copy**: `packages/supabase/supabase/migrations/` is generated; **never edit it directly**.
- After any migration, you **must** run `supabase:gen` to update `database.types.ts`.
- All tables **must have Row Level Security (RLS) enabled**. Write appropriate policies.
- The `employees` table is the authorization source of truth—not Supabase Auth metadata.
- Service‑role keys are used only on the server; never expose them to the client.
- For local development, connection details are printed when running `supabase:dev`.  
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` (with `SUPABASE_` equivalents for server).

---

## Authentication & Middleware

- The Next.js middleware (currently `apps/portal/server/proxy.ts`) handles:
  - Session refresh
  - Department‑slug → UUID resolution (Redis‑cached, see `packages/redis`)
  - Role‑based route gating (`employees.role` and `employees.department_id`)
- **Important**: The route `/api/c66` is **exempt from authentication**; never remove that exemption.
- Server Actions must use `createServerSupabaseClient()` from `@repo/supabase/server` and **always validate the authenticated user at the top** of the action.
- When adding new Supabase tables, ensure the appropriate RLS policies are in place (test them with the `supabase` local studio).

---

## Front‑end Architecture (Portal)

### Path Aliases

- `~/*` and `@/*` both map to `apps/portal/*`
- Sub‑imports: `@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*`

### Route Groups

| Group                         | Purpose & Rules                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `(auth)/`                     | Login, password reset/update. Uses auth layout + `AnimatedWavesBackground`.                                                     |
| `(departments)/[department]/` | Dynamic dashboard per department. Each static sub‑page **must** export its own `layout.tsx` that re‑exports `DepartmentLayout`. |
| `(hub)/`                      | Landing / executive overview.                                                                                                   |
| `api/`                        | API routes (ai, c66, export, health, plugins, sync, tools, webhooks). Keep Server Actions co‑located with their features.       |
| `admin/`                      | Administration panel.                                                                                                           |

### Layout Conventions

- Root layout (`apps/portal/app/layout.tsx`) mounts `ArchThemeProvider`, `OfflineBanner`, `AnimatedWavesBackground`, and `AIAssistantSidebarWrapper`.
- Never bypass these providers without architectural approval.

---

## Design System & UI Rules

**Read `DESIGN.md` for the full token palette and reasoning.**  
Key constraints for agents:

1. **Theme**: Light‑only, forced via `<script>` in `<head>` with `data-theme="light"`. Dark mode does not exist.
2. **Shadows**: Raw `box-shadow` and Tailwind `shadow-*` utilities are **forbidden**. Use `shadow-card`, `shadow-window`, `shadow-diffusion-*` tokens exclusively.
3. **Glass pattern**: `bg-white/70 backdrop-blur-xl border border-black/[0.08]`
4. **Class merging**: Always use `cn()` from `@repo/ui/lib/utils`; never concatenate class strings manually.
5. **Icons**: Named imports only (`import { Drill } from "lucide-react"`). Wildcard imports cause massive chunks (~1.3 MB). The `knip` config may flag unused icon imports—address them.
6. **Animation**: Only animate `opacity`, `transform`, `background-color`, `border-color`, `color`. Never animate layout‑inducing properties (width, height, top, left, etc.). Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
7. **Liquid Glass Motion**: CSS transitions handle hover shape/scale; Framer Motion only handles active press (`whileTap`). Set `hoverScale={1}` on Framer Motion components to avoid conflicts.
8. **New UI components**: Place in `packages/ui/src/components/` and re‑export via `packages/ui/src/index.ts`. Update `jest.config.js` of the portal if a new `@repo/ui` path alias is required.

---

## Testing

### Unit Tests (Jest, jsdom, ts‑jest)

- Command: `pnpm test`
- Does **not** require Supabase running.
- Coverage targets (defined in `jest.config.js`): lines 40%, branches 30%, functions 35%, statements 40%.  
  New code should at least maintain these thresholds.

### E2E Tests (Playwright)

- Command: `pnpm test:e2e`
- Requires dev server on `:3000`.
- Visual snapshots stored in `e2e/visual/__snapshots__/`; use Chromium binary at `/usr/bin/google-chrome`.
- Always add Playwright tests for new critical user flows.

### AI Compliance Tests

- `packages/eval/` contains a Python/DeepEval suite.  
  Run it when making changes to AI‑generated code or pipelines.

### Writing Tests

- Use `jest.config.js` aliases; add entries for new `@repo/*` packages when needed.
- Mock external services (Supabase, Redis) using `jest.mock()` or a dedicated test helper.

---

## Linting, Formatting & Quality Gates

Run `pnpm quality` before pushing. It executes in this order:

```
deps:lint → lint → type-check → test → lint:tokens → lint:css → format-check → lint-root → deps:lint → knip
```

- **Lint‑staged** (via `lint-staged.config.js`) also runs secret scanning (`.secretlintrc.json`) on staged files.
- Markdown linting is separate: `pnpm md:lint` (or `md:fix` to auto‑correct).
- Dependency linting (`syncpack`, `knip`) ensures version consistency and no dead code.

**Never bypass these gates**—CI enforces them.

---

## CI/CD & Deployment

- CI verification order: `deps:lint → lint → type-check → test → build → bundlesize`
- The `quality` command includes everything CI does; run it locally.
- Deployment is detailed in `DEPLOYMENT.md`.  
  Key points: environment variables are injected via the platform (Vercel, etc.), build happens with `pnpm build`, and Sentry is integrated via `next.config.mjs`.
- If you add new environment variables, document them in `.env.example` **and** ensure CI’s synthetic values are updated.

---

## Key Configuration Files

| File                                     | What it controls                                                    |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `packages/database/supabase/config.toml` | Local Supabase ports/keys                                           |
| `nx.json`                                | Pipeline DAG, caching, env passthrough                              |
| `apps/portal/next.config.mjs`            | PWA, Sentry, `transpilePackages` for workspace deps                 |
| `knip.json`                              | Entry points for dead‑code detection (add new routes/features here) |
| `.mcp.json`                              | n8n MCP server & codebase‑memory MCP configuration                  |
| `.syncpackrc.js`                         | Inter‑package dependency version rules                              |
| `.secretlintrc.json`                     | Secret scanning patterns (runs on pre‑commit)                       |
| `pnpm-workspace.yaml`                    | Package catalog versions                                            |
| `jest.config.js` (portal)                | Module aliases, coverage thresholds                                 |

**When adding a new route or feature**, update `knip.json` to include the new entry points; otherwise knip may flag false positives.

---

## Real‑World Development Workflows

### Adding a New Database Table

1. Create migration: `packages/database/migrations/NNN_description.sql`
2. Enable RLS and add policies in the same migration (or separate).
3. Push to local DB: `pnpm --filter @repo/database supabase:push`
4. Regenerate types: `pnpm --filter @repo/database supabase:gen`
5. Update any Supabase client queries, ensuring server/client separation.
6. Write tests that exercise the new RLS policies (if security‑critical).
7. Update `AGENT_TRACER.md` in `packages/database` and `packages/supabase`.

### Adding a New UI Component

1. Create in `packages/ui/src/components/` with proper glass/token usage.
2. Export from `packages/ui/src/index.ts`.
3. If used in portal, add a `moduleNameMapper` entry in `apps/portal/jest.config.js`.
4. Ensure animations follow the design system rules.
5. Add unit tests for the component.
6. Update `AGENT_TRACER.md` in `packages/ui`.

### Adding a New Route in Portal

1. Determine route group and create `page.tsx` + `layout.tsx` if needed.
2. If it belongs to a department static sub‑page, re‑export `DepartmentLayout` from its own `layout.tsx`.
3. Add any required middleware exemptions (only if absolutely necessary).
4. Register the route in `knip.json` as an entry point.
5. Write E2E test for the new user flow.
6. Update `AGENT_TRACER.md` in `apps/portal`.

### Using Redis Caching

- Redis helpers in `packages/redis` are used primarily in middleware (`server/proxy.ts`) for department‑slug resolution.
- When adding new cached lookups, add a function with proper TTL and fallback.
- Instrument with OpenTelemetry/prom-client to track cache hit rates.
- Local Redis runs as part of the Supabase stack; connection string defaults are in `.env.example`.

---

## Common Pitfalls & Troubleshooting

| Problem                               | Solution                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Types not updating after migration    | Ensure `supabase:gen` was run; restart TypeScript server.                                                 |
| Middleware not applying to new routes | Check if the route is inside a group that is covered; ensure no accidental exemption.                     |
| Icon chunk too large                  | Never use `import * as Icons`. Run `knip:fix` to remove dead imports.                                     |
| Design tokens mismatch                | Run `pnpm --filter @repo/theme build` and check `lint:tokens` output.                                     |
| Jest cannot resolve `@repo/ui`        | Add the path to `moduleNameMapper` in `jest.config.js`.                                                   |
| Supabase local connection refused     | Ensure Docker is running and `supabase:dev` is active; check ports 54321/54322.                           |
| `pnpm quality` fails on format        | Run `pnpm format` (if available) or configure your editor to use Prettier.                                |
| `knip` reports false positives        | Verify the missing export is actually used; if so, add it to `knip.json` entry points or ignore patterns. |

---

## Security & Compliance

- **Never commit secrets**. Use `.env.example` as a template.
- All Supabase tables **must** have RLS enabled.
- Server Actions must validate user identity and authorization; never trust client‑sent IDs alone.
- Secrets scanning runs on pre‑commit (`.secretlintrc.json`); do not disable it.
- Report any security concerns in `AGENT_TRACER.md` so the next agent is aware.

---

## Checklist for Adding a Feature

Before considering a feature complete, an agent must verify:

- [ ] Migrations created and pushed (if DB changes)
- [ ] RLS policies defined and tested
- [ ] Types regenerated (`supabase:gen`)
- [ ] New environment variables added to `.env.example` and CI config
- [ ] UI components follow design system (tokens, glass, shadows, animations)
- [ ] Unit tests cover new logic (maintain coverage thresholds)
- [ ] E2E test for the user journey (if UI‑facing)
- [ ] Middleware rules reviewed (auth, caching)
- [ ] `knip.json` updated with new entry points
- [ ] `AGENT_TRACER.md` entries in all modified packages
- [ ] Inline breadcrumbs for complex business logic
- [ ] Runtime telemetry added for new services/critical paths
- [ ] Full `pnpm quality` passes locally

---

## Final Notes

- **Always consult `CLAUDE.md`** for deep‑dive technical details; this file is the procedural layer.
- **Agent continuity** depends on `AGENT_TRACER.md`—treat it as a mandatory logbook.
- When in doubt, leave a breadcrumb for the next agent.

**Now, go build safely.**

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
