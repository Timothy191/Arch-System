# Architecture & Monorepo

## Monorepo Structure

- **Package manager**: pnpm 9.12.0 (Volta-managed). Workspaces: `apps/*`, `packages/*`.
- **Node.js**: `>=20.17.0`.
- **Build orchestration**: Turborepo (`turbo.json`) + Nx. Tasks: `build`, `dev`, `lint`, `test`, `type-check`, `codegen` (theme tokens).
- **Dependency versioning**: pnpm workspace `catalog:` and named catalog blocks (e.g., `catalog:react19`). Check `pnpm-workspace.yaml` before bumping shared packages. Bumping a catalog entry affects all consuming packages automatically.

## Apps

- `apps/portal` — Next.js 15+ (App Router), React 19, Tailwind CSS. Main mining operations portal.
- `apps/cms` — Payload CMS v3 (headless).
- `apps/overview` — Standalone Next.js app for architectural visualization.

## Packages

- `@repo/theme` — Design tokens, OKLCH color system, Tailwind preset (`src/tailwind/preset.ts`), and `ArchThemeProvider` React context. Single source of truth for visual design. Apps import globals via `import "@repo/ui/globals.css"` and wrap with `<ArchThemeProvider>` from `@repo/theme/react`.
  - **Token pipeline**: `packages/theme/sd.config.mjs` (Style Dictionary) generates `src/tokens/generated.ts`. The `codegen` Turborepo task runs this before builds that depend on it.
- `@repo/ui` — Shared React components (GlassCard, KPI, DepartmentLayout, etc.) built with Radix UI, shadcn/ui, and Framer Motion.
- `@repo/supabase` — Shared Supabase clients (`createBrowserSupabaseClient`, `createMiddlewareClient`, `createServerSupabaseClient`, `createReadReplicaClient`) and auto-generated database types (`src/database.types.ts` from `supabase:gen`).
- `@repo/database` — SQL migrations in `migrations/`. This is the source of truth; `packages/supabase/supabase/migrations/` is a deploy-time copy.
- `@repo/errors` — Domain-specific error classes (e.g., `AuthError`, `ValidationError`). Prefer these over generic `Error`.
- `@repo/redis` — Shared Redis client utilities for caching (used in middleware for department slug resolution).
- `@repo/utils` — Common utilities (excel export, n8n integration, class merging via `cn()`). Subpath exports: `@repo/utils/inngest` (background jobs), `@repo/utils/novu` (notification workflows).
- `@repo/eval` — Python/DeepEval evaluation suite for AI code generation compliance. Runs independently via Poetry; not part of the Node.js `pnpm quality` gate.
- `@repo/eslint-config`, `@repo/typescript-config` — Shared tooling configs.

## Database

- **Migrations**: Source of truth is `packages/database/migrations/`. Naming convention: `NNN_description.sql` (zero-padded, sequential). `packages/supabase/supabase/migrations/` is a deploy-time copy; do not edit it directly.

## AI Orchestration

- **LangGraph state machine**: 8-node workflow in `apps/portal/lib/ai/agent-graph.ts`, with state definitions in `agent-state.ts` and Redis-backed rate limiter.
- **Modular AI subsystem**: `lib/ai/` contains distinct modules for chunking, embeddings, memory, prompts, schemas, SerpAPI integration, and tool definitions.
- **Conditional failover**: OpenRouter primary → Groq fallback via `lib/ai/providers.ts`.
- **Custom n8n MCP**: `.mcp.json` at the repo root exposes the `tools/n8n-mcp/` server to Claude Code.
