# Multi-Agent Architecture: MCP Tool Integrations & Environment State

This document tracks active MCP server configurations, communication protocols, and execution boundaries for AI agents operating on the Arch-Systems repository.

## Active MCP Server Matrix

| Server Identifier     | Transport / Connection                                   | Working Root / Scope                       | Purpose                                                                          |
| :-------------------- | :------------------------------------------------------- | :----------------------------------------- | :------------------------------------------------------------------------------- |
| `knowledge-rail`      | `stdio` via binary `/home/tim/.local/bin/knowledge-rail` | `--root /home/tim/Documents/Arch-System`   | Local-first project knowledge base, graph traversal, and documentation indexing. |
| `codebase-memory`     | `stdio` via `npx codebase-memory-mcp`                    | Workspace root                             | Semantic code search and AST knowledge graph query engine.                       |
| `github`              | `stdio` via `npx @modelcontextprotocol/server-github`    | GitHub API                                 | Repository management, PR, and issue automation.                                 |
| `postgres`            | `stdio` via `npx @modelcontextprotocol/server-postgres`  | Cloud PostgreSQL via Supavisor (port 6543) | Database schema inspection and query validation.                                 |
| `redis`               | `stdio` via `uvx redis-mcp-server`                       | Local Redis (port 6379)                    | Cache inspection and telemetry state management.                                 |
| `playwright`          | `stdio` via `npx @playwright/mcp`                        | Local headless browser                     | Live visual verification and E2E regression testing.                             |
| `chrome-devtools-mcp` | `stdio` via `npx chrome-devtools-mcp`                    | Chrome DevTools instance                   | Performance tracing, Lighthouse audits, and network inspection.                  |
| `next-devtools`       | `stdio` via `npx next-devtools-mcp`                      | Next.js portal application                 | Next.js 16 runtime inspection and cache evaluation.                              |

## Startup & Configuration Rules

1. **Explicit Project Root Required**:
   - `knowledge-rail` MUST always be passed `["--root", "/home/tim/Documents/Arch-System"]` in both global `~/.gemini/config/mcp_config.json` and `.agents/mcp_config.json` to prevent home directory inference failures.
2. **Conditional Dev Servers**:
   - HTTP-based local stream servers (such as `inngest` on port `8288`) should only be configured when the local dev daemon (`npx inngest-cli dev`) is running.
3. **Google ADC Pre-requisites**:
   - Google Cloud Quotas and GCP MCP tools require authenticated ADC (`gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS`).
