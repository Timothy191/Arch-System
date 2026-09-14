---
name: dexter-cli
description: Autonomous financial intelligence, equipment OPEX/CAPEX variance modeling, and shift cost reconciliation for mining operations.
---

# Dexter Financial Intelligence Runbook

## Overview

Dexter CLI performs automated financial research, calculating OEE cost impacts, equipment maintenance cost projections, and shift profitability metrics with zero external API dependencies.

---

## 1. Core Commands

| Command                    | Action                                         | Example                          |
| :------------------------- | :--------------------------------------------- | :------------------------------- |
| `dexter analyze <domain>`  | Analyze cost and operational variance          | `dexter analyze fleet --json`    |
| `dexter kpi [department]`  | Calculate financial efficiency KPIs            | `dexter kpi drilling`            |
| `dexter report [shift-id]` | Compile shift financial reconciliation summary | `dexter report shift-20260914-A` |

---

## 2. Agent Workflow Integration

- **Executive Reporting**: Agents invoke `dexter analyze` during shift closeout audits to attach financial variance metrics to executive summaries.
