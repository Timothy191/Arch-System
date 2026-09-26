---
name: ai-memory
description: Local-first long-term cross-session memory management, observation synthesis, and semantic knowledge retrieval.
---

# AI Memory Plugin Runbook (`ai-memory@damusix-ai-tools`)

## Overview

`ai-memory` provides local-first cross-session memory across Claude Code, Antigravity, and autonomous subagent sessions. It captures observations, synthesizes reusable knowledge, and exposes fast retrieval interfaces.

---

## 1. Core Capabilities

| Capability                | Command / Protocol | Description                                                                  |
| :------------------------ | :----------------- | :--------------------------------------------------------------------------- |
| `/remember <observation>` | Slash Command      | Explicitly persist architectural decision or constraint into long-term store |
| `/forget <id>`            | Slash Command      | Deprecate stale or invalidated memory entries                                |
| `smart-indexer query`     | CLI Auto-Recall    | Search indexed retrospectives across `.memory_base/`                         |
| `MCP Memory Tools`        | MCP Tools          | Structured graph entity creation and semantic relation tracing               |

---

## 2. Agent Workflow Integration

- **Pre-Task Recall**: Agents query active memory graphs before starting multi-file refactoring to adhere to established codebase conventions.
