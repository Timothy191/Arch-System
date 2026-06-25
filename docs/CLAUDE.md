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

| Pipeline      | Source                          | Generate                                                                     |
| ------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| Design tokens | `packages/theme/tokens.json`    | `pnpm --filter @repo/theme build`                                            |
| DB types      | `packages/database/migrations/` | `supabase:push` → `supabase:gen` → `packages/supabase/src/database.types.ts` |

Never edit `packages/supabase/supabase/migrations/` directly (PreToolUse hook blocks it).

## Domain rules (read on demand)

| Path                             | Covers                                       |
| -------------------------------- | -------------------------------------------- |
| `.claude/rules/architecture.md`  | Monorepo, packages, DB, AI                   |
| `.claude/rules/portal.md`        | Routes, shell, CI order                      |
| `.claude/rules/auth.md`          | Middleware, RLS, `/api/c66` exemption        |
| `.claude/rules/design-system.md` | Light-only, glass, shadows, motion           |
| `.claude/rules/*.md`             | testing, verification, git safety, workflows |

## Docs map

- [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) — navigation
- [`DESIGN.md`](DESIGN.md) · [`AGENTS.md`](AGENTS.md) · [`DEPLOYMENT.md`](DEPLOYMENT.md) · [`SECURITY.md`](SECURITY.md)
- [`.claude/guides/operational-handbook.md`](.claude/guides/operational-handbook.md) — full commands, workflows, pitfalls, MCP

## Agent essentials

- Quality gate: lint → type-check → test → `pnpm quality` before done.
- Git: no writes without user permission; never `--no-verify`; no force-push to `master`.
- Heavy exploration → subagents; compact at task boundaries (~50% context).
- Reporecall: use injected context first; search only to fill gaps.

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
