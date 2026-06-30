# Arch-Systems Workspace Rules & Agentic Protocols

This file overrides/augments the base rules for the Arch-Systems monorepo to align the agent's behavior with the repository's internal tools and memory systems.

---

## 1. Adaptive Agentic Mode & Effort Triage

Operate as a **functional, adaptive orchestrator** with minimal fixed context. Capabilities (skills, tools) should be loaded only when the task requires them, and returned immediately after use.

### turn start triage (every turn)
Before executing any non-trivial user request, run:
```bash
python3 03_operations_automation/agent-orchestrator/classify-effort.py "<user message>"
```

### effort tiers:
- **Low**: Direct execution; `rg` → slice read. No planning in `HOW.md`.
- **Medium**: Write a checklist plan in `HOW.md`. Scoped verify of touched paths.
- **High**: Full dynamic workflow with `HOW.md`, parallel subagents, consensus review, and `verify-gate.sh` check.

---

## 2. Cognitive Loops & Lending Library

Always use internal reasoning before code changes or terminal execution. Do not echo internal `<thinking>` or `<correction>` blocks to the user.

### lending library checkout-return flow
Do not keep custom skills or tool documentation in context across steps. Use checkout -> execute -> return:
1. **Select**: Run `python3 03_operations_automation/lending-library/list-catalog.py` to see available capabilities.
2. **Checkout**:
   - For skills: `python3 03_operations_automation/lending-library/checkout-skill.py <name>`
   - For tools: `python3 03_operations_automation/lending-library/checkout-tool.py <name>`
3. **Read**: Read the checked-out skill instruction or tool documentation.
4. **Execute**: Perform the task with that capability.
5. **Return**: Always run `python3 03_operations_automation/lending-library/return-skill.py <name>` or `return-tool.py <name>` when finished, even if the execution fails.

---

## 3. Sub-Agent Delegation & Parallel Execution

Spawn subagents (using `invoke_subagent` tool) only when parallel tasks or broad code exploration would flood the primary context window.
- **Depth Limit**: Subagents must not spawn further subagents (max depth = 1).
- **Batching**: You may batch independent read actions (e.g. parallel `grep_search` or `view_file` calls) or disjoint `Task` subagents within a single turn. Never batch parallel writes to the same file.
- **Returns**: Subagents must return only summaries, paths, and error codes; do not paste full subagent logs.

---

## 4. Context Compaction & Summarization

To prevent context window bloat, the system uses a compaction loop.
- **Compaction Threshold**: Every **10** user messages, check if compaction is pending.
- **Manual Summary**: When the user requests `/summarize`, execute the full **Wrap-up Protocol**:
  1. Complete all open `HOW.md` items.
  2. Run verification gates (`pnpm quality`, `verify-gate.sh`, and `audit:rls` if database was modified).
  3. Commit changes (conventional commits), push to origin, and create a Pull Request with `gh pr create` if requested.
  4. Write `.ai_content/.memory/.cursor-memory/.compact-staging.md`.
  5. Update `.ai_content/.memory/.cursor-memory/active-context.md` and reset working memory.

---

## 5. Domain, Design & Production Constraints

### strict production realism
- No placeholder content (`foo`, `bar`, `Lorem ipsum`, fake metrics).
- Use realistic mining terminology (shift logs, machine hours, hourly loads, breakdowns).
- If database/API schemas are unknown, halt and ask the user. Do not guess.

### aesthetic directive
- **Light Theme Only**: White/glass surfaces Sonoma-style. No dark mode, no cyber/terminal aesthetics.
- **Design Tokens**: OKLCH tokens from `@repo/theme` only. Use `cn()` from `@repo/ui/lib/utils` for tailwind class merges.
- Use `shadow-card`, `shadow-window`, or `shadow-diffusion-*` instead of raw CSS shadows.

---

## 6. Git & GitHub Pipeline

- Always branch per task (e.g. `feat/02-fleet-sync-queue`) based on `HOW.md`. Never push directly to `master`.
- Run formatting and quality checks before staging (`pnpm format`, local lint/type-check, unit tests).
- Commits must use conventional formats. Git push and `gh pr create` should be run on user request.

---

## 7. Turn Close Verification (Mandatory for Every Turn with Changes)

Before concluding any turn where you edit code, run checks, checkout library skills, or call subagents, you **must** run:
```bash
python3 03_operations_automation/agent-orchestrator/turn-close-status.py
```
Append the Markdown output of this command to the end of your final reply to report:
- **Adaptive mode status** (tier, clean/dirty staging).
- **Intelligence gain %** (checklist + learnings + verification status).
- **Capabilities list** (skills and tools checked out, used, and returned).
