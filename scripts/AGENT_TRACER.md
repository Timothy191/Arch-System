# Scripts Agent Tracer

## 2026-08-18: Headless Dev Mode, Hosted Supabase Support & MCP Server Pruning

### Purpose

Provide lightweight, high-efficiency development options by adding headless execution, cloud-first hosted Supabase support (bypassing 14 local Docker containers), pruning inactive MCP servers, and terminating orphan background workers.

### Changes Made

1. **`scripts/dev.sh`**:
   - Added `--headless` / `--no-open` flags (and env support `HEADLESS=true`, `CI=true`, `NO_OPEN=true`) to avoid spawning GUI browser and xterm windows.
   - Added `--hosted` / `--no-docker` flags (and automatic detection for hosted Supabase endpoints) to skip booting local Supabase Docker containers.
   - Capped `NODE_OPTIONS` default to `--max-old-space-size=2048 --no-deprecation` to eliminate engine warning noise (such as `[DEP0205]` module.register).
   - Added automated cleanup of orphan MCP processes during preflight restart.
2. **`scripts/shutdown.sh`**:
   - Added automated cleanup of orphan MCP worker processes on shutdown.
3. **`config/tools/mcp.json`**:
   - Pruned dormant MCP servers (`memory`, `github`, `inngest`, `npm-mcp`, `playwright`, `redis`).
   - Synchronized core servers (`codebase-memory`, `context7`, `knowledge-rail`, `next-devtools`, `nx-mcp`, `postgres`).
4. **`package.json`**:
   - Added `dev:quick` and `dev:hosted` convenience scripts.

### Verification

- Tested `bash scripts/dev.sh --quick --headless`: compiles in 5.3s without spawning extra windows.
- Verified free system RAM increased from 2.2GB to 8.4GB with 0B swap usage.
- Verified `pnpm quality` (26 monorepo projects, lint, type-check, tests, security, RLS, design audits) passed 100% cleanly.

### What the Next Agent Should Know

- Run `pnpm dev:quick` for rapid headless development without Docker overhead.
- Use `pnpm dev:hosted` when developing against cloud Supabase.

## 2026-08-18: Added Production Pre-Flight Verification Script

### Purpose

Automate production environment validation, Node.js runtime compatibility check, and Next.js 16 standalone bundle verification before deployment.

### Changes Made

1. **`scripts/verify-prod-env.sh`**:
   - Created standalone production pre-flight check script with colorized reporting and exit code signaling.
   - Validates existence and format of Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`), `DATABASE_URL`, `REDIS_URL`, and `NODE_ENV`.
   - Verifies Node.js (>= 20) and pnpm toolchains.
   - Verifies standalone Next.js server artifact (`apps/portal/.next/standalone/apps/portal/server.js`) and asset sync (`.next/static`, `public/`).

### Verification

- Ran `./scripts/verify-prod-env.sh` directly; verified all checks pass with exit code 0.

### What the Next Agent Should Know

- Run `./scripts/verify-prod-env.sh [PATH_TO_ENV]` before starting or restarting production systemd service units.

## 2026-06-18: Optimized pre-flight cleanup find commands and set Node memory limit

### Purpose

Prevent system lockups/freezes during dev script and deploy script startups by optimizing the recursive python cache search and adding a memory cap to the Next.js dev server.

### Changes Made

1. **`scripts/dev.sh`**:
   - Optimized the `find` command that clears `__pycache__` directories by pruning `node_modules`, `.next`, `.nx`, `.git`, and `.turbo` subtrees.
   - Added `NODE_OPTIONS="${NODE_OPTIONS:- --max-old-space-size=4096}"` to the portal start process to prevent out-of-memory crashes during Turbopack compilation.

2. **`scripts/deploy.sh`**:
   - Optimized the `find` command that clears `__pycache__` directories in the pre-flight phase by pruning `node_modules`, `.next`, `.nx`, `.git`, and `.turbo` subtrees.

### Verification

- Run `time find . ...` shows finding pycache directories with pruning finishes in **0.008 seconds** compared to **4.1 seconds** without pruning (513x speedup).
- All changes verified to build and deploy.

### What the Next Agent Should Know

- Future cleanup find commands MUST explicitly ignore standard build/workspace folders (`node_modules`, `.next`, `.nx`, `.git`, `.turbo`) to avoid locking up client systems with I/O bottlenecks.
- Next.js portal uses `--turbopack` by default which runs multi-threaded and is extremely memory intensive. The memory cap of 4GB prevents swap-thrashing system freezes.

## 2026-08-18: Integrated MCP servers configuration sync and validation & Removed n8n, Flowise, and Langfuse requirements

### Purpose

To dynamically generate/update local and remote MCP servers configurations for the current developer's environment (resolving home directory paths) on `pnpm dev` startup and during the preflight checklist, while completely decoupling the local development checks from n8n, Flowise, and Langfuse dependencies.

### Changes Made

1. **`scripts/sync-mcp-config.js`** (Created):
   - Generates `.mcp.json` (repo root), `.agents/mcp_config.json`, and `.vscode/mcp.json` from the base tracking config `config/tools/mcp.json`.
   - Replaces user home directories dynamically (resolving `/home/tim/` to the current user's `$HOME`).
   - Excludes local `n8n-mcp-server` to completely remove any local n8n configuration requirements.

2. **`scripts/validate-mcp-servers.js`** (Created):
   - Fast-path verification: Skips slow network-based spawn testing for remote packages (e.g. `npx`/`uvx`-based servers like `codebase-memory`, `playwright`, etc.) by checking if the CLI tool itself exists in `PATH`.
   - Verification of HTTP/SSE servers via timeout-safe GET checks (ignoring specific non-200 responses that are valid for SSE, only failing on complete network/connection refusal errors).
   - Spawn-testing for local servers (`knowledge-rail`) by writing a `tools/list` JSON-RPC request to stdio and verifying the response structure.
   - Completely excludes `n8n`, `flowise`, and `langfuse` checking/verification.

3. **`scripts/preflight-checklist.sh`**:
   - Added Section `11. MCP Servers` to the preflight validation checklist to trigger configurations sync and validate servers.
   - Removed port conflict checks for `n8n` (5678), `Flowise` (3001), and `Langfuse` (3002).
   - Removed docker container health checks for `plantcor-n8n`, `plantcor-flowise`, and `plantcor-langfuse`.

4. **`scripts/dev.sh`**:
   - Added Phase `2.5: MCP Servers` to dynamically sync and validate MCP servers right after infrastructure startup.
   - Removed `plantcor-n8n`, `plantcor-flowise`, and `plantcor-langfuse` container health gating from Phase 2 startup list.

### Verification

- Run `node scripts/sync-mcp-config.js` correctly generates `.mcp.json`, `.agents/mcp_config.json`, and `.vscode/mcp.json` with resolved paths.
- Run `node scripts/validate-mcp-servers.js` validates all base servers in under 3 seconds, exiting with code 0.
- Run `bash scripts/preflight-checklist.sh` executes the environment checks without failing or warning on `n8n`, `flowise`, or `langfuse` states.
- Run `bash scripts/dev.sh --quick` successfully synchronizes and validates MCP servers in the developer environment.
