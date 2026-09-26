---
name: ce-compound
description: Unified Hands-Off Compound Engineering & Swarming Pipeline Runbook
version: 1.0.0
---

# Unified Compound Engineering & Swarming Pipeline (ce-compound / LFG)

## 1. Overview

The `ce-compound` skill consolidates the entire 7-phase compound engineering lifecycle into a single hands-off execution command:
`Research` -> `Plan (ce-plan)` -> `Route & Swarm` -> `Work (ce-work)` -> `Simplify (ce-simplify)` -> `Review (ce-code-review)` -> `Verify & Ship`.

---

## 2. Standard Operational Procedure

### Single-Command Execution

To run the complete hands-off pipeline on any task or prompt:

```bash
pnpm ce:lfg "<task_description>"
```

Or directly via node:

```bash
node tools/scripts/unified-compound-flow.cjs "<task_description>"
```

### 7-Phase Execution Breakdown

1. **Phase 1 (Research & Context)**: Scans `.memory_base/index.json` and loads relevant architectural context.
2. **Phase 2 (Spec Breakdown - `ce-plan`)**: Invokes `spec-breakdown-engine.cjs`, generates `temp/` EARS specs and evaluates Real-World Quality Score ($\ge 90/100$).
3. **Phase 3 (Swarm Routing)**: Invokes `auto-dispatch-router.cjs`, provisions required domain specialists and grants CLI permissions.
4. **Phase 4 (Autonomous Implementation - `ce-work`)**: Executes tasks across waves using `ralph-loop` for atomic single-job iterations.
5. **Phase 5 (AST Simplification & Cleanliness - `ce-simplify`)**: Audits file limits (<450 lines) and validates AST command safety.
6. **Phase 6 (Dual-Mind Review - `ce-code-review`)**: Validates changes against EARS criteria, security policies, and UI invariants.
7. **Phase 7 (Verification & Shipping Gate)**: Synchronizes memory base index, executes watchdog ticks, and records events to `.a2a/bus/event-log.jsonl`.
