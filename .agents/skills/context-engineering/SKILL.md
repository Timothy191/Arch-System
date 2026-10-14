---
name: context-engineering
description: Operational protocol for preflight context gathering, tool-output offloading, anchored iterative compaction (save-before-compact), and context degradation mitigation. Use before starting non-trivial actions or before compacting/handing off long-running sessions.
---

# Context Engineering: Preflight Gathering & Compaction Protocol

This skill operationalizes the **Context-First Execution & Auto-Compaction Mandate** ([`context-lifecycle-and-compaction.md`](file:///home/tim/Fork/.agents/rules/context-lifecycle-and-compaction.md)) with battle-tested patterns from industry context-engineering frameworks (`Agent-Skills-for-Context-Engineering`, `save-before-compact`, and `skills-mcp`).

> **Core Optimization Target**: Optimize for **Tokens-Per-Task** (total tokens consumed from start to finish, including re-fetching and error-correction costs), never merely _Tokens-Per-Request_. Over-aggressive or unstructured compaction that forces an agent to re-read 10 files wastes more context than it saves.

---

## Phase 1: Preflight Context Gathering (Before Starting Action)

Before executing any file mutation, architectural decision, or build/deployment command, execute this 4-step **Funnel & Triage Protocol**:

### 1. Deterministic Environment & Budget Triage

Verify workspace alignment before probing files blindly:

- **Package Manager & Node Alignment**: Ensure `PATH` includes Mise Node (`v24.15.0` / `v26.8.1`). Respect directory boundaries (`pnpm 9.15.9` in `Arch-System/`, `npm` in `arch-system-nest-proxy/`).
- **Context Budget Health**: When working in `Arch-System/`, verify budget headroom via `pnpm token:budget-check` (or `.agents/hooks/pre-task-budget-check.cjs`).
- **Active Lease Check**: Call `skills-mcp` `get_active_leases` to inspect currently leased skills/contexts and release any stale cross-task leases.

### 2. Progressive Disclosure Funnel (Broad → Narrow)

Never `cat` or `view_file` whole large files during initial discovery. Gather context in strict order of token efficiency:

1. **Catalog & Memory Index (~50–200 tokens)**:
   - Query `skills-mcp` (`list_available_context`, `list_available_skills`) and `.agents/memory_base/index.json` for prior incident signatures and domain invariants.
2. **Ephemeral Slice Leasing (~500–1,500 tokens)**:
   - Lease only the target project/domain slice via `acquire_context` or `acquire_skill` (or `assemble_context_pack`).
3. **Structural & AST Search (~200–800 tokens)**:
   - Use `ast-grep` (`sg`) or `ripgrep` (`rg`) to locate exact symbols, signatures, and call sites.
4. **Surgical File Slice Reading**:
   - Use `view_file` with explicit `StartLine` and `EndLine` ranges around the target AST nodes.

### 3. Attention U-Curve Placement & Poisoning Guard

- **Defeat Lost-in-the-Middle**: Models exhibit U-shaped attention curves (10–40% lower recall in middle tokens). Surface critical constraints, file paths, and success predicates at the **very beginning** (system/lease header) or **very end** (STM-0 Phase 5 Execution Contract) of your preflight block.
- **Circuit-Breaker for Context Poisoning**: If a previous tool output or assumption is proved false by empirical verification (`E2`/`E3`), explicitly mark it `[POISONED / SUPERSEDED]` or truncate/compact before proceeding so downstream reasoning does not self-reference it.
- **Clarify Ambiguity Early**: If user requirements have underspecified edge cases, use `ask_question` during preflight before writing code.

---

## Phase 2: In-Flight Observation Masking & Scratchpad Offloading

Tool outputs account for **80%+ of context window bloat** in coding trajectories.

1. **Filesystem Offloading (`> 2,000` chars)**:
   - Redirect verbose command outputs, log dumps, or multi-file diffs to `<appDataDir>/brain/<conversation-id>/scratch/<tool>_<timestamp>.txt` (or `.agents/scratch/`).
   - Keep only a compact `[ObsRef]` summary in active context:
     `[ObsRef: scratch/build_log.txt | Key: 2 TS errors in auth.ts:L42,L88]`.
2. **Recency-Based Observation Masking**:
   - **Never mask**: The most recent turn's output, active error traces being debugged, or the pinned task specification.
   - **Mask after 3+ turns**: Once findings from an exploratory search or file read are synthesized into your STM-0 Evidence block, rely on the synthesized notes rather than repeating raw outputs.

---

## Phase 3: Pre-Compaction & Post-Output Lifecycle (`Save-Before-Compact`)

Default conversation compaction is lossy: it remembers _what_ was discussed while dropping _exact file paths, symbol names, rejected alternatives, and active leases_ ("Artifact Trail Amnesia").

### 1. Lease Hygiene & Knowledge Compounding

Before concluding a turn or triggering `/compact`:

- Call `skills-mcp` `return_skill` (including `summary` and `learnings`) and `release_context` for all completed subtask leases.
- For major architectural shifts or bug fixes, invoke the `autonomous-memory` skill (`memory_crawler` subagent) or update `.agents/memory_base/index.json` + `sync-vector-memory.mjs`.

### 2. Anchored Iterative Summarization (`HANDOFF.md` / `RESUME.md`)

When a session exceeds ~70% context utilization, spans multiple complex phases, or prepares for `/compact`:

- **Never regenerate summaries wholesale from scratch** (which causes cumulative detail drift). Merge newly completed work into an anchored, structured handoff artifact (`<appDataDir>/brain/<conversation-id>/HANDOFF.md` or `.agents/scratch/RESUME.md`).
- Every compaction summary MUST populate this mandatory 6-section checklist to preserve the **Artifact Trail**:

```markdown
# Session Handoff & Compaction State

## 1. Session Intent & Success Predicate

- **Goal**: [Exact user objective and verification criteria]
- **Non-Counting Outcomes**: [What partial states do NOT count as done]

## 2. Artifact Trail (Files & Symbols)

- **Created**: [`path/to/new.ts`](file:///abs/path/to/new.ts) — [Purpose]
- **Modified**: [`path/to/edit.ts`](file:///abs/path/to/edit.ts) (`fnName`, `L10-L45`) — [What changed & why]
- **Read-Only Inspected**: [`path/to/ref.ts`](file:///abs/path/to/ref.ts) — [Key invariant discovered]

## 3. Key Decisions & Rejected Alternatives

- **Selected**: [Approach A] because [Evidence E2/E3]
- **Rejected**: [Approach B] because [Constraint/Failure signature]

## 4. Verification & Evidence Ledger (E0–E4)

- `pnpm type-check`: PASS (E2)
- `pnpm agent:verify`: [Status / Exact error output if failing]

## 5. Active Leases & External Scratch Refs

- **Leased Skills/Context**: [None / Released / Active IDs]
- **Scratch Logs**: [Paths to offloaded logs or plans]

## 6. Immediate Next Actions (Post-Compaction)

1. [Exact next command or file edit]
2. [Verification gate to run]
```

### 3. Functional Probe Check (Self-Audit Before `/compact`)

Before recommending `/compact` to the user, verify your handoff state against three functional probes:

- _Artifact Probe_: Can a fresh agent resuming from this summary know every modified file path and function name without running `git status`?
- _Decision Probe_: Does the summary state _why_ rejected approaches failed so the next turn does not repeat them?
- _Continuation Probe_: Is the exact next verification command stated explicitly?
