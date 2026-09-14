---
description: "Autonomous capability self-building, immutable error memory base, and lifecycle ephemeral cleanup"
paths: ["**/*"]
---

# Autonomous Capability Self-Building & Error Memory Base

## 1. Autonomous Capability Provisioning

- When a required tool, subagent, or test harness is missing during execution, agents MUST autonomously author, validate, and register the capability without pausing for manual creation.
- Once created, the capability is permanently registered in `.agents/` and `.a2a/`.

## 2. Immutable Error Memory Base (`.memory_base/`)

- All runtime exceptions, broken mocks, RLS policy failures, or test failures encountered during execution must be logged in `.memory_base/retrospectives/`.
- Every retrospective entry records:
  - Timestamp & Task ID
  - Error Signature / Regex
  - Root Cause Analysis
  - Corrective Fix Pattern & Prevention Strategy
- During pre-flight analysis, agents query `.memory_base/` to avoid repeating previous failure modes.

## 3. Zero Error Suppression Mandate

- Never suppress, comment out, or silence pre-existing errors or broken tests to force quality checks to pass.
- Identify the root cause, fix the defect cleanly, and resume the task loop.

## 4. Lifecycle Ephemeral Cleanup

- Before terminating a task or emitting the completion token, agents MUST clean up scratch debug files, temporary mock scripts, and ad-hoc dumps.
- Permanent task outcomes and diffs must be logged to `archive/tracers/log/` and indexed in `archive/tracers/README.md`.
