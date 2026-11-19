# Release Certification & Governance

Release certification in Arch-System provides a deterministic, SHA-bound go/no-go gate for `HEAD` commits. Certification evaluates empirical verification evidence, baseline regression comparisons, independent agent verification records, and explicit human approvals — **and never performs automatic production deployments**.

---

## The 6 Release Statuses

Defined in `packages/contract/src/schemas/quality-intelligence.schema.ts` (`releaseStatusSchema`) and `packages/database/migrations/226_quality_intelligence_engine.sql`:

| Status              | Meaning                                                                                                                                           | Entry / Exit Rules                                                                                       |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------- |
| `NOT_READY`         | No valid run exists for `HEAD`, evidence is stale (`commitSha !== HEAD`), or checks were skipped/unavailable without failures                     | Initial state or incomplete execution; exits to `READY_FOR_REVIEW` or `BLOCKED` after fresh verification |
| `READY_FOR_REVIEW`  | All technical mandatory requirements passed for `HEAD`; awaiting human sign-off                                                                   | Entered when technical gates pass without `--approved-by` / admin approval                               |
| `APPROVED`          | All 10 mandatory requirements satisfied and authorized human approval recorded                                                                    | Entered from `READY_FOR_REVIEW` after `admin` sign-off (`approvedBy`, `approvedAt`)                      |
| `BLOCKED`           | One or more mandatory requirements failed, evidence digest failed, critical/high regression detected, or Tier 2 agent verification lacks approval | Blocks release until defects are remediated and re-verified                                              |
| `RELEASED`          | Candidate commit has been deployed through a separate, authorized release workflow                                                                | Terminal deployment milestone recorded post-deploy                                                       |
| `ROLLBACK_REQUIRED` | Post-deployment defect or regression discovered after `RELEASED`                                                                                  | Triggers incident rollback; returns pipeline to `NOT_READY` for remediation                              |

---

## All 10 Mandatory Release Requirements

Evaluated by `evaluateReleaseCertificate` in `tools/scripts/quality-orchestrator.mjs` (and mirrored by `evaluateReleaseCertification` in `packages/intelligence/src/quality/release-certifier.ts`), **all 10 requirements are mandatory** for certification:

|  #  | Requirement ID (CLI)                   | Requirement Name                                          | Domain Engine Mapping                          | Pass Criteria                                                                                                                                          |
| :-: | :------------------------------------- | :-------------------------------------------------------- | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | `1_composite_score_floor`              | Composite Quality Score `>= 90` & Zero Mandatory Failures | `code_quality_gates`                           | `overallScore >= 90`, `mandatoryFailures === 0`, and `releaseBlocked === false`                                                                        |
|  2  | `2_commit_sha_parity`                  | Evidence Commit SHA Matches Exact `HEAD`                  | `commitSha` parity                             | `currentRun.commitSha` matches exact `HEAD` commit SHA                                                                                                 |
|  3  | `3_build_and_type_safety`              | Clean Type Safety, Build & Infrastructure Preflight       | `architecture_checks` + `deployment_preflight` | `type-check` / `affected-type-check`, `portal-build`, and `vercel-preflight` all `PASSED`                                                              |
|  4  | `4_tests_and_eval_execution`           | Functional & Unit Test Suites Passed Without Stubs        | `required_tests`                               | All `functional_testing` checks `PASSED` (no `FAILED`, `BLOCKED`, `UNAVAILABLE`, or `SKIPPED`)                                                         |
|  5  | `5_security_and_rbac_parity`           | Security, Supply Chain & Authorization Matrix Passed      | `security_findings`                            | All `security` checks `PASSED` and `securityRiskLevel` is neither `CRITICAL` nor `HIGH`                                                                |
|  6  | `6_database_and_rls_integrity`         | Database Migration Drift, Lint & RLS Matrix Integrity     | `database_migrations`                          | All `database_integrity` checks (`migration-drift`, `migration-lint`, `rls-matrix`, `database-tests`) `PASSED`                                         |
|  7  | `7_regression_clearance`               | Zero New Critical or High Regressions vs Baseline         | `regression_clearance`                         | Zero non-pre-existing (`!isPreExisting`) `CRITICAL` or `HIGH` regressions                                                                              |
|  8  | `8_behavioral_and_performance_budgets` | Performance Budgets, Design Tokens & Accessibility Passed | `integration_health` / UI & perf checks        | All `performance` and `accessibility_ux` checks `PASSED`                                                                                               |
|  9  | `9_append_only_evidence_integrity`     | SHA-256 Evidence Manifest Digest Verified                 | `evidence_availability`                        | Recomputed `computeEvidenceSha256(currentRun)` matches `currentRun.evidenceSha256`                                                                     |
| 10  | `10_agent_verification_and_approval`   | Independent Agent Verification & Human Sign-Off           | `authorized_approval`                          | No unverified `agentId` runs; matching agent verification is `VERIFICATION_PASSED`, or `REQUIRES_HUMAN_APPROVAL` has explicit `--approved-by` sign-off |

