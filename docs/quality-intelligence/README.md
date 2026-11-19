# Arch-System Quality Intelligence Engine

> **Core Principle:** _"An agent's declaration that work is complete is not evidence that work is correct."_

The **Quality Intelligence Engine** is Arch-System's deterministic, evidence-first verification, scoring, regression-detection, agent-audit, and release-certification platform. It replaces ad-hoc scripts and self-attested commit checks with schema-validated, SHA-256-hashed verification runs backed by `@repo/contract`, `@repo/intelligence/quality`, `@repo/database` (migration `226_quality_intelligence_engine.sql`), a unified CLI orchestrator (`tools/scripts/quality-orchestrator.mjs`), Control Room visibility, and `.github/workflows/quality-intelligence.yml`.

---

## Operational Documentation Index

| Document                                                 | Purpose                                                                                                                                          |
| :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| [`agent-reporting.md`](./agent-reporting.md)             | `AgentCompletionReport` JSON contract, 8-state machine, anti-self-verification, Git diff parity, secret redaction, and `AgentPerformanceMetrics` |
| [`quality-gates.md`](./quality-gates.md)                 | All 10 gate categories (A–J), availability rules, 8-category weighted scoring engine (`100%`), and regression detection rules                    |
| [`release-certification.md`](./release-certification.md) | The 6 release statuses, 10 mandatory release requirements, Control Room RBAC sign-off, and no-auto-deploy governance                             |

### Design & Planning References

- [`docs/plans/quality-intelligence/01-baseline-audit.md`](../plans/quality-intelligence/01-baseline-audit.md) — Baseline audit of existing CI workflows, scripts, and security/audit gaps
- [`docs/plans/quality-intelligence/02-architecture.md`](../plans/quality-intelligence/02-architecture.md) — Target architecture and component design
- [`docs/plans/quality-intelligence/03-implementation-plan.md`](../plans/quality-intelligence/03-implementation-plan.md) — 10-stage TDD implementation roadmap

---

## Architecture Summary

```text
Developer / AI Agent / GitHub Actions (.github/workflows/quality-intelligence.yml)
  │
  ▼
tools/scripts/quality-orchestrator.mjs  (pnpm quality:*)
  ├── Selects gates by mode & changed files (@repo/intelligence/quality gate-registry)
  ├── Executes real commands (type-check, lint, tests, security, DB/RLS, perf, UI, governance)
  ├── Redacts secrets prior to log persistence (secret-redactor)
  ├── Computes 8-category weighted score (scoring-engine) & baseline diff (regression-engine)
  ├── Independently verifies agent reports against Git diffs (agent-verifier)
  ├── Evaluates 10 mandatory release requirements for HEAD SHA (release-certifier)
  └── Persists SHA-256 evidence to .ci-local/quality-intelligence/ & PostgreSQL 17 ledger
```

### Core Packages & Files

| Component         | Path                                                               | Responsibility                                                                                                                                              |
| :---------------- | :----------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zod 4 Contracts   | `packages/contract/src/schemas/quality-intelligence.schema.ts`     | Canonical schemas and inferred TypeScript types for runs, checks, regressions, agent reports, metrics, and release certifications                           |
| Domain Engines    | `packages/intelligence/src/quality/`                               | Pure TypeScript modules: `gate-registry.ts`, `scoring-engine.ts`, `regression-engine.ts`, `agent-verifier.ts`, `release-certifier.ts`, `secret-redactor.ts` |
| PostgreSQL Ledger | `packages/database/migrations/226_quality_intelligence_engine.sql` | Append-only tables (`quality_verification_runs`, `agent_work_reports`, `quality_release_certifications`) with immutability triggers and InitPlan RLS        |
| CLI Orchestrator  | `tools/scripts/quality-orchestrator.mjs`                           | Zero-dependency Node 24 ESM runner executing local/CI verification, agent verification, baseline comparison, and release evaluation                         |
| CI Workflow       | `.github/workflows/quality-intelligence.yml`                       | SHA-pinned GitHub Actions workflow (`pull_request`, `push` to `main`, weekly schedule, and `workflow_dispatch`)                                             |

---

## Quickstart CLI Commands

Run all commands from the repository root with Node `>=24.0.0` and `pnpm@9.15.9`. When forwarding CLI flags through `pnpm`, place `--` before the flags.

```bash
# 1. Run scoped verification against files changed relative to main
pnpm quality:changed

# 2. Run explicit mode (changed | pr | full | release), optionally updating baseline on pass
pnpm quality:run -- --mode pr --base main
pnpm quality:run -- --mode full --update-baseline

# 3. Run full monorepo verification (including portal build, knip, styles, markdown, resilience)
pnpm quality:full

# 4. Preview planned checks without executing commands (--dry-run marks checks SKIPPED)
pnpm quality:run -- --mode changed --dry-run

# 5. Independently verify an AI agent's completion report against real Git diffs & checks
pnpm quality:agent -- --report .ci-local/quality-intelligence/agent-report.json --base main

# 6. Render a Markdown or JSON summary from the latest verification run
pnpm quality:report -- --format md
pnpm quality:report -- --format json

# 7. Compare current evidence run against baseline.json to separate NEW vs PRE-EXISTING failures
pnpm quality:compare

# 8. Evaluate the 10 mandatory release requirements for exact HEAD SHA (never deploys)
pnpm quality:release
pnpm quality:release -- --approved-by "release-admin" --notes "Reviewed Tier 2 migration"
```

