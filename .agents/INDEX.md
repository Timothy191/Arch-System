# .agents/ Index

This directory contains agent-related configurations, skills, rules, and memory structures.

## Directories and Files

- `a2a/` - Agent-to-agent communication protocols and configurations.
- `agents/` - Definitions of specialized agent personas and their capabilities.
- `bin/` - Executable scripts and tools for agent operations.
- `CHECKLIST.md` - Pre-deployment and verification checklists for agents.
- `context/` - Context templates and dynamic context leasing configurations.
- `GUIDE.md` - Comprehensive guide for working with agents in this ecosystem.
- `hooks/` - Hook scripts that run at various points in the agent lifecycle.
- `hooks.json` - Configuration for hook execution.
- `mcp_config.json` - Model Context Protocol server configurations.
- `memory_base/` - Persistent memory storage for agent experiences and learnings.
- `ONBOARDING.md` - Guide for new agents joining the fleet.
- `README.md` - Overview of the .agents/ directory.
- `references/` - Reference materials for agent development and integration.
- `rules/` - Governance rules, constraints, and validation policies for agents.
- `skills/` - Reusable skill definitions that agents can lease and execute.
- `skills.json` - Index of available skills with metadata.
- `SYSTEMS.md` - Documentation of agent systems and their interactions.

## Usage

Agents should consult this index to understand the available components before exploring the directory structure in depth, saving tokens by reducing the need for extensive file reads.

## Auto-Update

This index should be updated whenever the structure of the .agents/ directory changes significantly. Consider automating this with a script that runs on directory changes.