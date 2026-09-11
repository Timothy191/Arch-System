# Local-First Loop Engineering Specification

> **Synthesis of Omnius (`dhruvil009/Omnius`), Agentic Loops (`brandondocusen/agentic-loops`), and Agentic AI Engineering (`agenticloops-ai/agentic-ai-engineering`)**.

---

## 1. Loop Engineering vs. Prompt Engineering

| Dimension | Prompt Engineering | Loop Engineering |
| :--- | :--- | :--- |
| **Scope** | Single inference or conversation turn | Recurring, multi-turn autonomous system |
| **State** | Ephemeral context window | Persistent git-committed state & checkpoint files |
| **Reliability** | Probabilistic prompt coaxing | Deterministic verification gates & test assertions |
| **Failure Mode** | Hallucinations or silent degradation | Automatic rollback, step cap enforcement, escalation |
| **Execution** | Manual interaction | Local-first autonomous loops (`cron`, `launchd`, CLI) |

---

## 2. The 4 Core Pillars of Agentic Loops

### Pillar 1: Measurable Goals & Stopping Invariants
- An agent must NEVER be launched with an open-ended directive.
- Every run defines an unambiguous termination predicate (e.g. `pnpm type-check passes && all unit tests green`).
- If the goal is not met within the bounded budget (`max_steps`), the loop halts cleanly with status `BLOCKED`.

### Pillar 2: Persistent State & Worktree Isolation
- Avoid direct modification of primary active branches.
- Use isolated git worktrees (`.agents/worktrees/<loop-id>`) created via `git worktree add`.
- Checkpoints are saved to disk (`state.json`), enabling cold session resume without losing progress.

### Pillar 3: Verification Gates (The Checker)
- Separation of Maker (LLM generating code) and Checker (deterministic test runner).
- The loop executes automated gates after each transformation:
  1. TypeScript strict compilation (`pnpm type-check`).
  2. Test suite assertions (`pnpm test`).
  3. Linter & boundary validations (`pnpm lint`, `pnpm policy:check`).

### Pillar 4: Guardrails, Budgets & Safe Rollback
- **Turn Cap**: Hard limit between 5 and 15 turns per run.
- **Path Sandboxing**: Pre-tool hooks block destructive operations on system configurations.
- **Rollback Protocol**: If verification gates fail after 2 corrective iterations, run `git checkout -- .` to restore baseline state before notifying the user.

---

## 3. The 5-Phase Omnius Lifecycle

```
[ 1. COLLECT ] -> [ 2. PLAN ] -> [ 3. DISPATCH ] -> [ 4. VERIFY ] -> [ 5. REVIEW ]
      |                                                      |              |
      v                                                      v              v
 Scan backlog /         Bound steps,           Run isolated     Test gates,    Human pull request
 user prompts           worktree path          agent worktree   lint checks    diff summary
```

1. **COLLECT**: Pull pending tasks from backlog or CLI prompt.
2. **PLAN**: Generate bounded `state.json` defining goal, runner, and verification commands.
3. **DISPATCH**: Spin up `.agents/worktrees/<loop-id>` and trigger local agent.
4. **VERIFY**: Run verification commands inside worktree.
5. **REVIEW**: Generate human review summary, merge if green, or safely revert on failure.
