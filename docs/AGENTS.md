# AGENTS.md

## ⚠️ MANDATORY AGENT TRACING RULE

**ALL AGENTS MUST FOLLOW THIS RULE ON EVERY CODE CHANGE:**

1. **Update AGENT_TRACER.md** in the package/app you're modifying
   - Log timestamp, purpose, changes made, and what the next agent should know
   - Location: `packages/<package>/AGENT_TRACER.md` or `apps/<app>/AGENT_TRACER.md`

2. **Leave inline breadcrumbs** for complex architectural logic
   - Use `// AGENT-TRACE: <explanation>` or `/* AGENT-TRACE: ... */` comments
   - Explain implicit business rules and domain context

3. **Add runtime telemetry** where applicable
   - Instrument functions with prom-client or OpenTelemetry spans

**FAILURE TO FOLLOW THIS RULE IS A VIOLATION OF AGENT CONTRACTS**

See bottom of this file for full details.

---

## Related Documentation

This file complements the main project documentation:

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Complete documentation index and quick navigation guide
- **[CLAUDE.md](CLAUDE.md)** — Complete technical guide, commands, and architecture details
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Deployment guide for all environments
- **[DESIGN.md](DESIGN.md)** — Design system and component rules
- **[PRODUCT.md](PRODUCT.md)** — Product strategy and user personas

---

## Prerequisites

- Node.js `>=22` (via Volta), pnpm `9.15.9`, Docker (for local Supabase)

## Quick Start

```bash
pnpm install
cp apps/portal/.env.example apps/portal/.env     # also fill root .env.example fields
pnpm --filter @repo/database supabase:dev        # separate terminal, Docker; db on :54321
pnpm dev                                          # Next.js dev server on :3000
```

## Monorepo

Nx + pnpm workspaces (`apps/*`, `packages/*`).

| Area                | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `apps/portal`       | Next.js 15 mining operations portal (main app)                 |
| `apps/cms`          | Payload CMS v3                                                 |
| `apps/overview`     | Standalone architectural visualisation                         |
| `packages/ui`       | Shared Radix/shadcn UI components                              |
| `packages/theme`    | OKLCH design tokens + Tailwind preset (single source of truth) |
| `packages/supabase` | Browser, server, and middleware Supabase clients               |
| `packages/database` | SQL migrations (source of truth)                               |
| `packages/redis`    | Redis cache helpers (department slug resolution in middleware) |
| `packages/eval`     | Python/DeepEval AI code-generation compliance suite            |

Dependency versions use pnpm [`catalog:`](pnpm-workspace.yaml) indirection (e.g. `catalog:react19`).  
Before changing a shared dep, look up the named catalog block in `pnpm-workspace.yaml`.

## Code Generation Pipeline

Two codegen pipelines generate derived artifacts from source-of-truth files:

### 1. Design Tokens (`@repo/theme`)

| Step             | Command                                          | Input                                             | Output                                   |
| ---------------- | ------------------------------------------------ | ------------------------------------------------- | ---------------------------------------- |
| Style Dictionary | `pnpm --filter @repo/theme codegen` (or `build`) | `packages/theme/tokens.json` + `sd.config.mjs`    | `packages/theme/src/tokens/generated.ts` |
| Token validation | `pnpm --filter @repo/theme lint:tokens`          | `src/css/variables.css`, `src/tailwind/preset.ts` | Lint pass/fail                           |

**Workflow:** Edit `tokens.json` → run `pnpm --filter @repo/theme build` (runs Style Dictionary) → commit both `tokens.json` and `generated.ts`. The Tailwind preset (`src/tailwind/preset.ts`) and CSS variables (`src/css/variables.css`) consume the generated tokens.

Dev watch mode: `pnpm --filter @repo/theme dev` or `pnpm --filter @repo/theme tokens:watch`.

### 2. Database Types (`@repo/database` → `@repo/supabase`)

| Step      | Command                                     | Input              | Output                                    |
| --------- | ------------------------------------------- | ------------------ | ----------------------------------------- |
| Migration | `packages/database/migrations/NNN_name.sql` | SQL DDL            | Applied to Supabase                       |
| Type gen  | `pnpm --filter @repo/database supabase:gen` | Supabase DB schema | `packages/supabase/src/database.types.ts` |

**Workflow:** Create migration → `supabase:push` → `supabase:gen` → commit migration + updated `database.types.ts`.

---

## Commands (non-obvious ones bolded)

```bash
pnpm dev                    # portal only (Next.js :3000)
pnpm --filter portal dev   # explicit portal

# quality gate (runs lint → type-check → test → lint:tokens → lint:css → format-check → lint-root → deps:lint → knip)
pnpm quality

# files not obvious from scripts alone:
pnpm --filter @repo/database supabase:push  # push migrations to local DB
pnpm --filter @repo/database supabase:reset # destructive — wipes local DB
pnpm --filter @repo/database supabase:gen    # regen TS types → packages/supabase/src/database.types.ts
pnpm knip:fix               # auto-remove dead exports/deps found by knip
pnpm md:fix                 # auto-fix markdown lint
pnpm monitor:grafana-stop   # stop Grafana stack started by monitor:grafana
```

Run a **single file**:

```bash
pnpm --filter portal test -- --testPathPatterns=<file>
```

---

## Supabase Migrations

Source of truth: `packages/database/migrations/` — zero-padded sequential numbers (`NNN_name.sql`).  
`packages/supabase/supabase/migrations/` is a deploy-time copy only; **never edit directly**.  
`supabase:gen` must always be run after a migration to regenerate `packages/supabase/src/database.types.ts`.  
CI/services use env vars prefixed with `SUPABASE_` (not `NEXT_PUBLIC_SUPABASE_`).

