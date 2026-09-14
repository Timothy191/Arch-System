---
name: fresh-cli
description: Automated file watching, continuous recompilation, and live hot-reloading tool for local development workflows.
---

# Fresh CLI Operational Runbook

## Overview

Fresh CLI (`@fresh-editor/fresh-editor` / `fresh`) monitors filesystem events across target directories and automatically executes predefined build, test, or reload commands on changes.

---

## 1. Core Workflows

| Capability                         | Command                                            | Description                                                           |
| :--------------------------------- | :------------------------------------------------- | :-------------------------------------------------------------------- |
| `fresh watch <dir> --exec "<cmd>"` | Watch directory and execute command on file write  | `fresh watch apps/portal --exec "pnpm --filter portal type-check"`    |
| `fresh test`                       | Continuously execute co-located unit tests on save | `fresh watch libs/features --exec "pnpm test"`                        |
| `fresh build`                      | Hot-recompile tokens or schemas on modification    | `fresh watch packages/theme --exec "pnpm --filter @repo/theme build"` |

---

## 2. Agent Workflow Integration

- **Live Test Feedback Loop**: Agents spawn background watch processes to obtain instant feedback when refactoring complex modules.
