---
name: ralph-loop
description: Autonomous iterative coding loop driver splitting large tasks into single-job, single-commit cycles with fresh agent contexts and quality gate rollbacks.
---

# Ralph Loop Autonomous Iteration Runbook

## Overview

`ralph-loop` drives AI agents through focused, iterative development cycles. Each cycle is atomic (one job, one commit, one status update), executes in a clean context window, and stashes broken work upon quality gate failure.

---

## 1. Core Commands

| Command                   | Action                     | Description                                                      |
| :------------------------ | :------------------------- | :--------------------------------------------------------------- |
| `ralph init`              | Initialize Ralph Workspace | Sets up `.ralphrc.json` with quality gate definitions            |
| `ralph run "<job-desc>"`  | Execute Atomic Iteration   | Runs single task cycle with fresh session and auto-commit        |
| `ralph loop <n> "<goal>"` | Multi-Cycle Loop           | Runs $n$ consecutive development cycles bounded by quality gates |

---

## 2. Agent Workflow Integration

- **Context-Bound Refactoring**: Complex multi-file refactoring runs in Ralph loops to prevent context bloat and hallucination accumulation.
