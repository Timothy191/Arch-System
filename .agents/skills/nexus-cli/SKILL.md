---
name: nexus-cli
description: Autonomous project management, dependency synchronization, scaffolding, and build orchestration utilizing Nexus CLI.
---

# Nexus CLI Operational Runbook

## Overview

Nexus CLI streamlines multi-package development workflows across the Arch-System monorepo with zero external API overhead. It provides automated scaffolding, dependency auditing, and build orchestration.

---

## 1. Command Reference

| Command                        | Action                                                                 | Example                                  |
| :----------------------------- | :--------------------------------------------------------------------- | :--------------------------------------- |
| `nexus scaffold <type> <name>` | Generate package or feature scaffolding aligned with `policy-compiler` | `nexus scaffold package @repo/analytics` |
| `nexus audit`                  | Run full dependency, boundary, and build audit                         | `nexus audit --json`                     |
| `nexus build [target]`         | Orchestrate Turborepo build pipeline                                   | `nexus build portal`                     |
| `nexus deps <action>`          | Synchronize and lint workspace catalog dependencies                    | `nexus deps sync`                        |
| `nexus tui`                    | Launch interactive development terminal console                        | `nexus tui`                              |

---

## 2. Agent Workflow Integration

- **Pre-Scaffold Verification**: Run `nexus audit` to assert clean workspace catalog boundaries before introducing new modules.
- **Continuous Build Orchestration**: Subagents invoke `nexus build <target>` during iterative implementation loops to verify build outputs.
