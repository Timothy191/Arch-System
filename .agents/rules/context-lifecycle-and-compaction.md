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
3. **Guards**: Invariants at start and end of context (STM-0 Phase 5). Mark claims disproven by `E2`/`E3` as `[POISONED / SUPERSEDED]`. Never re-read files tagged `[DO NOT RE-READ]` in `.handoff/handoff.md`.
4. Proceed only once context is verified.

## Phase 2: Post-Output Readiness & Two-Stage Compaction

1. `return_skill` (with `summary`, `learnings`) / `release_context`.
2. Offload outputs `> 2,000` chars to `<appDataDir>/brain/<conversation-id>/scratch/`, keep `[ObsRef]`, and preserve rare needles (`df <= 2`) + error lines via `extractRareNeedlesFromLog` / `slim-tooling-mcp`.
3. **Proactive Handoff (`>= 70%`) & `/compact` (`pnpm compact`)**: Persist `.handoff/handoff.{md,json}`, `<artifactDir>/HANDOFF.md`, and `.remember/now.md` with the 6-Section Artifact Trail and O(1) bounded `SKILL.state` JSON spine (`<= 4,000` chars).
4. **Double-Compaction Guard (`/compact/compact` / `pnpm compact:deep` / `< 25%` fill)**: Route through `consolidate_state_spine` (`evaluateDoubleCompactionGuard`) to consolidate on-disk state, deduplicate retrospectives, and prune logs without invalidating the warm LLM prefix cache (`94.7%` hit ratio).

## Compaction Memory Mandate

Any agent that compacts MUST, before concluding:

1. Run `pnpm compact` (or `pnpm compact:deep` for `/compact/compact`) to atomically persist `.handoff/handoff.{md,json}` and `.agents/memory_base/retrospectives/<id>.json`.
2. `pnpm memory:index`.
3. Verify: `node tools/scripts/smart-indexer.cjs --query "<keyword>"`.
4. Never discard a compaction without a persisted entry.