---

## Why a High Aggregate Score Never Overrides a Failed Mandatory Requirement

A composite score of `95/100` does **not** certify a release if even one mandatory requirement fails:

1. **Requirement 1 Explicitly Enforces Both Floor and Blocker State:** `overallScore >= 90` fails immediately if `mandatoryFailures > 0` or `releaseBlocked === true`.
2. **Independent Blocking Requirements (2–10):** Even if a high weight category boosts the composite average, any single failure in commit SHA parity, type-check/build, unit tests, security/RBAC, database migrations/RLS, new `CRITICAL`/`HIGH` regressions, performance/UX budgets, SHA-256 tamper verification, or unapproved agent work forces `status = "BLOCKED"` (or `"NOT_READY"` on stale/skipped runs).
3. **Zero-Point Unavailable/Skipped Policy:** Missing, unavailable, or skipped checks earn `0` points and cause their category requirement to evaluate as `UNAVAILABLE` or `SKIPPED`, preventing partial runs from achieving `READY_FOR_REVIEW` or `APPROVED`.

---

## CLI Usage (`pnpm quality:release`)

Evaluate release readiness for the current `HEAD` commit from the latest verification run:

```bash
# Evaluate release certification without human sign-off (yields READY_FOR_REVIEW, BLOCKED, or NOT_READY)
pnpm quality:release

# Record explicit human approval when all technical checks pass (or for Tier 2 agent changes)
pnpm quality:release -- --approved-by "tim.oniel" --notes "Verified migration 226 and RBAC policies"

# Evaluate a specific evidence file and emit machine-readable JSON
pnpm quality:release -- --input .ci-local/quality-intelligence/latest.json --json
```

### Generated Artifacts & Exit Codes

- **Artifacts Written:**
  - `.ci-local/quality-intelligence/release-certificate.json` (`ReleaseCertification` schema)
  - `.ci-local/quality-intelligence/release-certificate.md` (10-requirement checklist and blocker summary)
- **Exit Codes:**
  - `0` when status is `READY_FOR_REVIEW` or `APPROVED`
  - `1` when status is `BLOCKED` or `NOT_READY`

---

## Control Room RBAC Approval Procedure

In PostgreSQL (`packages/database/migrations/226_quality_intelligence_engine.sql`), release certification records live in `public.quality_release_certifications` with strict Row Level Security:

1. **Read Access (`SELECT`):** Restricted to active (`deleted_at IS NULL`) `public.employees` with role `admin`, `supervisor`, or `control_room_operator`.
2. **Draft Insertion (`INSERT`):** Restricted to `admin`, `supervisor`, or `service_role`, referencing an existing immutable `public.quality_verification_runs(run_id)` (`ON DELETE RESTRICT`).
3. **Certification Approval (`UPDATE`):** Restricted **exclusively to `admin` employees** (`e.auth_id = (SELECT auth.uid()) AND e.deleted_at IS NULL AND e.role = 'admin'`).
4. **Approval Fields Recorded:** `release_status = 'APPROVED'`, `approved_by` (admin employee UUID), `approved_at` (UTC timestamp), `notes`, and automatic `updated_at` via `touch_quality_release_certification_updated_at()`.

---

## No-Auto-Deploy & Read-Only Production Governance

1. **Evaluation Only — Never Auto-Deploys:** `pnpm quality:release` (`tools/scripts/quality-orchestrator.mjs release`) strictly evaluates evidence and writes certification records. It **never** triggers Vercel deployments, Git pushes, or production mutations.
2. **Read-Only Production Boundary:** Quality Intelligence checks and Control Room dashboards operate strictly read-only against production verification telemetry.
3. **Human-Gated Promotion:** Production deployment, destructive database migrations, security-policy modifications, and Tier 2 agent changes always require explicit human `admin` approval and standard PR/release workflows.
