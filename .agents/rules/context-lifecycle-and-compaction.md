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

Every agent turn MUST strictly follow this two-phase lifecycle across all conversations and tasks:

## Phase 1: Context-First Gate (Pre-Action — After User Sends Message)

**CRITICAL INVARIANT: DO NOT perform any mutating action, file edit, command execution, or implementation WITHOUT first gathering the required context.**

Immediately upon receiving a user message:

1. **Assess Required Context**: Identify all unknown files, schemas, configurations, external documentation, or ambiguous user requirements needed to complete the task safely and accurately.
2. **Gather Required Context (All Approved Channels)**:
   - **Codebase Exploration**: Inspect relevant files, AST symbols (`ast-grep`, `ripgrep`), directory structures, and git state (`view_file`, `find_by_name`, `grep_search`).
   - **Research**: Query documentation, skills (`skills-mcp` `acquire_skill` / `acquire_context`), memory bases, or web sources (`search_web`, `read_url_content`).
   - **Prompting User**: If requirements, intent, or design trade-offs are underspecified or ambiguous, prompt the user for clarification (`ask_question` or direct text response) before acting.
3. **Gate Check**: Verify that all required context is gathered and verified in context. Never guess, assume, or act prematurely.
4. **Proceed With Task**: Only after the required context is fully gathered may you proceed with executing the task (editing files, running commands, verifying gates).

## Phase 2: Post-Output Auto-Compaction & Context Readiness (After Each Output)

**CRITICAL INVARIANT: After each output produced, ready the context window for the next task.**

Before and upon concluding every turn / output:

1. **Release Leased Context & Skills**:
   - Return any dynamically leased skills (`return_skill`) or context slices (`release_context`) via `skills-mcp` so they do not bloat subsequent turns.
2. **Prune & Debloat Workspace Context**:
   - Ensure transient scratch data is stored in artifacts/scratch rather than dumped into conversation history.
   - When operating in `Arch-System`, keep token budgets clean (`pnpm token:budget-check` / `pnpm context:debloat` when thresholds are approached).
3. **Compact & Hand Off Clean State**:
   - Keep final output concise, structured, and self-contained (summarize state changes, file links, and verification results clearly) so the conversation state is compact.
   - Recommend or trigger `/compact` whenever the conversation trajectory has accumulated heavy exploration or multi-step logs, ensuring the context window is clean and ready for the user's next message.
