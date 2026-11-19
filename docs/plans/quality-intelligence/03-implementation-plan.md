# Quality Intelligence Engine — 10-Stage TDD Implementation Plan

**Branch:** `feature/quality-intelligence-engine`  
**Methodology:** Incremental Red-Green-Refactor Test-Driven Development (TDD) with strict per-stage file ownership, additive database migrations, and zero unverified production mutations.

---

## Governance & Permission Boundaries

1. **PR-Only Delivery**: Every stage lands via Pull Request against `main` with passing `pnpm type-check`, `pnpm lint`, targeted `pnpm test`, and `pnpm agent:verify`.
2. **Zero Direct Production Mutations**: No stage may modify live production Supabase data, production Vercel environment variables, or GitHub rulesets autonomously without explicit maintainer approval and reviewed migration PRs.
3. **Additive-First Compatibility**: Existing `agent:verify` and CI workflows run in parallel during shadow rollout (Stage 9) before retiring redundant workflows (Stage 10).
4. **Secret Safety**: All logs, run manifests, and API payloads pass through `secret-redactor.ts` prior to storage or HTTP serialization.

---

## Stage 1 — Audit Baseline & Target Architecture Documentation

- **Goal**: Establish grounded forensic baseline (`01-baseline-audit.md`), target architecture (`02-architecture.md`), and execution roadmap (`03-implementation-plan.md`).
- **File Ownership**:
  - `docs/plans/quality-intelligence/01-baseline-audit.md`
  - `docs/plans/quality-intelligence/02-architecture.md`
  - `docs/plans/quality-intelligence/03-implementation-plan.md`
- **TDD / Verification**:
  - Verify all cited paths and line numbers directly against repository files.
  - Run `pnpm md:lint` and `pnpm exec cspell "docs/plans/quality-intelligence/*.md" --config config/tools/cspell.json --no-progress`.
- **Acceptance Criteria**: Exit code `0` on Markdownlint and CSpell; all 12 audit categories and exact scoring/state/certification specs documented.
- **Rollback Safety**: Documentation-only; zero runtime impact.

---

## Stage 2 — API Authorization & Security Gap Remediation

- **Goal**: Close immediate `CRITICAL` auth/RBAC gaps uncovered in the baseline audit before building the intelligence console.
- **File Ownership**:
  - `apps/portal/app/api/admin/observability/route.ts`
  - `apps/portal/app/api/ai/metrics/route.ts`
  - `apps/portal/app/api/control-room/shift-closeout/route.ts`
  - `tools/audits/audit-authorization-matrix.cjs`
  - Corresponding `*.route.test.ts` Jest suites under `apps/portal/app/api/`
- **TDD Test Cases (Red → Green)**:
  1. `GET /api/admin/observability`: non-admin authenticated user receives `403`; unauthenticated receives `401`; `'admin'` receives `200`.
  2. `GET /api/ai/metrics`: unauthenticated request receives `401`; fallback telemetry clearly flags `source: 'fallback'` and never masks DB errors as live metrics.
  3. `POST /api/control-room/shift-closeout`: `'control_room_operator'` role is authorized (`200` on valid payload); unauthorized roles receive `403`.
  4. Remove `'app/api/ai/metrics/route.ts'` exemption from `audit-authorization-matrix.cjs`.
- **Acceptance Criteria**: All route Jest tests pass; `pnpm audit:auth-matrix` exits `0`.
- **Rollback Safety**: Isolated route-handler edits; standard `git revert` restores prior behavior if needed.

---

## Stage 3 — `@repo/contract` Quality Intelligence Schemas

- **Goal**: Define Zod 4 contracts and TypeScript types as the canonical SSoT for runs, gates, weighted scores, regressions, agent states, and release certifications.
- **File Ownership**:
  - `packages/contract/src/schemas/quality-intelligence.schema.ts`
  - `packages/contract/src/schemas/quality-intelligence.schema.test.ts`
  - `packages/contract/src/index.ts`
  - `packages/contract/package.json` (if explicit subpath export needed)
- **TDD Test Cases (Red → Green)**:
  1. Domain weights schema rejects weight maps not summing to `100`.
  2. Rejects invalid SHA-256 digests, unknown agent states (outside the 8 states), and unknown certification statuses (outside the 6 statuses).
  3. Validates 10-requirement release checklist and pagination query schemas.
- **Acceptance Criteria**: `pnpm --filter @repo/contract build && pnpm --filter @repo/contract test && pnpm --filter @repo/contract type-check` passes.
- **Rollback Safety**: Additive schema module; no existing contracts altered.

---

## Stage 4 — `@repo/database` Append-Only Ledger Migration (`226`)

- **Goal**: Create PostgreSQL 17 migration `226_quality_intelligence_engine.sql` storing immutable quality runs, gate results, regressions, and release certifications.
- **File Ownership**:
  - `packages/database/migrations/226_quality_intelligence_engine.sql`
  - `packages/database/tests/quality-intelligence-migration.test.mjs` (or existing database test suite)
