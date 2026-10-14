---
name: context-lifecycle-and-compaction
description: Enforces context-first execution (gather context via research, user prompting, or codebase exploration before any action) and automatic post-output context compaction.
globs: ['**/*']
paths:
  - '**/*'
alwaysApply: true
trigger: always_on
---

# Context-First Execution & Auto-Compaction Lifecycle Mandate

Every agent turn MUST strictly follow this two-phase lifecycle across all conversations and tasks. For full operational checklists, templates, and observation-masking protocols, invoke the [`context-engineering`](file:///home/tim/Fork/.agents/skills/context-engineering/SKILL.md) skill (`skill://context-engineering`).

## Phase 1: Context-First Gate (Pre-Action — After User Sends Message)

**CRITICAL INVARIANT: DO NOT perform any mutating action, file edit, command execution, or implementation WITHOUT first gathering the required context.**

Immediately upon receiving a user message:

1. **Deterministic Preflight & Budget Triage**:
   - Verify workspace toolchain alignment (Mise Node `v24.15.0`/`v26.8.1`, `pnpm 9.15.9` in `Arch-System/`), context budget health (`pnpm token:budget-check`), and active leases (`get_active_leases`).
2. **Gather Required Context via Progressive Disclosure Funnel (Broad → Narrow)**:
   - **Step 1 — Catalog & Memory Index**: Query `skills-mcp` (`list_available_context`, `list_available_skills`) and `.agents/memory_base/index.json` (~50–200 tokens).
   - **Step 2 — Ephemeral Leasing**: Lease only relevant slices via `acquire_context` / `acquire_skill`.
   - **Step 3 — Structural AST Search**: Locate exact symbols and call sites via `ast-grep` (`sg`) and `ripgrep` (`rg`) instead of reading whole files.
   - **Step 4 — Surgical File Slice Reading**: Read targeted line ranges (`view_file` with `StartLine`/`EndLine`).
   - **Step 5 — Prompting User**: If requirements, intent, or design trade-offs are underspecified or ambiguous, prompt the user for clarification (`ask_question` or direct text response) before acting.
3. **Attention U-Curve & Poisoning Guard**:
   - Place critical invariants and success predicates at the start and end of context (STM-0 Phase 5 Contract) to defeat _lost-in-the-middle_ degradation.
   - If empirical verification (`E2`/`E3`) disproves an earlier claim or tool output, explicitly mark it `[POISONED / SUPERSEDED]` so downstream reasoning never self-references it.
4. **Proceed With Task**: Only after the required context is fully gathered and verified in context may you proceed with executing the task.

## Phase 2: Post-Output Auto-Compaction & Context Readiness (After Each Output)

**CRITICAL INVARIANT: After each output produced, ready the context window for the next task. Optimize for Tokens-Per-Task (avoiding re-fetching costs), not just Tokens-Per-Request.**

Before and upon concluding every turn / output:

1. **Release Leased Context & Skills**:
   - Return any dynamically leased skills (`return_skill` with `summary` and `learnings`) or context slices (`release_context`) via `skills-mcp` so they do not bloat subsequent turns.
2. **Offload & Mask Verbose Observations**:
   - Offload tool outputs `> 2,000` characters to `<appDataDir>/brain/<conversation-id>/scratch/` and retain only compact `[ObsRef]` summaries in active context.
   - When operating in `Arch-System`, keep token budgets clean (`pnpm token:budget-check` / `pnpm context:debloat` when thresholds are approached).
3. **Save-Before-Compact & Anchored Iterative Summarization**:
   - Before recommending or triggering `/compact` (or when context utilization exceeds ~70%), flush volatile state into an anchored handoff artifact (`HANDOFF.md` / `RESUME.md`) using the 6-section **Artifact Trail Checklist** defined in [`context-engineering/SKILL.md`](file:///home/tim/Fork/.agents/skills/context-engineering/SKILL.md) (Session Intent, Artifact Trail with exact file paths & symbols, Key Decisions & Rejected Alternatives, Verification Ledger E0–E4, Active Leases, Immediate Next Actions).
   - Keep final output concise, structured, and self-contained so the conversation state is clean and ready for the user's next message.
