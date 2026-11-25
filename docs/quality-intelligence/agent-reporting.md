# Agent Completion Reporting & Independent Verification

Every AI coding agent operating in Arch-System must submit a structured completion report before work can be marked verified. In accordance with the core Quality Intelligence principle — _"An agent's declaration that work is complete is not evidence that work is correct"_ — agents are strictly prohibited from verifying their own work.

---

## `AgentCompletionReport` JSON Schema Reference

Defined in `packages/contract/src/schemas/quality-intelligence.schema.ts` (`agentCompletionReportSchema`), every completion report contains **26 top-level fields** covering identity, commit lineage, file/dependency diffs, testing, command execution results, defects, domain impacts, documentation, evidence links, declared state, and submission timestamp:

|  #  | Field                  | Type & Validation                       | Description                                                          |
| :-: | :--------------------- | :-------------------------------------- | :------------------------------------------------------------------- |
|  1  | `agentId`              | `string` (non-empty, max `128`)         | Unique identifier of the reporting agent (e.g., `worker-3c`)         |
|  2  | `agentName`            | `string` (non-empty, max `128`)         | Human-readable role or name of the reporting agent                   |
|  3  | `taskId`               | `string` (non-empty, max `128`)         | Task or ticket identifier                                            |
|  4  | `taskDescription`      | `string` (non-empty, max `4000`)        | Concise description of the assigned task                             |
|  5  | `startingCommitSha`    | `GitSha` (`/^[0-9a-f]{7,40}$/i`)        | Git commit SHA before the agent began changes                        |
|  6  | `endingCommitSha`      | `GitSha` (`/^[0-9a-f]{7,40}$/i`)        | Git commit SHA after the agent completed changes                     |
|  7  | `filesCreated`         | `string[]` (each non-empty, max `512`)  | Repository-relative paths created by the agent                       |
|  8  | `filesModified`        | `string[]` (each non-empty, max `512`)  | Repository-relative paths modified by the agent                      |
|  9  | `filesDeleted`         | `string[]` (each non-empty, max `512`)  | Repository-relative paths deleted by the agent                       |
| 10  | `dependenciesAdded`    | `string[]` (each non-empty, max `256`)  | Package dependencies added (if any)                                  |
| 11  | `dependenciesRemoved`  | `string[]` (each non-empty, max `256`)  | Package dependencies removed (if any)                                |
| 12  | `featuresImplemented`  | `string[]` (each non-empty, max `1000`) | Concrete capabilities or deliverables implemented                    |
| 13  | `testsCreated`         | `string[]` (each non-empty, max `512`)  | Test files created or updated                                        |
| 14  | `testsExecuted`        | `string[]` (each non-empty, max `512`)  | Test suites executed by the agent                                    |
| 15  | `commandsExecuted`     | `string[]` (each non-empty, max `1000`) | Verification or build commands run by the agent                      |
| 16  | `commandResults`       | `CommandExecutionResult[]`              | Structured command results (see sub-schema below)                    |
| 17  | `knownDefects`         | `string[]` (each non-empty, max `1000`) | Known defects remaining in the deliverable                           |
| 18  | `unresolvedIssues`     | `string[]` (each non-empty, max `1000`) | Open issues or blockers requiring follow-up                          |
| 19  | `securityImpact`       | `string` (max `2000`)                   | Security/auth/RLS impact assessment (use `"None"` if no impact)      |
| 20  | `databaseImpact`       | `string` (max `2000`)                   | Migration/schema/query impact assessment (use `"None"` if no impact) |
| 21  | `integrationImpact`    | `string` (max `2000`)                   | API/contract/external service impact assessment                      |
| 22  | `performanceImpact`    | `string` (max `2000`)                   | Bundle, query, or runtime latency impact assessment                  |
| 23  | `documentationUpdates` | `string[]` (each non-empty, max `512`)  | Documentation or tracer files updated                                |
| 24  | `evidenceReferences`   | `string[]` (each non-empty, max `1000`) | Paths or URIs to test outputs, logs, or artifacts                    |
| 25  | `state`                | `AgentCompletionState` (8-state enum)   | Self-declared state (must NOT be `VERIFICATION_PASSED`)              |
| 26  | `submittedAt`          | `string` (ISO-8601 datetime)            | UTC timestamp when the report was submitted                          |

### `CommandExecutionResult` Sub-Schema

Each item in `commandResults` conforms to `commandExecutionResultSchema`:

- `command`: `string` (non-empty, max `1000`)
- `exitCode`: `integer`
- `durationMs`: `number >= 0` (optional)
- `status`: `'PASSED' | 'FAILED' | 'SKIPPED' | 'UNAVAILABLE' | 'BLOCKED'` (optional)
- `summary`: `string` (max `2000`, optional)

---

## Example `AgentCompletionReport` Payload

