# Quality Gates, Weighted Scoring & Regression Detection

Arch-System organizes verification checks across **10 gate categories (A–J)** in `packages/intelligence/src/quality/gate-registry.ts` and scores verified evidence across **8 weighted scoring categories** in `packages/intelligence/src/quality/scoring-engine.ts`.

---

## Gate Categories (A–J)

|  #  | Category (`GateCategory`) | Check ID                    | Check Name                                 | Owner                  | Command                                                | Mandatory | Modes                                                                           |
| :-: | :------------------------ | :-------------------------- | :----------------------------------------- | :--------------------- | :----------------------------------------------------- | :-------: | :------------------------------------------------------------------------------ |
|  A  | `code_quality`            | `type-check`                | Workspace TypeScript Check                 | `platform-core`        | `pnpm type-check`                                      |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  A  | `code_quality`            | `biome-lint`                | Biome Code & Format Lint                   | `platform-core`        | `pnpm lint`                                            |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  A  | `code_quality`            | `stylelint`                 | CSS Stylelint Check                        | `frontend-ui`          | `pnpm lint:styles`                                     |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  A  | `code_quality`            | `spelling-lint`             | CSpell Spelling Check                      | `developer-experience` | `pnpm lint:spelling`                                   |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  A  | `code_quality`            | `markdown-lint`             | Markdown Lint Check                        | `developer-experience` | `pnpm md:lint`                                         |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  A  | `code_quality`            | `deps-lint`                 | Workspace Dependency Sync Lint             | `platform-core`        | `pnpm deps:lint`                                       |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  A  | `code_quality`            | `knip-dead-code`            | Knip Unused Exports & Dead Code            | `platform-core`        | `pnpm knip`                                            |    No     | `full`, `release`                                                               |
|  B  | `architecture`            | `circular-deps`             | Circular Dependency Check                  | `platform-core`        | `pnpm cycles`                                          |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  B  | `architecture`            | `policy-check`              | Layering & Boundary Policy Check           | `platform-core`        | `pnpm policy:check`                                    |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  B  | `architecture`            | `contract-drift`            | Contract vs Schema Drift Audit             | `platform-core`        | `pnpm audit:drift`                                     |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  B  | `architecture`            | `compliance-audit`          | Static Invariant Compliance Audit          | `platform-core`        | `pnpm audit:compliance`                                |    Yes    | `pr`, `full`, `release`                                                         |
|  B  | `architecture`            | `code-intelligence-audit`   | CodeGraph Intelligence Index Audit         | `platform-core`        | `pnpm audit:code-intelligence`                         |    No     | `full`, `release`                                                               |
|  C  | `testing`                 | `unit-tests`                | Workspace Unit Test Suite                  | `platform-core`        | `pnpm test`                                            |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  C  | `testing`                 | `worker-tests`              | Background Worker Test Suite               | `platform-core`        | `pnpm test:workers`                                    |    No     | `changed`, `pr`, `full`, `release`                                              |
|  C  | `testing`                 | `e2e-journeys`              | E2E Journey Coverage Audit                 | `qa-release`           | `node tools/audits/audit-e2e-journeys.cjs`             |    No     | `changed`, `pr`, `full`, `release`                                              |
|  C  | `testing`                 | `live-e2e-suite`            | Live Browser Playwright E2E Suite          | `qa-release`           | `pnpm test:e2e`                                        |    No     | `full`, `release` (`available: false` unless `RUN_LIVE_E2E=1` + portal running) |
|  D  | `security`                | `supply-chain-audit`        | Supply Chain & Secret Hygiene Audit        | `security-team`        | `pnpm audit:supply-chain`                              |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  D  | `security`                | `auth-matrix-audit`         | RBAC & Auth Matrix Audit                   | `security-team`        | `pnpm audit:auth-matrix`                               |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  E  | `database`                | `database-check-migrations` | Database Migration Integrity Check         | `database-team`        | `pnpm --filter @repo/database check-migrations`        |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  E  | `database`                | `database-tests`            | Database RLS & Rollback Test Suite         | `database-team`        | `pnpm --filter @repo/database test`                    |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  E  | `database`                | `rls-matrix`                | PostgreSQL RLS Matrix Audit                | `database-team`        | `pnpm audit:rls-matrix`                                |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  F  | `performance`             | `performance-budgets`       | Performance & Bundle Budgets Audit         | `platform-core`        | `node tools/audits/audit-performance-budgets.cjs`      |    No     | `changed`, `pr`, `full`, `release`                                              |
|  F  | `performance`             | `css-performance`           | CSS Bundle Size Budget Check               | `frontend-ui`          | `pnpm lint:css-perf`                                   |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  G  | `ui_ux`                   | `audit-tailwind`            | Tailwind Utility Budget Audit              | `frontend-ui`          | `pnpm audit:tailwind`                                  |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  G  | `ui_ux`                   | `audit-tokens`              | Light-Mode Design Token Audit              | `frontend-ui`          | `pnpm audit:tokens`                                    |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  G  | `ui_ux`                   | `audit-images`              | Next Image Accessibility & Dimension Audit | `frontend-ui`          | `pnpm audit:images`                                    |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  G  | `ui_ux`                   | `audit-hooks`               | SSR-Safe React Hooks Audit                 | `frontend-ui`          | `pnpm audit:hooks`                                     |    Yes    | `changed`, `pr`, `full`, `release`                                              |
|  H  | `infrastructure`          | `vercel-preflight`          | Vercel Deployment Preflight Check          | `devops-release`       | `node tools/scripts/vercel-preflight.cjs`              |    Yes    | `pr`, `full`, `release`                                                         |
|  I  | `reliability`             | `observability-resilience`  | Observability & Resilience Audit           | `platform-core`        | `node tools/audits/audit-observability-resilience.cjs` |    No     | `full`, `release`                                                               |
|  J  | `agent_governance`        | `skill-spector`             | Agent Skill & Governance Integrity Check   | `agent-governance`     | `bash tools/audits/skill-spector.sh`                   |    No     | `changed`, `pr`, `full`, `release`                                              |
|  J  | `agent_governance`        | `verify-27-gates`           | 28-Gate Agent Verification Runner          | `agent-governance`     | `node tools/audits/verify-gates.cjs`                   |    No     | `full`, `release`                                                               |

