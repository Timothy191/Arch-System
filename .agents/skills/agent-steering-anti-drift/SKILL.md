---
name: agent-steering-anti-drift
description: Systematically injects advisor and steering content to prevent agentic drift, enforce architectural safeguards, and maintain quality gates during long-running tasks.
---

# Agent Steering and Anti-Drift Runbook

## Overview

"Agentic drift" occurs when an autonomous agent slowly deviates from its intended goal, loses context, or bypasses standard operating procedures over time. This skill acts as a steering framework and quality gate checklist to maintain alignment during complex, multi-phase execution loops (e.g., `ralph-loop`).

---

## 1. Architectural Safeguards (The "Harness")

Agents must operate within defined boundaries to prevent compounding errors:

- **Decouple Execution & Control**: Maintain clear separation between the agent generating plans and the environment where code executes.
- **Fail-Fast Enforcement**: Do not silently swallow or bypass linter, compiler, or type-checker errors. A failure must trigger a rollback, stash, or explicit escalation.
- **Strict Scoping**: Limit tool and environment scope per task (e.g., only `git add` files explicitly modified by the current step).

---

## 2. Multi-Layered Quality Gates

Before committing any complex work unit, pass through these gates:

1. **Automated Gates**: All local tests (`pnpm test`), linters, and type checks must pass on the modified files.
2. **Evaluation Gates**: For high-impact architectural changes, use a "critic" subagent or run the `self-reflection-loop` skill to review the proposed code before merging.
3. **Context Reset Gates**: Never carry polluted context into a new discrete task. Write a handoff note and start a clean session (`/clear` equivalent logic).

---

## 3. Observability and Auditing

- **Reasoning Logs**: Document the "thought process" for major decisions in a persistent artifact (e.g., `walkthrough.md` or a local `.status` file).
- **Tool Traces**: Ensure that all destructive tool calls (file edits, bash commands) are logged and reversible (via Git or backups).

---

## 4. Steering Triggers

Invoke this skill proactively when:

- An agent seems to be "looping" on the same error more than twice.
- The task spans multiple files and sub-domains, increasing the risk of scope creep.
- You are setting up a new long-running orchestrator agent and need to inject guardrails.
