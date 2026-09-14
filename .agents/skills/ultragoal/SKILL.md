---
name: ultragoal
description: Autonomous Spec-Driven Goal Execution, Swarming, and Lifecycle Hooks Runbook
version: 1.0.0
---

# UltraGoal Autonomous Execution & Swarming Skill

## 1. Overview

The `ultragoal` skill orchestrates end-to-end autonomous task execution, from prompt ingestion to spec breakdown, swarm dispatching, tool permissioning, quality verification, and tracer archival.

---

## 2. Standard Operational Procedure

### Phase 1: Ingestion & Spec Decomposition

1. Run the spec breakdown engine on the user goal:
   ```bash
   node tools/scripts/spec-breakdown-engine.cjs "<user_prompt>"
   ```
2. Verify that `temp/outline.md`, `temp/requirements.md` (EARS notation), `temp/design.md`, and `temp/tasks.md` are populated.
3. Confirm that the Real-World Quality Score is $\ge 90/100$.

### Phase 2: Swarm Routing & Auto-Dispatch

1. Generate the dispatch plan:
   ```bash
   node tools/scripts/auto-dispatch-router.cjs "<user_prompt>"
   ```
2. Identify assigned specialist agents, model tiers (`inherit`, `flash`, `pro`), and allowed tools (`ralph`, `check-compound-bash`, `metabase`, `openspec`, `dexter`, etc.).

### Phase 3: Autonomous Execution & Safe Iteration

1. For atomic code changes, invoke `ralph` to execute single-job iterations:
   ```bash
   ralph run "<task_description>"
   ```
2. Ensure all compound commands pass AST safety check:
   ```bash
   node tools/scripts/check-compound-bash.cjs "<compound_command>"
   ```

### Phase 4: Quality Gate & Verification

1. Run monorepo quality gate:
   ```bash
   pnpm quality
   ```
2. If tests fail, trigger automatic rollback and self-healing reflection (maximum 2 repair attempts).

### Phase 5: Tracer Archival & Memory Sync

1. Log task tracer in `archive/tracers/log/--task-XXX-<slug>.md`.
2. Update task counter in `archive/tracers/README.md`.
3. Synchronize memory base:
   ```bash
   node tools/scripts/smart-indexer.cjs
   ```
