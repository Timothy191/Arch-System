# Scripts Agent Tracer

## 2026-08-28: FUXA Gauge-Grid Generator (`fuxa-gauge-grid.py`)

### Purpose

Reproducible FUXA SCADA dashboard: regenerates a view of radial gauges (one per portal telemetry tag) via FUXA's `set-view` API, so the operator dashboard can be rebuilt from code when the telemetry tag set changes — without hand-authoring gauges in the FUXA editor.

### Changes

- Added `scripts/fuxa-gauge-grid.py` (stdlib-only Python): fetches tags from the portal reverse-flow endpoint (`/api/scada/tags`), clones the existing view's gauge styling (or a faithful `svg-ext-html_bag` template), lays out a configurable grid, sets per-metric min/max + labeled zones, and saves with `POST /api/projectData {cmd:"set-view"}`. Optional `FUXA_API_KEY` sent as `x-api-key` (never printed). Supports `--dry-run`.

### Verification

- `python3 -m py_compile` OK; `--dry-run` builds the 10-gauge grid with correct ranges; real run `set-view` HTTP 200, view persisted with 10 bound gauges.

### Notes

- Reverse-flow integration: FUXA (host networking) pulls `/api/scada/tags`; this script only authors the visualization layer. Re-run after adding new telemetry metrics.

## 2026-08-27: Dev Server Boot Watchdog Timeout Resilience

### Purpose

Prevent false positive watchdog timeouts on `pnpm dev` when Next.js Turbopack compilation, cloud Supabase REST checks, MCP server synchronization, and Phase 4 smoke test curls exceed 10 seconds.

### Changes

- Updated `scripts/dev.sh` to set `WATCHDOG_TIMEOUT="${WATCHDOG_TIMEOUT:-60}"` (defaulting to 60s instead of hardcoded 10s) and dynamically format the error message.

### Handoff

The dev server script now allows adequate time for full Turbopack initial compilation and smoke test validation to complete before triggering a watchdog abort.

## 2026-08-25: Resilient Dev Probes

### Purpose

Prevent optional connectivity probes from aborting `pnpm dev` and avoid displaying Redis credentials in security diagnostics.

### Changes

- Made hosted Supabase, FUXA, and smoke database curl assignments non-fatal under `set -e`.
- Normalized Redis URLs by removing schemes, credentials, ports, and paths before classification.

### Handoff

Unavailable optional services now produce warnings and allow startup to continue; probe exit codes no longer terminate the launcher.

## 2026-08-25: Dev Terminal Output Refresh

### Purpose

Improve the readability and visual hierarchy of `scripts/dev.sh` startup output.

### Changes

- Replaced the large ASCII banner with a compact bordered control-panel header.
- Standardized check rows with consistent `OK`, `ERR`, `WARN`, `SKIP`, and `INFO` badges.
- Simplified phase separators and grouped ready-state endpoints under Services and Controls.

### Handoff

Startup behavior and health-check logic are unchanged; only terminal presentation was revised.

## 2026-08-21: Split-Terminal SysOps HUD with Animated ASCII Architecture & Error Stream

### Purpose

Upgrade status terminal into a zero-flicker split-screen SysOps HUD with live animated ASCII architecture topology, connection pulse packet animations, security error boundary metrics, and syntax-highlighted server error streaming.

### Changes Made

1. **`scripts/monitor-hud.sh`**:
   - Re-engineered with curses `tput` absolute positioning (zero terminal flicker).
   - Side-by-side split layout on wide terminals (Left: Animated Topology & Deployment Metrics, Right: Live Server Stream & Error Trace).
   - Animated ASCII architecture topology with real-time traveling pulse packets (`──●──▶`).
   - Dynamic service health checks (Next.js 16, Supabase Cloud PG, Redis, FUXA SCADA) with latency meters.
   - Syntax-highlighted log stream (`[ERR]` in bold red, `[WRN]` in yellow, `200` in green, `Compiling` in cyan).
2. **`scripts/dev.sh`**:
   - Updated `launch_status_terminal()` to launch the new `scripts/monitor-hud.sh` SysOps HUD automatically upon development startup.

## 2026-08-18: Added Codebase Maps Regeneration Script

### Purpose

Automate the regeneration of codebase visualization maps with date updates, version management, and optional SVG generation from Mermaid diagrams.

### Changes Made

1. **`scripts/regenerate-codebase-maps.sh`** (Created):
   - Created script to regenerate all codebase maps with current date stamps
   - Supports `--with-svg` flag for SVG image generation from Mermaid diagrams
   - Supports `--full` flag placeholder for future full regeneration with subagent capability
   - Automatically cleans up old map versions (keeps last 3)
   - Provides comprehensive help documentation

2. **`codebase-maps/README.md`** (Created):
   - Created comprehensive documentation for the codebase maps directory
   - Documented all 6 available maps with descriptions and use cases
   - Added visualization section explaining Mermaid diagram types
   - Added regeneration instructions and troubleshooting guide
   - Integrated with main documentation index

3. **`codebase-maps/generate-svg.sh`** (Created):
   - Created script to extract Mermaid diagrams from markdown files
   - Converts Mermaid code to SVG using mmdc CLI
   - Includes graceful fallback when Mermaid CLI is not available
   - Handles errors and provides warnings for failed conversions

4. **`docs/DOCUMENTATION_INDEX.md`** (Updated):
   - Added "Architecture & Visualization" section with link to codebase maps
   - Added codebase maps to "Quick Lookup" section for easy navigation
   - Positioned maps as a resource for understanding system architecture

### Verification

- Ran `./scripts/regenerate-codebase-maps.sh --help` successfully displays usage information
- Verified script correctly handles date updates and version management
- Confirmed SVG generation script gracefully handles missing Mermaid CLI
- Verified documentation links in DOCUMENTATION_INDEX.md are correct

### What the Next Agent Should Know

- Run `./scripts/regenerate-codebase-maps.sh` to update map dates and manage versions
- Run `./scripts/regenerate-codebase-maps.sh --with-svg` to also generate SVG images (requires Mermaid CLI with Puppeteer)
- The script currently performs partial regeneration (date updates). Full content regeneration requires Devin CLI with subagent capability.
- SVG generation is optional - the markdown files with embedded Mermaid diagrams render natively in GitHub/GitLab

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