### CLI Orchestrator Execution Plan (`tools/scripts/quality-orchestrator.mjs`)

When `pnpm quality:run` executes, `buildCheckPlan` schedules workspace-wide and affected-package commands across all 10 categories, including:

- **Changed/PR mode optimizations:** Targeted `biome check <files>`, `turbo run type-check --filter=<pkg>`, and `turbo run test --filter=<pkg> -- --passWithNoTests` when root config manifests are untouched.
- **Additional CLI checks:** `security-policy` (`pnpm policy:security --ci`), `migration-lint` (`node packages/database/scripts/lint-migrations.mjs --all --no-squawk`), `html-meta-check` (`pnpm html:check`), `validate-json` (`node tools/scripts/validate-json.mjs`), `agentic-content` (`node tools/audits/audit-agentic-content.cjs --check`), and in `full`/`release` modes: `portal-build` (`pnpm --filter portal build`, mandatory in `release`), `bundle-size` (`pnpm bundlesize`, requiring `apps/portal/.next`), `lint-styles`, `md-lint`, and `lint-spelling`.

---

## Evidence Format, Enforcement & Availability Rules

### Evidence Format (`QualityCheckResult` & `QualityRunEvidence`)

Every executed gate emits a `QualityCheckResult` validated by `qualityCheckResultSchema`:

- `checkId`, `name`, `category`, `scoringCategory`, `owner`, `command`, `mandatory`
- `status`: `'PASSED' | 'FAILED' | 'SKIPPED' | 'UNAVAILABLE' | 'BLOCKED'`
- `exitCode`: integer or `null` (when skipped/unavailable)
- `durationMs`: non-negative execution time in milliseconds
- `skipReason`: explanation when `SKIPPED`, `UNAVAILABLE`, or `BLOCKED` (e.g., missing precondition or `10m` timeout)
- `logExcerpt`: secret-redacted trailing log slice (max `8000` chars)
- `evidenceLinks`: relative paths or URIs to evidence directories/artifacts

The full run is sealed as `QualityRunEvidence` with `evidenceSha256` computed recursively over canonicalized JSON (`canonicalizeJson` + SHA-256).

### Strict Availability & Non-Fake-Pass Policy

1. **Never Mark Unavailable or Unimplemented Checks as `PASSED`:** If a binary is missing from `PATH`, a precondition fails (e.g., `apps/portal/.next` absent for `bundle-size`), or a live browser environment is unavailable (`live-e2e-suite` without `RUN_LIVE_E2E=1`), the check records `UNAVAILABLE` with an explicit `skipReason`.
2. **Dry-Run Honesty:** `--dry-run` records every planned check as `SKIPPED` (`exitCode: null`, `durationMs: 0`) and sets `overallStatus: "SKIPPED"`.
3. **Mandatory Gate Enforcement:**
   - Any mandatory `FAILED` check sets `overallStatus: "FAILED"` and exits `1`.
   - Any mandatory `BLOCKED` or `UNAVAILABLE` check sets `overallStatus: "BLOCKED"` and exits `1`.
   - In scoring and release evaluation, `SKIPPED`, `UNAVAILABLE`, and `BLOCKED` checks earn **0 points** and trigger `releaseBlocked = true` whenever a mandatory gate is unverified.

---

## Quality Scoring Engine (8 Categories = 100%)

Implemented in `packages/intelligence/src/quality/scoring-engine.ts` and `tools/scripts/quality-orchestrator.mjs`, `calculateQualityScore` maps every check via its `scoringCategory` into 8 weighted buckets:

| Scoring Category (`ScoringCategory`) |      Weight       | Primary Gates Mapped                                                                                                                   |
| :----------------------------------- | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------- |
| `security`                           | **20%** (`0.20`)  | `supply-chain-audit`, `auth-matrix-audit`, `security-policy`, `rls-matrix` / `skill-spector`                                           |
| `functional_testing`                 | **20%** (`0.20`)  | `unit-tests`, `affected-tests`, `worker-tests`, `e2e-journeys`, `live-e2e-suite`                                                       |
| `architecture`                       | **15%** (`0.15`)  | `type-check`, `biome-lint`, `deps-lint`, `knip`, `circular-deps`, `policy-check`, `contract-drift`, `compliance-audit`, `portal-build` |
| `reliability`                        | **15%** (`0.15`)  | `hooks-and-clients`, `vercel-preflight`, `observability-resilience`                                                                    |
| `performance`                        | **10%** (`0.10`)  | `css-performance`, `performance-budgets`, `bundle-size`                                                                                |
| `database_integrity`                 | **10%** (`0.10`)  | `database-check-migrations` / `migration-drift`, `migration-lint`, `database-tests`, `rls-matrix`                                      |
| `accessibility_ux`                   |  **5%** (`0.05`)  | `stylelint`, `audit-tailwind`, `audit-tokens`, `audit-images`, `audit-hooks`, `html-meta-check`                                        |
| `documentation_governance`           |  **5%** (`0.05`)  | `spelling-lint`, `markdown-lint`, `validate-json`, `agentic-content`, `code-intelligence-audit`, `skill-spector`, `verify-27-gates`    |
| **Total**                            | **100%** (`1.00`) | Weighted sum of all 8 category scores (`0–100`)                                                                                        |

### Category Score, Confidence & Coverage Rules

- **Category Score:** `(verified / totalChecksInCategory) * 100` (rounded to 2 decimal places; `0` if zero checks exist in that category). Only `PASSED` increments `verified`; `FAILED`, `BLOCKED`, `SKIPPED`, and `UNAVAILABLE` all reduce the category score.
- **Confidence (`confidencePct`):** Percentage of checks backed by verified/executed results (`(verified / totalChecks) * 100` in `scoring-engine.ts`; `(executedCount / totalChecks) * 100` in `quality-orchestrator.mjs`).
- **Coverage (`coveragePct`):** Measured line coverage percentage from `apps/portal/coverage/coverage-summary.json` when present (in the orchestrator), or percentage of the 8 scoring categories with verified passing checks (`(categoriesWithVerified / 8) * 100`).
- **Security Risk Level (`securityRiskLevel`):** Escalates to `CRITICAL` on any mandatory or critical security failure, `HIGH` on non-mandatory security failures (or zero verified security checks in `scoring-engine.ts`), `MEDIUM` if any security check is `SKIPPED`/`UNAVAILABLE`, and `LOW` only when all security checks pass.

---

## Regression Detection (New vs Pre-Existing Failures)

Both `packages/intelligence/src/quality/regression-engine.ts` and `tools/scripts/quality-orchestrator.mjs` (`pnpm quality:compare`) compare the current `QualityRunEvidence` against `baseline.json` to separate newly introduced regressions from pre-existing failures:

| Comparison Outcome                                                                  | Classification (`isPreExisting`) | Default Severity                                             | Release Impact                                              |
| :---------------------------------------------------------------------------------- | :------------------------------: | :----------------------------------------------------------- | :---------------------------------------------------------- |
| Baseline `PASSED` -> Current `FAILED` or `BLOCKED`                                  |        `false` (**NEW**)         | `CRITICAL` (if mandatory, security, or database) else `HIGH` | Blocks release certification                                |
| Baseline `FAILED` or `BLOCKED` -> Current `FAILED` or `BLOCKED`                     |    `true` (**PRE-EXISTING**)     | `MEDIUM` (CLI) / `HIGH` or `MEDIUM` (domain engine)          | Tracked separately; does not masquerade as a new regression |
| Newly evaluated check (`NOT_PRESENT` in baseline) fails                             |        `false` (**NEW**)         | `HIGH` (if mandatory) else `MEDIUM`                          | Blocks release if `HIGH`                                    |
| Composite `overallScore` drops `>= 5` points (CLI) or `>= 3` points (domain engine) |        `false` (**NEW**)         | `HIGH` (or `CRITICAL` if drop `>= 10`)                       | Blocks release certification                                |
| Domain engine category drop `>= 5` points or check duration `+35%` and `+2000ms`    |        `false` (**NEW**)         | `CRITICAL`/`HIGH` (category drop) or `MEDIUM` (duration)     | Flagged in `regressions[]`                                  |

Run baseline comparison manually at any time:

```bash
pnpm quality:compare -- --baseline .ci-local/quality-intelligence/baseline.json --current .ci-local/quality-intelligence/latest.json
```