### Supported `quality-orchestrator.mjs` Subcommands & Flags

| Command   | Script Alias           | Key Options                                                                                                           |
| :-------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `run`     | `pnpm quality:run`     | `--mode changed\|pr\|full\|release`, `--base <ref>`, `--json`, `--output-dir <dir>`, `--dry-run`, `--update-baseline` |
| `changed` | `pnpm quality:changed` | `--base main`, `--json`, `--output-dir <dir>`, `--dry-run`                                                            |
| `full`    | `pnpm quality:full`    | `--base main`, `--json`, `--output-dir <dir>`, `--dry-run`, `--update-baseline`                                       |
| `agent`   | `pnpm quality:agent`   | `--report <path>` (required), `--base main`, `--verifier <id>`, `--output-dir <dir>`, `--dry-run`, `--json`           |
| `report`  | `pnpm quality:report`  | `--format md\|json`, `--input <path>`, `--output-dir <dir>`                                                           |
| `compare` | `pnpm quality:compare` | `--baseline <path>`, `--current <path>`, `--output-dir <dir>`, `--json`                                               |
| `release` | `pnpm quality:release` | `--approved-by <name>`, `--notes <text>`, `--input <path>`, `--output-dir <dir>`, `--json`                            |

---

## Evidence Storage & Immutability

### Local Workspace Evidence (`.ci-local/quality-intelligence/`)

Each orchestrator run writes deterministic, secret-redacted JSON and Markdown artifacts under `.ci-local/quality-intelligence/` (configurable via `--output-dir`):

- `runs/<runId>.json` — Full `QualityRunEvidence` payload with `evidenceSha256` digest
- `latest.json` — Most recent `QualityRunEvidence` manifest
- `latest-report.md` — Human-readable Markdown summary including category breakdown and agent metrics
- `baseline.json` — Verified baseline run updated only when `--update-baseline` is passed on a clean `PASSED` non-dry-run execution with zero mandatory failures and `releaseBlocked === false`
- `agent-verifications/<verificationId>.json` — Independent `AgentVerificationReport` artifacts
- `release-certificate.json` and `release-certificate.md` — Release certification checklist output for `HEAD`

### PostgreSQL 17 Ledger (`226_quality_intelligence_engine.sql`)

Migration `packages/database/migrations/226_quality_intelligence_engine.sql` defines three RLS-protected tables matching `@repo/contract`:

1. `public.quality_verification_runs` — Stores immutable verification run evidence, category score breakdown, regressions, and `evidence_sha256`.
2. `public.agent_work_reports` — Stores submitted `AgentCompletionReport` payloads alongside independent diff-parity results (`file_diff_matches`, `undeclared_files`, `missing_declared_files`), `computed_state`, and `evidence_run_id`.
3. `public.quality_release_certifications` — Stores release readiness evaluations (`release_status`, `requirements`, `blockers`, `evidence_run_id`, `approved_by`, `approved_at`).

**Append-Only Trigger Protection:** `public.prevent_quality_evidence_mutation()` blocks any `UPDATE` or `DELETE` on `quality_verification_runs` and `agent_work_reports` with PostgreSQL error code `42501`. `quality_release_certifications` preserves its append-only `evidence_run_id` foreign key (`ON DELETE RESTRICT`) and tracks approvals via `touch_quality_release_certification_updated_at()`.

---

## Control Room Integration & RBAC

Control Room visibility targets `/control-room/quality-intelligence` backed by authenticated Control Room API routes and the RLS policies enforced in migration `226_quality_intelligence_engine.sql`:

| Role / Principal              | `SELECT` (Read Runs, Reports, Certs) | `INSERT` (Record Runs, Reports, Certs) | `UPDATE` (Approve Certifications) |
| :---------------------------- | :----------------------------------: | :------------------------------------: | :-------------------------------: |
| `admin`                       |               Allowed                |                Allowed                 |              Allowed              |
| `supervisor`                  |               Allowed                |                Allowed                 |              Denied               |
| `control_room_operator`       |               Allowed                |                 Denied                 |              Denied               |
| `service_role` (JWT claim)    |          Bypassed / System           |                Allowed                 |              System               |
| Unauthenticated / Other Roles |                Denied                |                 Denied                 |              Denied               |

All Control Room policies use InitPlan-wrapped `(SELECT auth.uid())` lookups against `public.employees` (`e.deleted_at IS NULL`) and never expose raw secrets or fake fallback telemetry.
