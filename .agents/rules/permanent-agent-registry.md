---
description: "Permanent agent registration, 9-pillar setup, and auto-deployment policy"
paths: [".agents/agents/**/*", ".a2a/registry/**/*", "packages/agents/**/*"]
---

# Permanent Agent Registry & Auto-Deployment Policy

## 1. Permanent Persistence Mandate

Every newly authored or synthesized agent MUST be permanently registered in `.a2a/registry/` and `.agents/agents/`. No ephemeral "one-off" agents without registration.

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
9. **Error Recovery & Memory**: Auto-fallback mechanisms, skill bindings, and `.memory_base/` error logging.

## 3. Pre-Population & Warm Redeployment

Agents are pre-populated with:

- Relevant domain memories and previous error retrospectives from `.memory_base/`.
- Required toolkits and MCP server configurations (`mcp_config.json`).
- Reusable skills located in `.agents/skills/`.

## 4. Auto-Deployment Protocol

When an orchestrator or coordinator encounters a task requiring a missing capability, it MUST automatically provision and register the new specialist adhering to the 9-pillar schema before executing the task.
