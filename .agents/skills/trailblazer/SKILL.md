---
name: trailblazer
description: Project planning, task dependency graphing, roadmap navigation, and phased execution milestone tracking CLI.
---

# Trailblazer Project Planning Runbook

## Overview

Trailblazer provides structured task planning, dependency visualization, and phased milestone management across complex multi-wave engineering projects.

---

## 1. Core Planning Workflows

| Capability                     | Command / Protocol                          | Description                                          |
| :----------------------------- | :------------------------------------------ | :--------------------------------------------------- |
| `trailblazer plan <task-file>` | Parse tasks and compile dependency tree     | Validates wave prerequisites before implementation   |
| `trailblazer graph`            | Visualize task blockages and critical paths | Identifies parallelizable execution tracks           |
| `trailblazer status`           | Track wave milestone completion percentages | Emits progress telemetry for autonomous coordinators |

---

## 2. Agent Workflow Integration

- **Phased Wave Verification**: Coordinators consult Trailblazer dependency graphs to schedule parallel subagent waves safely.