```json
{
  "agentId": "worker-1b",
  "agentName": "Contracts & Migration Engineer",
  "taskId": "TASK-QIE-01B",
  "taskDescription": "Define quality intelligence Zod contracts and append-only migration 226",
  "startingCommitSha": "a51e5172",
  "endingCommitSha": "b92c4410",
  "filesCreated": [
    "packages/contract/src/schemas/quality-intelligence.schema.ts",
    "packages/contract/src/schemas/quality-intelligence.schema.test.ts",
    "packages/database/migrations/226_quality_intelligence_engine.sql"
  ],
  "filesModified": ["packages/contract/src/index.ts"],
  "filesDeleted": [],
  "dependenciesAdded": [],
  "dependenciesRemoved": [],
  "featuresImplemented": [
    "Zod 4 contracts for quality runs, checks, regressions, agent reports, and release certifications",
    "PostgreSQL 17 migration 226 with immutability triggers and InitPlan RLS policies"
  ],
  "testsCreated": ["packages/contract/src/schemas/quality-intelligence.schema.test.ts"],
  "testsExecuted": ["pnpm --filter @repo/contract test", "pnpm --filter @repo/database test"],
  "commandsExecuted": [
    "pnpm --filter @repo/contract build",
    "pnpm --filter @repo/contract test",
    "pnpm --filter @repo/database check-migrations",
    "pnpm --filter @repo/database test"
  ],
  "commandResults": [
    {
      "command": "pnpm --filter @repo/contract test",
      "exitCode": 0,
      "durationMs": 1240,
      "status": "PASSED",
      "summary": "All contract schema tests passed"
    }
  ],
  "knownDefects": [],
  "unresolvedIssues": [],
  "securityImpact": "Adds RLS-protected append-only audit tables for quality evidence",
  "databaseImpact": "Creates quality_verification_runs, agent_work_reports, and quality_release_certifications",
  "integrationImpact": "Exports quality intelligence schemas from @repo/contract",
  "performanceImpact": "Adds targeted B-tree indexes on commit_sha, branch, agent_id, and created_at",
  "documentationUpdates": ["docs/quality-intelligence/agent-reporting.md"],
  "evidenceReferences": [".ci-local/quality-intelligence/latest.json"],
  "state": "IMPLEMENTATION_COMPLETE",
  "submittedAt": "2026-11-19T14:30:00.000Z"
}
```

---

## Independent Verification Flow

Run independent verification via the CLI orchestrator:

```bash
pnpm quality:agent -- --report .ci-local/quality-intelligence/agent-report.json --base main
```

Optional flags:

- `--verifier <id>` — Explicit verifier identity (defaults to `quality-orchestrator-cli`)
- `--output-dir <dir>` — Custom evidence directory (defaults to `.ci-local/quality-intelligence`)
- `--dry-run` — Plan checks without executing commands
- `--json` — Print full `AgentVerificationReport` JSON to stdout

### Execution Steps

1. **Parse & Validate Input:** Reads the JSON report at `--report` and validates required identity, commit, and timestamp fields.
2. **Execute Real Changed-Mode Gates:** Runs `executeQualityRun` in `changed` mode tagged with `agentId` and `taskId`, producing a SHA-256 signed `QualityRunEvidence` manifest.
3. **Inspect Actual Git Diff:** Resolves `git diff --name-only <startingCommitSha>..<endingCommitSha>` (plus uncommitted/staged/untracked files when `endingCommitSha` matches `HEAD`, or `getChangedFiles(repoRoot, base)` if commit bounds are unavailable).
4. **Compute Independent Verdict:** Invokes `verifyAgentReport` (matching `verifyAgentCompletion` in `packages/intelligence/src/quality/agent-verifier.ts`) to compare declared files, check statuses, regressions, and Tier 2 path sensitivity.
5. **Persist Verification Artifact:** Writes `AgentVerificationReport` to `.ci-local/quality-intelligence/agent-verifications/<verificationId>.json` (and in DB pipelines, inserts into `public.agent_work_reports`).
6. **Return Non-Zero on Failure or Blocker:** Exits `1` when `computedState` is `VERIFICATION_FAILED` or `BLOCKED`; exits `0` for `VERIFICATION_PASSED` or `REQUIRES_HUMAN_APPROVAL`.

---

## The 8-State Agent Completion Machine

Defined by `agentCompletionStateSchema`:

| State                     | Meaning                                                                                                                          | How Entered                           |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| `NOT_STARTED`             | Task defined; no implementation started                                                                                          | Initial pre-assignment state          |
| `IN_PROGRESS`             | Agent is actively modifying files or running local checks                                                                        | Declared during active work           |
| `IMPLEMENTATION_COMPLETE` | Agent asserts coding is done and submits report for audit                                                                        | Declared by agent on handoff          |
| `VERIFICATION_PENDING`    | Report queued for independent orchestrator/CI verification                                                                       | Assigned by coordinator/CI queue      |
| `VERIFICATION_PASSED`     | Independent checks passed, Git diff matched, zero hard failures, and no Tier 2 / defect escalations                              | Computed only by independent verifier |
| `VERIFICATION_FAILED`     | Failed check, self-verification attempt, Git diff mismatch, missing/invalid evidence digest, or new `CRITICAL`/`HIGH` regression | Computed by independent verifier      |
| `BLOCKED`                 | Zero checks executed, or a mandatory check is `BLOCKED`, `UNAVAILABLE`, or `SKIPPED`                                             | Computed by independent verifier      |
| `REQUIRES_HUMAN_APPROVAL` | Verification passed technical gates, but diff touches Tier 2 sensitive paths or report lists known defects/unresolved issues     | Computed by independent verifier      |

