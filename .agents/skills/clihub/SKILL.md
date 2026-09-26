---
name: clihub
description: CliHub registry manager for discovering, converting, packaging, and publishing CLI tools with structured agent hints and metadata.
---

# CliHub Registry Manager Runbook

## Overview

`clihub` converts installed CLI binaries into standardized `clihub.yaml` manifests equipped with agent hints (when to use, example usages, parameter definitions) and validates submissions for registry PRs.

---

## 1. Core Commands

| Command                    | Action                                                 | Example                     |
| :------------------------- | :----------------------------------------------------- | :-------------------------- |
| `clihub convert <binary>`  | Auto-detect binary metadata and generate `clihub.yaml` | `clihub convert jq`         |
| `clihub submit <manifest>` | Validate manifest and output PR-ready registry entry   | `clihub submit clihub.yaml` |
| `clihub search <query>`    | Discover agent-compatible CLI tools by keyword         | `clihub search "database"`  |
| `clihub install <tool>`    | Install discovered tools into agent runtime            | `clihub install ripgrep`    |

---

## 2. Agent Workflow Integration

- **Automated Tool Registration**: When agents build new standalone helpers in `~/.local/bin/`, they invoke `clihub convert` to generate standard tool metadata for the entire swarm.