- **TDD Test Cases (Red → Green)**:
  1. Migration lint (`pnpm lint:migrations`) and `audit-rls-matrix.cjs` pass with zero unwrapped `auth.uid()` calls.
  2. `UPDATE` and `DELETE` statements on all 4 quality tables fail with immutability trigger exception.
  3. Non-privileged roles cannot `SELECT` cross-department/unauthorized rows or insert forged certification rows.
  4. `pnpm audit:drift` verifies 100% parity with `@repo/contract`.
- **Acceptance Criteria**: `pnpm --filter @repo/database test`, `pnpm lint:migrations`, `pnpm audit:rls-matrix`, and `pnpm audit:drift` all pass.
- **Rollback Safety**: Purely additive migration creating new tables only; zero mutations to existing operational tables.

---

## Stage 5 — `@repo/intelligence/quality` Core Pure Engines

- **Goal**: Implement pure, deterministic TypeScript engines for gate registry, scoring, regression diffing, agent verification, release certification, and secret redaction.
- **File Ownership**:
  - `packages/intelligence/src/quality/gate-registry.ts`
  - `packages/intelligence/src/quality/scoring-engine.ts`
  - `packages/intelligence/src/quality/regression-engine.ts`
  - `packages/intelligence/src/quality/agent-verifier.ts`
  - `packages/intelligence/src/quality/release-certifier.ts`
  - `packages/intelligence/src/quality/secret-redactor.ts`
  - `packages/intelligence/src/quality/index.ts`
  - `packages/intelligence/src/quality/*.test.ts`
  - `packages/intelligence/src/index.ts` & `packages/intelligence/package.json`
- **TDD Test Cases (Red → Green)**:
  1. `scoring-engine.test.ts`: verifies exact `20/20/15/15/10/10/5/5` weight math, `0` score on stubbed/skipped mandatory gates, and blocking floor detection.
  2. `regression-engine.test.ts`: detects newly introduced failures, score drops, and expired waivers against baseline.
  3. `agent-verifier.test.ts`: validates all 8 state transitions and rejects `CERTIFIED` if `git_tree_hash` mismatches or CI attestation is missing.
  4. `release-certifier.test.ts`: verifies all 6 statuses and all 10 mandatory requirements.
  5. `secret-redactor.test.ts`: confirms redaction of Supabase keys, JWTs, Postgres credentials, and Bearer tokens while preserving SHA-256 determinism.
- **Acceptance Criteria**: `pnpm --filter @repo/intelligence test && pnpm --filter @repo/intelligence type-check` passes with >= 95% branch coverage on `src/quality/`.
- **Rollback Safety**: Pure library additions under `packages/intelligence/src/quality/`.

---

## Stage 6 — Harden Broken & Non-Behavioral Audit Scripts

- **Goal**: Eliminate false positives, silent exit-0 stubs, `../Arch-Base` fallbacks, and regex-only checks across existing tooling.
- **File Ownership**:
  - `tools/scripts/token-tracker.cjs` (honor actual budget threshold exit codes when `--strict` or quality mode is passed, or explicitly mark advisory metadata without faking pass)
  - `tools/scripts/enforce-quality-gates.sh` (fail on unjustified `any` or retire redundant runner)
  - `tools/audits/audit-rls-matrix.cjs` & `tools/audits/audit-contract-drift.cjs` & `tools/audits/audit-rls.cjs` (remove `../Arch-Base` fallback; add column-level & legacy-policy reporting)
  - `tools/audits/audit-performance-budgets.cjs` & `tools/audits/audit-e2e-journeys.cjs` (parse real assertions/configs and record `STATIC_ONLY` vs `RUNTIME_EMPIRICAL` honestly)
  - `packages/eval/package.json` (replace `echo 0 skipped DeepEval gates` stub with real runner invocation or explicit `SKIPPED_UNCONFIGURED` status)
  - `tools/audits/*.test.*`
- **TDD Test Cases (Red → Green)**:
  1. Contract drift audit fails when a SQL column is missing from its corresponding Zod schema.
  2. Migration audits always target `packages/database/migrations` even if `../Arch-Base` exists.
  3. `eval` stub no longer reports false green.
- **Acceptance Criteria**: Updated audit unit tests pass; `pnpm policy:check` and `pnpm audit:drift` pass cleanly.
- **Rollback Safety**: Each audit change is modular and verified by unit fixtures before integration.

---

## Stage 7 — CLI Orchestrator (`tools/scripts/quality-orchestrator.mjs`)

- **Goal**: Build the unified CLI orchestrator powering `pnpm quality:run`, `quality:score`, `quality:diff`, `quality:certify`, and `quality:agent-verify`.
- **File Ownership**:
  - `tools/scripts/quality-orchestrator.mjs`
  - `tools/scripts/quality-orchestrator.test.mjs`
  - `package.json` (add `quality:*` scripts and `.ci-local` pruning)
