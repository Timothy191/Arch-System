---
name: auto-approve-compound-bash
description: AST-based compound Bash command safety parser, subshell verification, and rule-driven auto-approval engine.
---

# Auto-Approve Compound Bash Runbook (`auto-approve-compound-bash@damusix-ai-tools`)

## Overview

`auto-approve-compound-bash` (cc-auto-approve-fix) uses native shell AST parsing to split and validate compound command segments (`&&`, `||`, `;`, `|`, subshells) against strict allow/deny safety policies.

---

## 1. Core Commands & Workflows

| Capability                              | Command            | Description                                                               |
| :-------------------------------------- | :----------------- | :------------------------------------------------------------------------ |
| `check-compound-bash "<cmd>"`           | CLI Validator      | Splits command into segments and checks against dangerous system patterns |
| `check-compound-bash "<cmd>" --explain` | Explanatory Output | Returns detailed AST segmentation and risk analysis                       |
| `Pre-Tool Hook`                         | Automatic Guard    | Intercepts terminal tool executions to auto-approve safe compound chains  |

---

## 2. Agent Workflow Integration

- **Zero-Friction Tool Execution**: Safely combines test, build, and git operations (e.g. `pnpm build && pnpm test`) without tripping interactive confirmation roadblocks while strictly blocking destructive operations.
