# Root Workspace Agent Tracer

## 2026-06-18: Audit and Clean Up Ollama/LM Studio References & Obsolete Docs

### Purpose

Conduct a full-project audit to ensure all Ollama and LM Studio dependencies/references are completely removed. Clean up obsolete and outdated documentation files referencing the discontinued local AI service to prevent broken wiki links and maintain documentation accuracy.

### Changes Made

1. **Obsolete Documentation Removed**:
   - Deleted [ai-providers.md](file:///home/timothy/Documents/Arch-System/docs/wiki/comparisons/ai-providers.md) (obsolete comparison of AI providers).
   - Deleted [ai-service.md](file:///home/timothy/Documents/Arch-System/docs/wiki/concepts/ai-service.md) (obsolete system description of the discontinued local AI service).

2. **Documentation Cleaned Up**:
   - Updated [ENVIRONMENT_FILES_GUIDE.md](file:///home/timothy/Documents/Arch-System/docs/ENVIRONMENT_FILES_GUIDE.md) to remove Ollama environment variables (`OLLAMA_URL`, `OLLAMA_EMBED_MODEL`) and troubleshooting references.
   - Updated [STATUS.md](file:///home/timothy/Documents/Arch-System/docs/wiki/STATUS.md) to remove Ollama from technology stack, deliverables, and next steps.
   - Updated [index.md](file:///home/timothy/Documents/Arch-System/docs/wiki/index.md) to remove links to obsolete AI/Ollama-related pages.
   - Updated [project-overview.md](file:///home/timothy/Documents/Arch-System/docs/wiki/concepts/project-overview.md) to remove Section 5 (Local Offline AI Architecture) and renumber subsequent sections.
   - Updated [arch-systems.md](file:///home/timothy/Documents/Arch-System/docs/wiki/entities/arch-systems.md) to remove AI stack definitions, `api/ai` endpoints, and Ollama status references.
   - Updated [UPDATE_SUMMARY.md](file:///home/timothy/Documents/Arch-System/docs/wiki/UPDATE_SUMMARY.md) to mark deleted AI concept files as `[Deleted]`.

3. **Code/Dependency Verification**:
   - Verified that no code files, configurations, package dependencies, or docker compose setups contain Ollama or LM Studio references.

### Verification

- Run `pnpm format` to ensure formatting complies with project styles.
- Run `pnpm quality` to verify all quality gates pass successfully.

### What the Next Agent Should Know

- All active references to local AI inference, Ollama dependencies, and LM Studio are completely removed from the workspace.
- The embedding cache table (`embedding_cache`) and historic vector schemas (768-dim Nomics) remain in database migrations and schema configurations for potential future caching usage, but all generative execution pathways have been discontinued.

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

## 2026-06-18: Resolve MCP Issues & Command Conflicts

### Purpose

Resolve the disconnected `codebase-memory-mcp` server and the command name collision for `/monitor-ci`.

### Changes Made

1. **MCP Fix**:
   - Identified that `codebase-memory-mcp` was disconnected due to a missing binary at `~/.local/bin/codebase-memory-mcp`.
   - Created a symlink from the Volta-managed binary to `~/.local/bin/codebase-memory-mcp`.
   - Verified connection status via `gemini mcp list`.
2. **Command Conflict Resolution**:
   - Resolved the collision between the workspace command (`.gemini/commands/monitor-ci.toml`) and the skill command (`.agents/skills/monitor-ci/SKILL.md`).
   - Renamed `.gemini/commands/monitor-ci.toml` to `.gemini/commands/monitor-ci.toml.bak` to allow the skill-based command to take precedence as `/monitor-ci`.

### What the Next Agent Should Know

- `codebase-memory-mcp` is now connected and available for use (search_graph, trace_path, etc.).
- The `/monitor-ci` command is now exclusively handled by the `monitor-ci` skill. If customization is needed, modify the skill directly or restore the `.toml` with a different name.
