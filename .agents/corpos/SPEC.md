# Arch-CorpOS: Autonomous Corporate Business Loops Specification

> **A synthesis of `win.sh` (`win-sh/win`), `SafetyMP/CorpOS`, and `itsPremkumar/ai-company` tailored for Plantcor Mining Operations (Arch-Systems).**

---

## 1. Why Arch-CorpOS Business Loops Exist

Most AI agent setups today are **ephemeral, one-off chat sessions**. Most system automations are **dumb cron jobs**.
Real company work sits squarely in the middle:

```
+------------------------+      +---------------------------+      +--------------------------+
|  One-Off Chat Sessions |      |  Arch-CorpOS Win Loops    |      |  Rigid Cron Automations  |
|  - Ephemeral context   |  vs  |  - Signal-driven waking   |  vs  |  - Fires blindly on clock|
|  - Forgets everything  |      |  - Adaptive SKILL.md runs |      |  - Runs static script    |
|  - Manual babysitting  |      |  - File-first audit trail |      |  - Fire-and-forget       |
|  - No business backing |      |  - L0-L3 Authority Gates  |      |  - Hard to audit later   |
+------------------------+      +---------------------------+      +--------------------------+
```

### The Fundamental Duality: Cron vs. Win Loop

| Characteristic | Traditional Cron Task | Arch-CorpOS Business Loop |
| :--- | :--- | :--- |
| **Trigger Mechanism** | Runs at a fixed, blind clock time | Wakes on useful signal (telemetry drift, git event) or adaptive interval |
| **Execution Script** | Blindly replays the exact same script | Uses a readable `SKILL.md` that adapts its strategy to the specific signal |
| **Delivery Model** | Usually fire-and-forget | Records structured briefs, approvals, artifacts, outcomes, and journals |
| **Auditability** | Opaque standard output, hard to inspect | Writes files you can diff, commit, inspect, and review in Git |
| **Judgment Scope** | Good only for mechanical, deterministic jobs | Built for corporate business cases where contextual judgment matters |
| **Rescheduling** | Static schedule repeats blindly | Dynamically schedules the next useful check based on outcome & health |

---

## 2. The Three Architectural Pillars

### Pillar A: Signal-Driven Business Loops (`win.sh`)
- **Signal Intake**: Loops subscribe to specific signals (SCADA sensor anomalies, git commits, failing tests, pull request requests).
- **Brief First**: Before modifying any state, the system synthesizes a markdown brief (`briefs/<tick_id>.md`) summarizing why action is required, the proposed scope, and the safety budget.
- **Evidence & Outcomes**: Every action captures before/after diffs in `artifacts/<tick_id>/` and produces an impact evaluation card in `outcomes/<tick_id>.md`.
- **Append-Only Journal**: Every tick commits a structured log entry to `journal.jsonl`.
- **Adaptive Scheduling**: The next tick interval expands (exponential backoff) when conditions are green, and contracts to immediate follow-up when active intervention is underway.

### Pillar B: Corporate Governance & Authority Matrix (`CorpOS`)
Operations are partitioned into deterministic authority levels:
- **Level 0 (Observer)**: Read-only inspection of telemetry, files, and git logs. Zero risk of mutation.
- **Level 1 (Advisor)**: Authors documentation, briefs, audit reports, and proposed patches. Cannot modify production codebase.
- **Level 2 (Operator)**: Autonomous code mutation, unit test execution, and verification assertions in isolated git worktrees. Changes cannot merge without passing all quality gates.
- **Level 3 (Executive/Admin)**: High-risk operations (database migrations, secret updates, production deployment). **Strictly requires human sign-off** via an approval card written to `storage/approvals/`.

### Pillar C: Tiered Organizational Structure (`ai-company`)
Autonomous agents belong to organized corporate departments:
- **Tier 0: Executive & Strategic Brain**:
  - `executive`: Cross-department alignment, global compute/token budget enforcement, priority conflicts.
- **Tier 1: Core Business Operations**:
  - `engineering`: Monorepo health, architectural boundaries (`policy:check`), TypeScript correctness, dependency hygiene.
  - `control-room`: Plantcor SCADA monitoring, shift handovers, operator assignment validation, equipment uptime telemetry.
  - `compliance-safety`: Supabase RLS security, credential leakage auditing, license compliance, audit log validation.

---

## 3. The 9-Phase Tick Lifecycle

```
[ 1. SIGNAL INTAKE ] -> [ 2. EVALUATION ] -> [ 3. BRIEF GENERATION ]
                              |
                              v
                   [ 4. AUTHORITY GATEKEEPER ]
                   Checks CorpOS L0, L1, L2, L3
                              |
            +-----------------+-----------------+
            |                                   |
       [ Level <= L2 ]                     [ Level >= L3 ]
            |                                   |
            v                                   v
  [ 5. WORKTREE SANDBOX ]              [ 5b. APPROVAL CARD ]
  .agents/worktrees/<id>               storage/approvals/<id>.md
            |                                   |
            v                                   v
  [ 6. AGENT DISPATCH ]                 WAIT FOR HUMAN SIGN-OFF
  Reads SKILL.md + brief.md                     |
            |                             (corpos approve)
            v                                   |
  [ 7. VERIFICATION GATE ] <--------------------+
  Runs deterministic asserts
            |
      +-----+-----+
      |           |
   [ PASS ]    [ FAIL ] (2 iterations max)
      |           |
      v           v
  [ ARTIFACTS ] [ SAFE ROLLBACK ]
  Git diffs     git checkout -- .
      |           |
      +-----+-----+
            |
            v
  [ 8. OUTCOME & AUDIT JOURNAL ]
  Writes outcome card & appends to journal.jsonl
            |
            v
  [ 9. ADAPTIVE RESCHEDULING ]
  Calculates next run timestamp based on state
```

---

## 4. File-First Storage Standard

All data is stored directly in git-trackable files under `.agents/corpos/`:

```
.agents/corpos/
├── corpos.config.json           # Master company configuration
├── bin/corpos                   # CLI control entrypoint
├── engine/                      # Execution, authority, and scheduler engines
├── departments/                 # Department specs (executive, engineering, etc.)
├── loops/                       # Loop folders with LOOP.md and SKILL.md
└── storage/
    ├── briefs/                  # <tick_id>.md proposals prior to mutation
    ├── approvals/               # <tick_id>.md human approval tickets
    ├── artifacts/               # <tick_id>/ contains diffs, logs, screenshots
    ├── outcomes/                # <tick_id>.md evaluation results
    └── journal.jsonl            # Append-only execution ledger
```

---

## 5. Security Fences & Negative Constraints

1. **System Path Protection**: Never modify any files under `/usr/share/omarchy/` or OS root.
2. **Secrets Sandboxing**: Never read or expose `.env*`, `*.pem`, `*.key`, or production credentials into artifacts or prompts.
3. **Rollback Guarantee**: If verification gates fail after 2 consecutive correction attempts, the worktree is rolled back cleanly with `git checkout -- .` to ensure the branch remains in a clean state.
4. **No Phantom Approvals**: No agent can approve its own Level 3 action. Level 3 actions require human confirmation through the CLI (`corpos approve <id>`).
