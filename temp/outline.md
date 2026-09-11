# Arch-CorpOS Business Loops — Strategic Outline

## 1. Executive Summary & Problem Framing
Most AI coding setups suffer from a structural dichotomy:
1. **One-Off Agent Sessions:** Ephemeral chat sessions where an agent executes without long-term memory, business context, or automated follow-through. Once closed, context evaporates.
2. **Mechanical Cron Jobs:** Rigid, time-based scripts that fire regardless of whether anything changed, run static scripts incapable of contextual reasoning, fire-and-forget without capturing evidence, and are opaque to inspect.

**Real corporate work sits in the middle.** Business systems require **autonomous business loops** that:
- Wake up when there is a meaningful signal (or dynamic scheduled check).
- Evaluate whether action is warranted (ROI / severity / drift threshold).
- Act through a specialized agent guided by an adaptive, readable `SKILL.md`.
- Operate under strict corporate governance, tiered authority (CorpOS L0–L3), and department boundaries (`ai-company`).
- Produce immutable, file-first evidence (`briefs/`, `approvals/`, `artifacts/`, `outcomes/`, and append-only `journal.jsonl`).
- Adaptively schedule the next run based on outcomes rather than dumb fixed timers.

This initiative synthesizes **`win.sh`** (Signal-driven business loops, file-first auditability), **`SafetyMP/CorpOS`** (Corporate governance, authority levels, SOPs, safety policies), and **`itsPremkumar/ai-company`** (Tiered enterprise hierarchy, department-to-agent dispatch, cross-functional coordination) into **Arch-CorpOS**.

---

## 2. Real-World Council Viewpoints

### Operations & Control Room Director (Mining Operations)
> *"Plantcor operations cannot rely on an agent hallucinating fixes on live PLC or shift data. We need deterministic authority levels (L0 to L3). Any action touching shift closeout or equipment state must pause for human approval with a generated brief, diff, and risk score. If an anomaly clears, the loop should quiet down; if telemetry drifts, it should wake up immediately."*

### Principal Software Architect & DevOps Lead
> *"Everything must be file-first and version-controlled. We don't want another bloated third-party SaaS agent platform. A business loop must be transparent files on disk: `LOOP.md` defines the business contract, `SKILL.md` defines the playbook, `briefs/` explain the intent, `artifacts/` contain the diffs and logs, and `journal.jsonl` tracks execution. Everything runs local-first with git worktree isolation."*

### Chief Information Security Officer (CISO) & Compliance Officer
> *"Agent authority must be hard-gated. L0 is read-only inspection; L1 is advisory documentation; L2 is test-verified code alterations in isolated worktrees; L3 is production migrations/secrets requiring multi-factor or signed approval. Pre-tool hooks must physically prevent privilege escalation."*

---

## 3. Scope Breakdown

1. **Corporate Governance & Hierarchy (`.agents/corpos/`)**:
   - `corpos.config.json`: Organization definition, department taxonomy, authority levels (L0–L3), escalation rules.
   - `SPEC.md`: Foundational synthesis architecture combining `win`, `CorpOS`, and `ai-company`.
   - `departments/`: Department specifications for Executive (`executive.md`), Engineering (`engineering.md`), Control Room (`control-room.md`), and Compliance & Safety (`compliance-safety.md`).

2. **Core Business Loop Engine (`.agents/corpos/engine/`)**:
   - `tick.sh`: Core cycle implementing `Signal -> Brief -> Authority Gate -> Act -> Verify -> Journal -> Next Schedule`.
   - `scheduler.sh`: Adaptive interval engine (exponential backoff on idle, immediate spin on critical alerts, quiet hours).
   - `authority.sh`: Gatekeeper checking agent permission against CorpOS authority matrix and creating human approval cards.

3. **Production Business Loops (`.agents/corpos/loops/`)**:
   - `shift-integrity-loop/`: Monitors shift handovers, unassigned equipment, and telemetry anomalies (`LOOP.md` + `SKILL.md`).
   - `codebase-health-loop/`: Monitors TypeScript errors, policy drift, dependency vulnerabilities, dead code (`LOOP.md` + `SKILL.md`).
   - `security-compliance-loop/`: Validates RLS policies, unencrypted credentials, and secret leaks (`LOOP.md` + `SKILL.md`).

4. **File-First Audit Store (`.agents/corpos/storage/`)**:
   - `briefs/`: Pre-execution strategic briefs explaining why action was chosen.
   - `approvals/`: Human-in-the-loop review cards for Level 2/3 changes.
   - `artifacts/`: Execution diffs, test logs, coverage delta.
   - `outcomes/`: Post-verification KPI delta reports.
   - `journal.jsonl`: Append-only immutable system ledger.

5. **CLI & Operational Interface**:
   - `bin/corpos`: Unified developer and agent CLI tool (`status`, `tick`, `approve`, `journal`, `daemon`).