- **TDD Test Cases (Red → Green)**:
  1. Dry-run fixture executes gate registry, redacts secrets, computes SHA-256 per-gate + chained `evidence_sha256`, and outputs schema-valid JSON.
  2. `quality:diff` exits non-zero when a new `CRITICAL`/`HIGH` regression appears relative to baseline fixture.
  3. `quality:certify` blocks release if any of the 10 mandatory requirements is `false`.
- **Acceptance Criteria**: `quality-orchestrator.test.mjs` passes; `pnpm quality:run --dry-run` produces valid manifest.
- **Rollback Safety**: Additive `quality:*` scripts; existing `pnpm agent:verify` remains intact until Stage 10.

---

## Stage 8 — Control Room API Routes & Dashboard UI

- **Goal**: Expose Quality Intelligence telemetry in Control Room with strict 8-step API security and light-mode OKLCH UI components.
- **File Ownership**:
  - `apps/portal/app/api/control-room/quality-intelligence/route.ts`
  - `apps/portal/app/api/control-room/quality-intelligence/[runId]/route.ts`
  - `apps/portal/app/api/control-room/quality-intelligence/route.test.ts`
  - `apps/portal/app/(departments)/control-room/quality-intelligence/page.tsx`
  - `apps/portal/app/(departments)/control-room/quality-intelligence/components/*`
  - `apps/portal/lib/cache-tags.ts` (add quality intelligence cache tag helper if needed)
- **TDD Test Cases (Red → Green)**:
  1. API route tests verify `401` unauthenticated, `403` unauthorized role, `429` rate limit, `200` for `admin`/`supervisor`/`operator`/`control_room_operator`, and redacted payload fields.
  2. Component tests verify rendering of 8 domain weight cards, 6 certification status badges, 10-requirement checklist, and empty/error states with zero `dark:` classes or raw hex colors.
- **Acceptance Criteria**: Portal `type-check`, `lint`, Jest route/UI tests, `audit:tokens`, `audit:tailwind`, and `audit:auth-matrix` pass.
- **Rollback Safety**: Self-contained new route & page; zero regressions to existing Control Room pages.

---

## Stage 9 — Consolidated GitHub Actions Workflow & Shadow Validation

- **Goal**: Introduce `.github/workflows/quality-intelligence.yml` (SHA-pinned actions, least-privilege permissions, unified execution) and run in parallel shadow mode alongside `ci.yml`.
- **File Ownership**:
  - `.github/workflows/quality-intelligence.yml`
  - `tools/scripts/quality-orchestrator.mjs` (CI persistence & GitHub Check summary writer)
- **TDD Test Cases (Red → Green)**:
  1. `audit:supply-chain` verifies all GitHub Actions in `quality-intelligence.yml` are pinned to 40-char commit SHAs with explicit `permissions:`.
  2. Shadow PR run executes `quality:run`, `quality:diff`, and `quality:certify`, persisting append-only evidence and uploading SHA-256 manifest artifact.
- **Acceptance Criteria**: `pnpm audit:supply-chain` passes; shadow workflow completes green on PR.
- **Rollback Safety**: Additive workflow; existing `ci.yml` continues enforcing required checks during shadow window.

---

## Stage 10 — Retire Redundant Workflows, Gatekeeper Bypass, & Final Verification

<!-- cspell:ignore dryrun -->

- **Goal**: Remove/archive obsolete mocked/duplicate workflows, eliminate local self-attested commit-status bypasses, standardize `PORTAL_URL` / `PORT` / `SUPABASE_SECRET_KEY` env vars, and promote `quality-intelligence.yml` as the authoritative CI check.
- **File Ownership**:
  - `.github/workflows/preview.yml`, `deploy-canary.yml`, `migration-dryrun.yml`, `test-report.yml`, `dast.yml`, `vercel-auto-deploy.yml`, `ga.yml`, `reviewdog.yml` (retire or fix & consolidate)
  - `tools/scripts/autonomous-ci-gatekeeper.mjs` & `.husky/pre-push` (remove forged/self-attested status publishing for `main` protection; enforce authentic tree verification)
  - `.env.example` (`PORT=3000`, canonical `SUPABASE_SECRET_KEY` guidance)
  - `AGENT_TRACER.md` (record final completion entry)
- **TDD Test Cases (Red → Green)**:
  1. `pnpm quality:run` + `pnpm quality:certify` passes on clean branch with zero mocked gates.
  2. `pnpm agent:verify` passes all gates without skipped mandatory checks.
  3. `pnpm audit:compliance` and `pnpm --filter portal build` pass.
- **Acceptance Criteria**: Full `pnpm agent:verify` passes; PR merges cleanly to `main` via remote CI checks without admin bypass.
- **Rollback Safety**: Each retired workflow is preserved in git history and can be restored individually if a downstream consumer requires it.
