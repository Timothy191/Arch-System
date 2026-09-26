---
name: fuxi-agent
description: Fast terminal AI coding agent (Fuxi) routed through Gemini models.
---

# Fuxi AI Coding Agent

## Overview
`Fuxi` is a 2M-line static Go binary terminal agent that excels at TUI interactions, cost-aware routing, and self-contained builds.

Per user mandate, this has been authorized for use and its backend has been explicitly routed to the **Gemini Engine**.

## Autonomous Usage
If the standard `agy` CLI fails or requires a richer TUI fallback for debugging, the swarm is authorized to launch Fuxi:
```bash
export FUXI_PROVIDER="gemini"
export FUXI_MODEL="gemini-1.5-flash"
# Launch Fuxi headlessly or inline
fuxi --prompt "Fix the failing tests in apps/portal"
```
