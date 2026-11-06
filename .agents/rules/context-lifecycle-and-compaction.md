---
name: context-lifecycle-and-compaction
description: Enforces context-first execution (gather context via research, user prompting, or codebase exploration before any action) and automatic post-output context compaction.
globs: ['**/*']
paths:
  - '**/*'
alwaysApply: true
trigger: always_on
---

# Context-First Execution & Auto-Compaction

Every turn MUST follow this lifecycle. Details: [`context-engineering`](file:///home/tim/Fork/.agents/skills/context-engineering/SKILL.md) skill.

## Phase 1: Context-First Gate

**No mutating action, edit, or command before gathering required context.**

1. **Preflight**: Mise Node `v24.15.0`/`v26.8.1`, `pnpm 9.15.9` in `Arch-System/`; `pnpm token:budget-check`; `get_active_leases`. Budget via `pnpm token:task-budget "<prompt>" --files <N> --steps <M>` (`trivial`/`low`: `3.5k–8k`, `<=1` skill; `moderate`: `22k`, `<=2`; `high`/`extreme`: `52k–104k`, `<=3–4` + subagents). On failure: `pnpm context:debloat` / `pnpm token:prune`.
2. **Funnel**: `list_available_context`/`list_available_skills` + `.agents/memory_base/index.json` → `acquire_context`/`acquire_skill` → `sg`/`rg` → line-range reads → ask user if ambiguous.
3. **Guards**: Invariants at start and end of context (STM-0 Phase 5). Mark claims disproven by `E2`/`E3` as `[POISONED / SUPERSEDED]`.
4. Proceed only once context is verified.

## Phase 2: Post-Output Readiness (optimize Tokens-Per-Task)

1. `return_skill` (with `summary`, `learnings`) / `release_context`.
2. Offload outputs `> 2,000` chars to `<appDataDir>/brain/<conversation-id>/scratch/`, keep `[ObsRef]`.
3. Before `/compact` or >75% utilization: write `HANDOFF.md`/`RESUME.md` with the 6-section Artifact Trail (Intent, Artifact Trail, Decisions & Rejected Alternatives, Verification Ledger E0–E4, Active Leases, Next Actions). Keep output concise.

## Compaction Memory Mandate

Any agent that compacts MUST, before concluding:

1. Write `.agents/memory_base/retrospectives/<id>.json` per `.agents/memory_base/schema.json` (id, timestamp, taskTag, category, errorSignature, affectedFiles, rootCause, resolution, preventionRule).
2. `pnpm memory:index`.
3. Verify: `node tools/scripts/smart-indexer.cjs --query "<keyword>"`.
4. Never discard a compaction without a persisted entry.
