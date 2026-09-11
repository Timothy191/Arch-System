# Arch-CorpOS Business Loops — Requirements Specification (EARS Notation)

## 1. System Intent & Scope
Arch-CorpOS combines:
1. `win.sh`: Signal-driven business loops, file-first records (briefs, approvals, artifacts, outcomes, journals), adaptive rescheduling.
2. `SafetyMP/CorpOS`: Corporate hierarchy, role definitions, Standard Operating Procedures (SOPs), L0–L3 authority gates, and safety policies.
3. `itsPremkumar/ai-company`: Multi-departmental organization (Tier 0 Brain/Executive, Tier 1 Engineering/Operations/Compliance), department skill routing, and inter-department messaging.

---

## 2. Requirements in EARS Notation

### 2.1 Corporate Hierarchy & Department Routing
- **REQ-CORP-01**: `WHEN` a task or signal arrives, `THE SYSTEM SHALL` identify the originating domain and route execution exclusively to the assigned department (`executive`, `engineering`, `control-room`, or `compliance-safety`).
- **REQ-CORP-02**: `WHEN` an agent role is instantiated, `THE SYSTEM SHALL` bind it to a strict CorpOS authority level:
  - **Level 0 (Observer)**: Read-only access to files, logs, and telemetry.
  - **Level 1 (Advisor)**: Permission to author briefs, reports, and documentation changes without altering code or infrastructure.
  - **Level 2 (Operator)**: Permission to mutate application code in isolated git worktrees subject to automated verification gates.
  - **Level 3 (Executive/Admin)**: Permission to modify database schemas, secrets, or production configurations, strictly gated by human approval.
- **REQ-CORP-03**: `WHEN` an agent attempts an action exceeding its assigned authority level, `THE SYSTEM SHALL` halt execution and generate an approval ticket in `.agents/corpos/storage/approvals/`.

### 2.2 Signal Detection & Decisional Evaluation (Win Pattern)
- **REQ-LOOP-01**: `WHEN` the loop engine executes a tick, `THE SYSTEM SHALL` evaluate the input signal against the activation threshold declared in `LOOP.md`.
- **REQ-LOOP-02**: `WHEN` the signal is below the activation threshold or indicates an idle/healthy state, `THE SYSTEM SHALL` log an `IDLE` outcome to `journal.jsonl`, calculate an exponential backoff sleep interval, and exit without dispatching an agent.
- **REQ-LOOP-03**: `WHEN` the signal exceeds the activation threshold, `THE SYSTEM SHALL` formulate a markdown brief in `.agents/corpos/storage/briefs/<tick_id>.md` specifying the hypothesis, target scope, estimated budget, and authority required.

### 2.3 Execution & Worktree Isolation
- **REQ-EXEC-01**: `WHEN` an agent is dispatched for Level 2 action, `THE SYSTEM SHALL` provision an isolated git worktree under `.agents/worktrees/<tick_id>` branching from the current HEAD.
- **REQ-EXEC-02**: `WHEN` the agent executes instructions, `THE SYSTEM SHALL` inject the department's readable `SKILL.md` along with the specific `brief.md` into the agent's initial prompt context.
- **REQ-EXEC-03**: `WHEN` an execution step invokes shell or filesystem mutations, `THE SYSTEM SHALL` route commands through `.agents/hooks/pre-tool-guard.sh` to enforce path isolation and blacklist compliance.

### 2.4 Verification, Evidence Capture & Rollback
- **REQ-VERIF-01**: `WHEN` an agent completes its transformation wave, `THE SYSTEM SHALL` execute the deterministic verification commands declared in `LOOP.md` (e.g., `pnpm type-check`, `pnpm test`, `pnpm policy:check`).
- **REQ-VERIF-02**: `WHEN` verification checks fail, `THE SYSTEM SHALL` allow a maximum of 2 automated correction iterations before reverting the worktree via `git checkout -- .` and marking the tick status as `FAILED_ROLLED_BACK`.
- **REQ-VERIF-03**: `WHEN` verification checks pass, `THE SYSTEM SHALL` capture git diffs, command output logs, and modified files as evidence artifacts in `.agents/corpos/storage/artifacts/<tick_id>/`.
- **REQ-VERIF-04**: `WHEN` execution finishes (success or failure), `THE SYSTEM SHALL` write a structured evaluation to `.agents/corpos/storage/outcomes/<tick_id>.md` and append an immutable JSON entry to `.agents/corpos/storage/journal.jsonl`.

### 2.5 Adaptive Scheduling
- **REQ-SCHED-01**: `WHEN` a tick completes successfully with all metrics in healthy ranges, `THE SYSTEM SHALL` increase the polling interval using progressive backoff up to `max_interval_minutes`.
- **REQ-SCHED-02**: `WHEN` a tick detects anomalies, failing tests, or high-priority drift, `THE SYSTEM SHALL` reset the polling interval to `min_interval_minutes` or schedule an immediate follow-up tick.
- **REQ-SCHED-03**: `WHEN` operating during designated quiet hours or maintenance windows, `THE SYSTEM SHALL` defer non-critical background loops until normal operating hours.

### 2.6 CLI & Operational Control
- **REQ-CLI-01**: `WHEN` a human operator executes `corpos status`, `THE SYSTEM SHALL` display all registered departments, active loops, pending approvals, and scheduled next run times.
- **REQ-CLI-02**: `WHEN` a human operator executes `corpos approve <approval_id>`, `THE SYSTEM SHALL` mark the approval card as validated and trigger downstream Level 3 execution.
- **REQ-CLI-03**: `WHEN` a human operator executes `corpos tick <loop_id> --dry-run`, `THE SYSTEM SHALL` simulate signal evaluation, brief formulation, and authority check without executing disk mutations.
