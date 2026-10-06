---
name: ecc
description: Enhanced Claude & Agent Capabilities. 50+ specialized agent roles, developer workflows, and automated scaffolding tools.
---

# Enhanced Claude & Agent Capabilities (ECC)

ECC provides an extensive suite of specialized agent roles, developer workflows, commands, and schemas.

## Repository Location

- Root: `/home/tim/Fork/ECC`
- Commands: `/home/tim/Fork/ECC/commands/`
- Agents: `/home/tim/Fork/ECC/agents/`
- Skills: `/home/tim/Fork/ECC/skills/`

## Autonomous Invocation

Agents can invoke specialized workflows or query agent definitions:

```bash
bun run /home/tim/Fork/ECC/commands/agent.js list
```

## Agent Guidelines

1. Query ECC schemas in `/home/tim/Fork/ECC/schemas/` when defining structured outputs.
2. Cross-reference specialized roles in `/home/tim/Fork/ECC/agents/` to discover optimal prompt constraints.
