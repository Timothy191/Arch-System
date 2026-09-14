---
name: metabase-cli
description: Headless CLI and programmatic Node.js toolkit for interacting with Metabase instances, managing queries, questions, dashboards, collections, snippets, and alerts.
---

# Metabase CLI Operational Runbook

## Overview

`metabase-cli` provides automated, terminal-based interaction with Metabase analytics instances. It enables autonomous agents to manage database queries, export visualization reports, synchronize collections, and automate dashboard provisioning.

---

## 1. Core CLI Commands

| Command                                  | Action                                              | Example                                                |
| :--------------------------------------- | :-------------------------------------------------- | :----------------------------------------------------- |
| `metabase profiles [list\|add\|use]`     | Manage instance authentication profiles             | `metabase profiles add plantcor-analytics`             |
| `metabase query <sql>`                   | Execute raw SQL against connected Metabase database | `metabase query "SELECT * FROM public.fleet LIMIT 10"` |
| `metabase questions <list\|get\|create>` | Manage saved questions and SQL models               | `metabase questions list`                              |
| `metabase dashboards <list\|export>`     | Export or update dashboard cards & layouts          | `metabase dashboards export 12`                        |
| `metabase collections <list\|sync>`      | Synchronize collection hierarchies                  | `metabase collections sync ./analytics/collections`    |
| `metabase alerts <list\|check>`          | Audit automated email and webhook alert rules       | `metabase alerts list`                                 |

---

## 2. Agent Workflow Integration

- **Telemetry Querying**: Agents query real-time Metabase aggregations during shift reconciliation audits.
- **Automated Dashboard Delivery**: Swarms generate and deploy executive reporting cards without manual UI clicking.
