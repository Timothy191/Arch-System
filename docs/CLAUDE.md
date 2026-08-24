# CLAUDE.md

> **Slim session index** — full handbook: [`.claude/guides/operational-handbook.md`](.claude/guides/operational-handbook.md)

Mining operations portal monorepo (Nx + pnpm). Portal `:3000`. Node `>=22`, pnpm `9.15.9`, ESM.

## Mandatory tracing (every code change)

1. Update `AGENT_TRACER.md` in the modified package/app (ISO 8601, purpose, changes, handoff).
2. Add `// AGENT-TRACE:` breadcrumbs for non-obvious logic.
3. Instrument new service paths (OpenTelemetry / prom-client) where applicable.

## Quick start

```bash
pnpm install
cp apps/portal/env/.env.example apps/portal/.env
pnpm --filter @repo/database supabase:dev   # Docker, separate terminal
pnpm dev                                     # :3000
pnpm quality                                 # before push
```

Bootstrap: `pnpm dev:up --all` (`--quick`, `--tools`, `--cms`, `--overview`).

## Codegen — never edit generated output

| Pipeline      | Source                                                 | Generate                                                                      |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Design tokens | `packages/theme/src/css/variables.css` + `tokens.json` | `pnpm --filter @repo/theme build` → `generated.ts`, `variables-generated.css` |
| DB types      | `packages/database/migrations/`                        | `supabase:push` → `supabase:gen` → `packages/supabase/src/database.types.ts`  |

Never edit `packages/supabase/supabase/migrations/` directly. Source of truth is `packages/database/migrations/`.

## Project Instructions & Rules Map

- **Behavioral Guidelines**: Defined in [`.claude/rules/`](.claude/rules/) (`process.md`, `architecture.md`, `portal.md`, `auth.md`, `design-system.md`, `development-practices.md`, `testing.md`, `task-workflow.md`, `code-review.md`).
- **Specialist Profiles**: Specialist agent prompts live in [`.claude/agents/`](.claude/agents/) for domain-specific tasks (`backend-architect`, `database-architect`, `nextjs-developer`, `ui-ux-designer`, `fullstack-developer`).
- **Documentation**: [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) · [`DESIGN.md`](DESIGN.md) · [`AGENTS.md`](AGENTS.md) · [`DEPLOYMENT.md`](DEPLOYMENT.md)

## Agent essentials & Nx Guidelines

- **Quality gate**: `pnpm quality` before done (lint → type-check → test → knip → audit).
- **Graph & Slicing**: Use `codebase-memory` (`get_architecture`, `search_graph`, `trace_path`), `grep_search`, and bounded slicing (`StartLine`/`EndLine`).
- **Nx execution**: Always prefix with package manager (`pnpm nx build`, `pnpm nx test`). Invoke `nx-workspace` for project lookup and `nx-generate` for scaffolding.
- **Git**: No writes without user permission; never `--no-verify`; no force-push.
