# Arch-CorpOS Business Loops — Implementation Tasks

## Execution Waves

### Wave 1: Corporate Governance & Department Hierarchy (`.agents/corpos/`)
- [ ] **Task 1.1**: Create master configuration `.agents/corpos/corpos.config.json` defining tiers, departments, authority levels (L0–L3), and safety fences. *(Maps to REQ-CORP-01, REQ-CORP-02)*
- [ ] **Task 1.2**: Author comprehensive synthesis specification `.agents/corpos/SPEC.md` documenting the unified `win` + `CorpOS` + `ai-company` model. *(Maps to REQ-CORP-01)*
- [ ] **Task 1.3**: Create department blueprints under `.agents/corpos/departments/`:
  - `executive.md` (Tier 0 Brain / Strategy / Goal Synthesizer)
  - `engineering.md` (Tier 1 Code Quality / Architecture / Dependencies)
  - `control-room.md` (Tier 1 SCADA Telemetry / Shift Handover / Anomaly Detection)
  - `compliance-safety.md` (Tier 1 RLS Security / Auditing / Secret Scanning)
  *(Maps to REQ-CORP-01, REQ-CORP-02)*

### Wave 2: Win Business Loop Engine & Storage Subsystem
- [ ] **Task 2.1**: Initialize file-first storage directories (`storage/briefs/`, `storage/approvals/`, `storage/artifacts/`, `storage/outcomes/`, and initialize `storage/journal.jsonl`). *(Maps to REQ-LOOP-03, REQ-VERIF-03, REQ-VERIF-04)*
- [ ] **Task 2.2**: Implement authority gatekeeper `.agents/corpos/engine/authority.sh` (Validates L0–L3 permissions and creates markdown approval cards when L3 permissions are requested). *(Maps to REQ-CORP-02, REQ-CORP-03, REQ-CLI-02)*
- [ ] **Task 2.3**: Implement adaptive scheduler `.agents/corpos/engine/scheduler.sh` (Computes dynamic interval based on idle vs anomaly outcomes, backoff factors, and quiet hours). *(Maps to REQ-SCHED-01, REQ-SCHED-02, REQ-SCHED-03)*
- [ ] **Task 2.4**: Implement main loop execution engine `.agents/corpos/engine/tick.sh` (Coordinates Signal Intake -> Brief -> Authority Gate -> Worktree Sandbox -> Verification -> Rollback/Pass -> Journal -> Reschedule). *(Maps to REQ-LOOP-01, REQ-LOOP-02, REQ-LOOP-03, REQ-EXEC-01, REQ-EXEC-02, REQ-VERIF-01, REQ-VERIF-02, REQ-VERIF-04)*

### Wave 3: Production Business Loops (`LOOP.md` + `SKILL.md`)
- [ ] **Task 3.1**: Create `codebase-health` loop under `.agents/corpos/loops/codebase-health/` with `LOOP.md` (trigger: build error / commit) and `SKILL.md` (TypeScript drift & policy compliance runbook). *(Maps to REQ-LOOP-01, REQ-EXEC-02)*
- [ ] **Task 3.2**: Create `shift-integrity` loop under `.agents/corpos/loops/shift-integrity/` with `LOOP.md` (trigger: shift anomaly / unassigned equipment) and `SKILL.md` (Control Room verification runbook). *(Maps to REQ-LOOP-01, REQ-EXEC-02)*
- [ ] **Task 3.3**: Create `security-compliance` loop under `.agents/corpos/loops/security-compliance/` with `LOOP.md` (trigger: RLS policy drift / secret detection) and `SKILL.md` (Database security runbook). *(Maps to REQ-LOOP-01, REQ-EXEC-02)*

### Wave 4: CLI Operations, Verification & Documentation
- [ ] **Task 4.1**: Implement executable CLI `.agents/corpos/bin/corpos` supporting `status`, `tick`, `approve`, `journal`, and `daemon`. *(Maps to REQ-CLI-01, REQ-CLI-02, REQ-CLI-03)*
- [ ] **Task 4.2**: Symlink or register `bin/corpos` in repo package scripts / developer toolchain. *(Maps to REQ-CLI-01)*
- [ ] **Task 4.3**: Execute validation tests: dry-run tick, simulated signal handling, approval generation, journal write. *(Maps to REQ-VERIF-04, REQ-CLI-03)*
- [ ] **Task 4.4**: Verify workspace health (`pnpm type-check`) and update `walkthrough.md`.
