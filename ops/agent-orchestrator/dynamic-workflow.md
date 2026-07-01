# Dynamic workflow template (Opus 4.8 / Fable 5 pattern)

Use for **high** effort tasks (`classify-effort.py` → `tier: high`).

## 1. Plan (parent — write to HOW.md)

```markdown
## Workflow: <objective>
| Lane | Owner | Scope | Verify |
|------|-------|-------|--------|
| A | parent / subagent | ... | ... |
| B | subagent | ... | ... |
```

- Decompose into **independent lanes** only (max depth = 1 subagents).
- Each lane has a concrete deliverable and verify command.
- Fable pattern: plan spans stages; each stage has a success bar (tests, lint, RLS).

## 2. Execute (parallel where possible)

| Pattern | Source model | Rule |
|---------|--------------|------|
| Parallel lanes | Opus 4.8 Dynamic Workflows | `Task` with `run_in_background: true` when lanes don't share write targets |
| Parallel reads | GPT-5.5 | Batch independent `Grep`/`Read` in one turn |
| Lean capability | Our lending library | Checkout skill per lane → return after lane |

## 3. Synthesize (parent)

- Merge subagent summaries only (paths + errors + decisions).
- Resolve conflicts before any commit.
- Update `HOW.md` checklist `[x]` per lane.

## 4. Verify gate (mandatory — Fable “tests own work”)

```bash
bash 03_operations_automation/agent-orchestrator/verify-gate.sh
```

## 5. Consensus review (high-stakes only — Grok 4.20 debate pattern)

When touch: `migrations/`, `auth`, `RLS`, `employees`, payments, public API:

- Spawn `ce-adversarial-reviewer` or `ce-security-reviewer` (readonly) on branch diff.
- Parent must address **valid** findings before ship.
- Contrarian pass: “what would make this fail in production?”

## 6. Report

- ≤8 lines: what shipped, verify results, open blockers.
- `/summarize` runs full wrap-up protocol on top.
