# Root Workspace Agent Tracer

## 2026-06-18: Resolve Unused Catalog Entry Warning for @modelcontextprotocol/sdk

### Purpose

Resolve the `pnpm` workspace warning `Unused catalog entry: @modelcontextprotocol/sdk (default)` by consuming the defined catalog entry in the root `package.json`.

### Changes Made

1. **[package.json](file:///home/timothy/Documents/Arch-System/package.json)**:
   - Updated the `@modelcontextprotocol/sdk` devDependency version specifier from `"1.29.0"` to `"catalog:"`.

### Verification

- Run `pnpm install` to verify packages install cleanly and the warning is eliminated.
- Run `pnpm quality` to ensure all quality gates pass without issues.

### What the Next Agent Should Know

- The `@modelcontextprotocol/sdk` version is managed centrally in [pnpm-workspace.yaml](file:///home/timothy/Documents/Arch-System/pnpm-workspace.yaml). Any packages (including the root `package.json`) should reference it using the `"catalog:"` specifier to maintain version consistency across the monorepos.

## 2026-06-18: Remove Sentry MCP & Repair Inngest MCP

### Purpose

Remove the unused Sentry remote MCP server from `opencode.json` and verify the Inngest MCP configuration.

### Changes Made

1. **[opencode.json](file:///home/timothy/Documents/Arch-System/opencode.json)**:
   - Removed the `"sentry"` MCP entry (`"type": "remote"`, `"url": "https://mcp.sentry.dev/mcp"`).
   - Verified the `"inngest"` MCP entry is correctly configured with `"type": "remote"` and `"url": "http://127.0.0.1:8288/mcp"` (no changes needed — format matches OpenCode's standard pattern for HTTP-based MCP servers).

### What the Next Agent Should Know

- The `sentry` MCP entry has been removed from `opencode.json`. The `inngest` MCP server at `http://127.0.0.1:8288/mcp` is correctly configured and matches the format used by other remote MCP servers in the file. If the Inngest dev server is not running, the MCP connection will fail — start it with your Inngest CLI (`inngest dev` or `npx inngest-cli@latest dev`).

## 2026-06-18: Add & Upgrade MCP Servers

### Purpose

Replace deprecated Redis MCP with official `redis/mcp-redis`; add Supabase, Codebase Memory, npm, and Grafana MCP servers.

### Changes Made

1. **[opencode.json](file:///home/timothy/Documents/Arch-System/opencode.json)**:
   - Replaced deprecated `@modelcontextprotocol/server-redis` with official `redis-mcp-server` (via `uvx`)
   - Added `supabase` MCP (`@supabase/mcp-server-supabase@latest`) with `SUPABASE_ACCESS_TOKEN`
   - Added `codebase-memory` MCP (`codebase-memory-mcp`) — zero-dependency code index
   - Added `npm-mcp` MCP (`@mikusnuz/npm-mcp`) — npm package management
   - Added `grafana` MCP (`mcp-grafana` via `uvx`) with `GRAFANA_URL` and `GRAFANA_SERVICE_ACCOUNT_TOKEN`
   - Reordered all MCP entries alphabetically by key name

### What the Next Agent Should Know

- The Redis MCP now uses the official `redis/mcp-redis` server via `uvx` (~30+ tools vs 4). Requires `uv` to be installed (currently v0.11.21).
- Supabase MCP requires a Supabase PAT from https://supabase.com/dashboard/account/tokens and a project ref.
- `codebase-memory-mcp` requires no API keys — run "Index this project" on first use.
- Grafana MCP requires a Grafana instance URL and service account token.
- `npm-mcp` uses local `~/.npmrc` credentials by default (no token needed if logged in).
- All MCP entries are now sorted alphabetically under the `"mcp"` key.

## 2026-06-18: Remove Supabase & Grafana MCP Servers

### Purpose

Remove Supabase and Grafana MCP servers that are not needed.

### Changes Made

1. **[opencode.json](file:///home/timothy/Documents/Arch-System/opencode.json)**:
   - Removed `"grafana"` MCP entry (`mcp-grafana` via `uvx`)
   - Removed `"supabase"` MCP entry (`@supabase/mcp-server-supabase@latest`)

### What the Next Agent Should Know

- Both git stale markers have been removed from `opencode.json`. The file now contains 11 MCP entries (down from 13): codebase-memory, context7, github, inngest, memory, next-devtools, npm-mcp, nx-mcp, playwright, postgres, redis.