---

## Supabase Auth & Middleware

- Proxy at `apps/portal/server/proxy.ts` (renamed from `middleware.ts` in Next.js 16): handles session refresh, department-slug → UUID resolution (Redis-cached), and role-based route gating.
- The **`employees` table** is the authorization source of truth: role = `employees.role`, department = `employees.department_id`, not Supabase Auth metadata.
- `/api/c66` is **exempt from auth** — keep this when touching proxy.
- Server Actions: `createServerSupabaseClient()` from `@repo/supabase/server`. **Always validate the user at the top.**
- **RLS** must be enabled on every new Supabase table.
- New `@repo/*` imports in portal tests: add the corresponding `moduleNameMapper` entry in `apps/portal/jest.config.js` (for new UI components, etc).

---

## Portal Path Aliases

```
~/*     → apps/portal/*
@/*    → apps/portal/*
```

`@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*` → respective subdirectories.  
Root layout: `apps/portal/app/layout.tsx` — mounts `ArchThemeProvider`, `OfflineBanner`, `AnimatedWavesBackground`, `AIAssistantSidebarWrapper`.

---

## Portal Route Groups

| Group                         | Notes                                                                                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(auth)/`                     | Login, reset/update password — auth layout + `AnimatedWavesBackground`                                                                                                                                                       |
| `(departments)/[department]/` | Dynamic dashboard per department (drilling, production, engineering, …) and static sub-routes like `drilling/drilling-operations/` — **static sub-pages must export their own `layout.tsx` re-exporting `DepartmentLayout`** |
| `(hub)/`                      | Landing / executive view                                                                                                                                                                                                     |
| `api/`                        | API routes (ai, c66, export, health, plugins, sync, tools, webhooks); Server Actions co-located near features                                                                                                                |
| `admin/`                      | Admin panel                                                                                                                                                                                                                  |

---

## Design System (visit `DESIGN.md` for full palette)

- **Light-only theme** — hardcoded via `<script>` in `<head>`; `data-theme="light"`; dark mode does not exist.
- **Shadows**: raw `box-shadow` and Tailwind `shadow-sm/md/lg` are **forbidden**. Use `shadow-card`, `shadow-window`, `shadow-diffusion-*` tokens only.
- **Glass pattern**: `bg-white/70 backdrop-blur-xl border border-black/[0.08]`
- **Class merging**: always use `cn()` from `@repo/ui/lib/utils`
- **Icon imports**: always named (`import { Drill } from "lucide-react"`), never `* as Icons`. Unscoped imports produced a 1.3 MB chunk in the past.
- **Animation**: only `opacity`, `transform`, `background-color`, `border-color`, `color`; never layout props. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Liquid Glass Motion**: Division of labor between CSS and Framer Motion: CSS transitions handle hover shapes (`border-radius`) and hover scale/squish transforms; Framer Motion handles the active press/tap scaling (using `tapScale` / `whileTap` while setting `hoverScale={1}` to avoid conflicts).

---

## Testing

| Suite                       | Command                                                  | Notes                                                                  |
| --------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Unit (Jest, jsdom, ts-jest) | `pnpm test`                                              | Does **not** need Supabase running                                     |
| Single file                 | `pnpm --filter portal test -- --testPathPatterns=<file>` |                                                                        |
| E2E (Playwright)            | `pnpm test:e2e`                                          | **Requires dev server on :3000**                                       |
| Visual snapshots            | `e2e/visual/__snapshots__/`                              | Chromium binary: `/usr/bin/google-chrome` (see `playwright.config.ts`) |
| AI compliance               | `packages/eval/` (Python/DeepEval)                       |                                                                        |

Coverage targets: lines 40 %, branches 30 %, functions 35 %, statements 40 % (`jest.config.js`).

---

## CI Verification Order

```
deps:lint → lint → type-check → test → build → bundlesize
```

CI also runs `pnpm md:lint`. The `quality` gate bundles all of the above; run it before pushing.

---

## Environment Variables (local vs CI)

Start local from `apps/portal/.env.example`:

- Supabase local: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, service key from `supabase start` output.
- Read-replica (optional): `SUPABASE_READ_REPLICA_URL=http://127.0.0.1:54322`
- CI uses synthetic values; do not ship real keys.

---

## Key Config Files

| File                                     | What it controls                                          |
| ---------------------------------------- | --------------------------------------------------------- |
| `packages/database/supabase/config.toml` | Local Supabase port / keys                                |
| `nx.json`                                | Pipeline DAG, env passthrough, cache rules                |
| `apps/portal/next.config.mjs`            | PWA + Sentry + `transpilePackages` for workspace deps     |
| `knip.json`                              | Entry points for dead-code detector (add new routes here) |
| `.mcp.json`                              | n8n MCP server (`tools/n8n-mcp/`), codebase-memory MCP    |
| `.syncpackrc.js`                         | Inter-package dependency version checks                   |
| `.secretlintrc.json`                     | Secret scanning on staged files (lint-staged hook)        |

### Agent Tracing & Context Hand-off (MANDATORY RULE)

- **Workflow Traces**: All agents MUST update the `AGENT_TRACER.md` file in the root of the package/app they are modifying. You must log a timestamp, your purpose, the changes made, and what the next agent should know.
- **Context Breadcrumbs**: When implementing complex architectural logic, agents MUST leave inline `// AGENT-TRACE: <explanation>` or `/* AGENT-TRACE: ... */` comments. This ensures future AI agents understand the implicit business rules or domain context immediately upon reading the file.
- **Runtime Telemetry**: Where applicable, ensure functions are instrumented (e.g., `prom-client` or OpenTelemetry spans) so runtime behavior can be analyzed by subsequent debugging agents.
