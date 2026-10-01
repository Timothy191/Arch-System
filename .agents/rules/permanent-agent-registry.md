---
description: 'Permanent agent registration, 9-pillar setup, and auto-deployment policy'
paths: ['.agents/agents/**/*', '.agents/a2a/registry/**/*', 'packages/agents/**/*']
---

# Permanent Agent Registry & Auto-Deployment Policy

## 1. Permanent Persistence Mandate

Every newly authored or synthesized agent MUST be permanently registered in `.agents/a2a/registry/` and `.agents/agents/`. No ephemeral "one-off" agents without registration.

## 2. The 9-Pillar Specification Standard

All registered agents must strictly define the 9 Core Pillars:

1. **Identity**: Name, version, domain authority, and system role.
2. **Model Tier**: Fixed tier (`inherit | flash_lite | flash | pro`).
3. **Tool Sandbox**: Whitelisted tools, read/write boundaries, and MCP server access.
4. **Path Scope**: Strict glob patterns defining allowed workspace mutation scopes.
5. **Runbook**: Sequential procedural instructions.
6. **Hard Negatives**: Explicitly forbidden operations and anti-patterns.
7. **Input Contract**: Strict JSON schema defining required invocation inputs.
8. **Output Contract**: Schema-strict JSON or Markdown structure.
9. **Error Recovery & Memory**: Auto-fallback mechanisms, skill bindings, and `.agents/memory_base/` error logging.

## 3. Pre-Population & Warm Redeployment

Agents are pre-populated with:

- Relevant domain memories and previous error retrospectives from `.agents/memory_base/`.
- Required toolkits and MCP server configurations (`mcp_config.json`).
- Reusable skills located in `.agents/skills/`.

## 4. Auto-Deployment Protocol

When an orchestrator or coordinator encounters a task requiring a missing capability, it MUST automatically provision and register the new specialist adhering to the 9-pillar schema before executing the task.

## 5. MCP Server Registration & Onboarding Mandate

Upon onboarding into the workspace or starting an operational session, every agent MUST execute or verify:

```bash
pnpm mcp:verify   # Audits that all 7 agent runtimes have required MCP servers registered
pnpm mcp:onboard  # Automatically provisions and synchronizes missing MCP server configurations
```

Mandatory MCP servers defined in `tools/mcp/mcp-registry.json` include:

- **`firecrawl`**: Web scraping, crawling, paper research, and Alexandria contracts (`FIRECRAWL_API_KEY`).
- **`upstash`**: Serverless Redis, QStash, Vector, Search, Box, and Blob (`UPSTASH_*` credentials).
- **`filesystem`**: Safe workspace file operations.
- **`memory`**: Cross-session knowledge graph memory.
- **`sequential-thinking`**: Structured dynamic problem decomposition.
- **`ripgrep`**: Fast AST and regex code search.
- **`git`**: Monorepo VCS operations.
- **`fetch`**: Zero-auth web content retrieval.
- **`context7`**: Real-time framework and library documentation.
