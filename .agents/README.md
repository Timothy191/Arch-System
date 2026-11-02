# Arch-CorpOS Agentic Governance & Win Loops

This directory (`.agents/`) contains the Agent Governance infrastructure and the Arch-CorpOS autonomous business loop runner (Win Loop implementation).

## 1. Agent Governance Hooks

Located in `.agents/hooks/`, these scripts guard subagent execution boundaries:

- `pre-invocation-inject.sh`: Injects context prior to agent boot.
- `pre-tool-guard.sh`: Prevents operations outside of designated scopes (e.g. restricts access to system files or destructive commands).
- `post-tool-tracer.sh`: Logs executed operations and metadata to `.agents/audit.log`.
- `worktree-guard.sh`: Ensures agents do not operate directly on protected branches (like `main`) without a clean git state or worktree isolation.

## 2. Arch-CorpOS Business Loops

Located in `.agents/corpos/` and `.agents/loops/`, this system implements the "Win Loop" architecture, a synthesis of `win.sh`, `CorpOS`, and `ai-company`.

### Key Components

- **corpos**: The central CLI binary (`.agents/corpos/bin/corpos`).
- **tick.sh**: The execution engine that ingests a signal, evaluates rules, outputs a strategic brief, invokes verification gates, captures artifacts, determines outcomes, logs to the append-only journal, and schedules the next run (`.agents/corpos/engine/tick.sh`).
- **corpos.config.json**: Defines the organizational departments and their authority ceilings.

### How to use

```bash
# Check system status
pnpm corpos status

# Trigger a manual tick (dry run)
pnpm corpos tick codebase-health --dry-run
```

For detailed specifications of the Win Loop engine, see `.agents/corpos/SPEC.md`.

---

## Agent Action Scoring System (Global Scope)

Every agent action taken in this repository is scored against a running tally that is global in scope — it accumulates across all agents, sessions, and tasks:

| Outcome           | Points | Criteria                                                                 |
| ----------------- | ------ | ------------------------------------------------------------------------ |
| Successful action | +1     | Task complete, all relevant gates pass, verified with evidence           |
| Wrong action      | -2     | Implementation incorrect, gate broken, change reverted, claim unverified |

The score is used to:

1. **Inform risk assessment** — higher-risk actions require more verification before execution
2. **Prioritize gate selection** — lower scores trigger the full verification suite (`pnpm agent:verify`)
3. **Guide escalation decisions** — negative scores require human review before proceeding

### Score Consequences

- **Score ≥ 0**: Normal operation — proceed with standard verification gates
- **Score < 0**: Escalate — require human review before next task execution
- **Score ≤ -5**: Mandatory full `pnpm agent:verify` (27-gate suite) before any further action

Agents must log each action's outcome and score in the session context before concluding work.

---

## Spec-Based Foundational Approach to Tasks

All non-trivial tasks (multi-file changes, new dependencies, schema/API changes, or behavioral changes) MUST follow a spec-based foundational approach:

### Phase 1 — Write the Spec

Before any code is written, produce a written spec covering:

1. **Objective** — What problem is being solved, and why
2. **Scope** — Files, packages, and systems in scope; what is explicitly out of scope
3. **Acceptance Criteria** — Measurable conditions that define "done" (gate results, test expectations, behavior changes)
4. **Constraints** — Repo rules, layering invariants, naming conventions, performance budgets
5. **Risks** — Known failure modes, rollback plan, concurrent-session conflicts

### Phase 2 — Plan from Spec

Derive an implementation plan from the spec:

1. Ordered list of file changes
2. Gate verification steps after each change
3. Rollback procedure if gates fail

### Phase 3 — Implement per Plan

Execute the plan, verifying after each step:

1. Run relevant gates (type-check, lint, tests) after each logical change
2. Never proceed to the next step if the current step fails verification
3. Update the spec if scope changes during implementation

### Phase 4 — Verify Against Spec

Before declaring completion:

1. Re-run all acceptance criteria from the spec
2. Confirm no regressions in unrelated gates
3. Update `AGENT_TRACER.md` for affected packages
4. Commit with a conventional commit message

This approach is enforced by the `pnpm agent:verify` 27-gate suite — the spec's acceptance criteria must include passing all applicable gates.
