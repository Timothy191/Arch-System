---
name: palabre
description: Multi-agent contradictory debate orchestrator, consensus synthesis, and independent peer review runner for Claude Code, Codex, Antigravity, and Ollama agents.
---

# Palabre Autonomous Debate & Consensus Runbook

## Overview

PALABRE is an autonomous CLI orchestrator that facilitates structured debates and comparative syntheses between multiple local AI agents (Claude Code, Codex, Antigravity, OpenCode, and local Ollama) with zero external cost.

---

## 1. Core CLI Commands

| Command                                   | Action                                                          | Example                                                                |
| :---------------------------------------- | :-------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `palabre "<subject>" -t <turns>`          | Launch contradictory debate between default agent pair          | `palabre "Evaluate RLS InitPlan caching vs Materialized Views" -t 4`   |
| `palabre ask "<subject>" --agents <list>` | Solicit independent answers and produce a comparative synthesis | `palabre ask "Verify C66 audio haptic feedback" --agents codex claude` |
| `palabre agents`                          | List available local CLI agents detected on system              | `palabre agents`                                                       |
| `palabre doctor`                          | Assert health and tool accessibility across local agent fleet   | `palabre doctor`                                                       |
| `palabre history`                         | Inspect past debate transcripts and consensus records           | `palabre history`                                                      |

---

## 2. Agent Workflow Integration

- **Pre-Write Consensus Gate**: Before executing high-impact architecture changes or major database migrations, the coordinator invokes `palabre ask` to gather independent evaluations.
- **Contradictory Verification**: Critical security and RLS policies are submitted to a 2-agent debate to detect hidden edge cases and race conditions.