---

## Anti-Self-Verification & Git Diff Parity

### Anti-Self-Verification Rules

1. **Distinct Verifier Identity:** `verifierId` must be non-empty and must not equal `agentReport.agentId` (and in the CLI, also must not equal `agentReport.agentName`). Any match triggers an immediate hard failure (`VERIFICATION_FAILED`).
2. **No Self-Attested Passing State:** If an incoming report declares `state: "VERIFICATION_PASSED"`, the verifier rejects the self-attestation and forces `VERIFICATION_FAILED`.

### Git Diff Parity Checks

1. The verifier normalizes and deduplicates the union of `filesCreated`, `filesModified`, and `filesDeleted` (`declaredSet`).
2. It compares `declaredSet` against `actualChangedFiles` from Git (`actualSet`):
   - `undeclaredFiles` = files in Git diff omitted from the report.
   - `missingDeclaredFiles` = files claimed in the report absent from the Git diff.
   - `fileDiffMatches` = `undeclaredFiles.length === 0 && missingDeclaredFiles.length === 0`.
3. Any undeclared or missing file sets `fileDiffMatches = false` and forces `VERIFICATION_FAILED`.

### Tier 2 Sensitive Path Escalation

Even when all checks pass and `fileDiffMatches === true`, `computedState` escalates to `REQUIRES_HUMAN_APPROVAL` if `actualChangedFiles` touches any Tier 2 sensitive prefix (`libs/features/auth/`, `packages/database/migrations/`, `packages/database/`, `packages/supabase/`, `apps/portal/proxy.ts`, `apps/portal/server/proxy.ts`, `.github/workflows/`, `tools/repo/policy-compiler.cjs`, `infra/`) or if `knownDefects` or `unresolvedIssues` is non-empty.

---

## Secret Redaction

Before any command output is stored in `logExcerpt`, written to `.ci-local/quality-intelligence/`, serialized over HTTP, or hashed into `evidenceSha256`, both `tools/scripts/quality-orchestrator.mjs` (`redactSecrets`) and `packages/intelligence/src/quality/secret-redactor.ts` (`redactSecrets`) scrub sensitive patterns:

- JWT tokens (`eyJ...`)
- Supabase keys (`sb_secret_*`, `sb_service_*`, `sb_anon_*`, `sbp_*`)
- PostgreSQL and Redis DSN passwords (`postgresql://user:[REDACTED:POSTGRES_DSN]@...`)
- HTTP `Bearer` credentials
- GitHub tokens (`ghp_*`, `gho_*`, `ghu_*`, `ghs_*`, `ghr_*`, `github_pat_*`)
- AWS access keys (`AKIA*`) and API keys (`sk-*`, `sk-ant-*`, `sk_live_*`, `sk_test_*`)
- Environment assignments matching `SECRET`, `PASSWORD`, `PASSWD`, `TOKEN`, `API_KEY`, `SERVICE_KEY`, or `PRIVATE_KEY`

---

## `AgentPerformanceMetrics` (Quality Over Volume)

`calculateAgentPerformance` in `packages/intelligence/src/quality/agent-verifier.ts` computes `AgentPerformanceMetrics` strictly from verified outcomes — **lines-of-code (LOC) volume is intentionally excluded**:

| Metric                     | Formula / Meaning                                                                                                                                                                                                                                                                                                                                  |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `speedScore`               | `100` when average verification duration `<= 30,000 ms`, linearly decaying to `0` at `>= 300,000 ms`                                                                                                                                                                                                                                               |
| `correctnessScore`         | `firstPassSuccessRate` minus per-task penalties (`15` per defect, `20` per new regression, `25` per security finding), clamped `0..100`                                                                                                                                                                                                            |
| `verificationQualityScore` | Mean of `evidenceCompletenessPct`, `diffAccuracyPct`, `independentRatioPct`, and `documentationCompletenessPct`                                                                                                                                                                                                                                    |
| `regressionRate`           | Percentage of verified tasks that introduced one or more new (`!isPreExisting`) regressions                                                                                                                                                                                                                                                        |
| Supporting Counters        | `tasksCompleted`, `tasksIndependentlyVerified`, `firstPassVerificationSuccessCount`, `firstPassSuccessRate`, `defectsIntroduced`, `regressionsIntroduced`, `reopenedTasks`, `testCoverageContribution`, `securityFindingsIntroduced`, `avgVerificationDurationMs`, `unresolvedBlockers`, `documentationCompletenessPct`, `evidenceCompletenessPct` |
