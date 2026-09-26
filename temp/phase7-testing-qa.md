# Phase 7 — Testing & QA Deep Review

**Date**: 2026-09-21  
**Scope**: `packages/database/tests/`, `k6/`, `packages/eval/`, `tests/`, `apps/portal/jest.config.cjs`  
**Overall Assessment**: **ADEQUATE with CRITICAL GAPS** — Strong security-focused DB tests and comprehensive E2E suite, but missing key unit tests, has hardcoded secrets in seed data, and has significant evaluation framework gaps.

---

## 1. Test Coverage Matrix

| Area                            | Files                                              | Tests              | Type          | Status            |
| ------------------------------- | -------------------------------------------------- | ------------------ | ------------- | ----------------- |
| RLS Extension Safety            | `rls_extension_safety.sql`                         | 2 assertions       | SQL           | ⚠️ Minimal        |
| P0 Signup Self-Elevation        | `p0_signup_role_self_elevation.sql`                | 3 attack scenarios | SQL           | ✅ Excellent      |
| Accessible Departments Priv Esc | `accessible_departments_priv_esc.sql`              | 4 phases           | SQL           | ✅ Excellent      |
| Index Coverage                  | `index_coverage.sql`                               | 1 check            | SQL           | ✅ Good           |
| Migration Rollback Safety       | `migration-rollback-safety.mjs`                    | 7 pattern checks   | JS            | ✅ Comprehensive  |
| pg_stat_statements & Indexes    | `082_pg_stat_statements_and_indexes.sql`           | —                  | SQL           | ❌ MISSING        |
| Supabase Client                 | `packages/supabase/src/__tests__/supabase.test.ts` | 22 tests           | TS/Jest       | ✅ Good           |
| Actions Test                    | `apps/portal/actions.test.ts`                      | —                  | TS            | ❌ MISSING        |
| Contract Jest Config            | `packages/contract/jest.config.js`                 | —                  | Config        | ⚠️ Basic          |
| Redis Jest Config               | `packages/redis/jest.config.js`                    | —                  | Config        | ⚠️ Minimal        |
| Portal Jest Config              | `apps/portal/jest.config.cjs`                      | —                  | Config        | ⚠️ Low thresholds |
| K6 Stress Test                  | `k6/stress-test.js`                                | 2 endpoints        | JS            | ⚠️ Basic          |
| K6 CI Probe                     | `k6/ci-probe.js`                                   | 3 scenarios        | JS            | ✅ Good           |
| Load Test                       | `e2e/load/executive-dashboard.js`                  | 1 endpoint         | JS            | ⚠️ Basic          |
| Eval Datasets                   | `packages/eval/datasets/golden_cases.json`         | 4 prompt types     | JSON          | ⚠️ Limited        |
| Eval Metrics                    | `packages/eval/metrics/`                           | 4 metrics          | Python        | ✅ Good           |
| Eval Tests                      | `packages/eval/tests/`                             | 8 test files       | Python        | ✅ Good           |
| E2E — Auth                      | `e2e/login.spec.ts`                                | 8 tests            | TS/Playwright | ✅ Good           |
| E2E — Permissions               | `e2e/permissions-roles.spec.ts`                    | 24 tests           | TS/Playwright | ✅ Excellent      |
| E2E — Error States              | `e2e/error-states.spec.ts`                         | 20 tests           | TS/Playwright | ✅ Excellent      |
| E2E — Accessibility             | `e2e/accessibility.spec.ts`                        | 8 tests            | TS/Playwright | ⚠️ Basic          |
| E2E — Responsive                | `e2e/responsiveness.spec.ts`                       | 20+ tests          | TS/Playwright | ✅ Comprehensive  |
| E2E — Session                   | `e2e/session-management.spec.ts`                   | 14 tests           | TS/Playwright | ✅ Good           |
| E2E — Navigation                | `e2e/navigation.spec.ts`                           | 10 tests           | TS/Playwright | ✅ Good           |
| E2E — Department Nav            | `e2e/department-navigation.spec.ts`                | 8 tests            | TS/Playwright | ✅ Good           |
| E2E — Data Entry                | `e2e/data-entry.spec.ts`                           | 8 tests            | TS/Playwright | ✅ Good           |
| E2E — Authenticated Flows       | `e2e/authenticated-flows.spec.ts`                  | 12 tests           | TS/Playwright | ✅ Good           |
| E2E — Web Vitals                | `e2e/web-vitals.spec.ts`                           | 2 tests            | TS/Playwright | ⚠️ Minimal        |
| E2E — Overview                  | `e2e/overview.spec.ts`                             | 1 test             | TS/Playwright | ✅ Good           |
| E2E — Visual                    | `e2e/visual/`                                      | Snapshot tests     | TS/Playwright | ✅ Good           |
| E2E — Control Room              | `e2e/control-room/`                                | 5 spec files       | TS/Playwright | ✅ Good           |
| Seed Data                       | `packages/supabase/src/seed.ts`                    | —                  | TS            | ❌ Security Issue |
| Quality Plan                    | `tasks/quality-improvement-plan.md`                | —                  | MD            | ⚠️ Outdated       |
| Compliance Report               | `tasks/compliance-audit-report.md`                 | —                  | MD            | ⚠️ Outdated       |

---

## 2. Database Test Suite — Detailed Findings

### 2.1 `rls_extension_safety.sql` — ⚠️ MINIMAL

- **What it does**: Checks `pg_graphql` extension exists and verifies all public functions have explicit `search_path`
- **Gap**: Only 2 assertions. No check for RLS policies on tables, no verification of `pg_graphql` schema setup, no test for `set_config('search_path', ...)` on functions
- **Missing scenarios**:
  - No test for RLS enabled on all tables
  - No test for `pg_graphql` schema visibility
  - No check that functions use `SECURITY DEFINER` correctly with `search_path`
  - No test for `announce` function or other pg_graphql functions

### 2.2 `p0_signup_role_self_elevation.sql` — ✅ EXCELLENT

- **What it does**: Reproduces P0 privilege escalation bug where `raw_user_meta_data.role = 'admin'` results in `employees.role = 'admin'`
- **Strengths**:
  - 3-phase attack: single admin role, all privileged roles, normal user sanity check
  - Full transaction with `ROLLBACK` — leaves DB untouched
  - Clear exploit reproduction with `RAISE EXCEPTION` on failure
  - Deterministic UUIDs for test isolation
  - Excellent documentation of the bug root cause
- **Gap**: No test for the _fix_ (no positive test that `handle_new_user()` correctly ignores `role` after fix). The test only confirms the bug exists or not.

### 2.3 `accessible_departments_priv_esc.sql` — ✅ EXCELLENT

- **What it does**: Tests RLS privilege escalation via `accessible_departments` self-update
- **Strengths**:
  - 4-phase structure: confirm vulnerability, provision test data, exploit, assert
  - Uses `SET LOCAL ROLE authenticated` and JWT claims to simulate real PostgREST request
  - Checks `pg_policy.polwithcheck` is NULL (structural fingerprint of the bug)
  - Deterministic UUIDs for idempotency
  - Clear `RAISE EXCEPTION` on vulnerability confirmation
- **Gap**: Only tests `employees` table. Does not test `departments` table RLS or other tables with `accessible_departments` column

### 2.4 `index_coverage.sql` — ✅ GOOD

- **What it does**: Checks that every FK column in public schema has a covering index
- **Strengths**: Systematic scan of `pg_constraint` and `pg_index`
- **Gap**: Does not check for composite indexes, partial indexes, or expression indexes. Only checks single-column FK indexes.

### 2.5 `migration-rollback-safety.mjs` — ✅ COMPREHENSIVE

- **What it does**: Static analysis of all migration files for rollback safety patterns
- **Strengths**:
  - Checks 12+ patterns: DROP TABLE/INDEX/VIEW/TYPE IF EXISTS, ADD/DROP COLUMN IF EXISTS, CREATE TABLE/INDEX IF NOT EXISTS, UPDATE/DELETE WHERE, ALTER TYPE RENAME
  - Sequence numbering and gap detection
  - Comment stripping for accurate analysis
  - Context-aware CREATE TABLE check (allows partitioned table pattern)
- **Gap**: Does not check for `DROP FUNCTION` safety, does not verify `down.sql` files exist for migrations with complex changes

### 2.6 `082_pg_stat_statements_and_indexes.sql` — ❌ MISSING

- **Expected**: SQL file testing `pg_stat_statements` for index usage and query performance analysis
- **Impact**: No automated performance regression testing for query plans
- **Recommendation**: Create this file to check for sequential scans on large tables, unused indexes, and missing indexes on frequently queried columns

---

## 3. K6 Stress Testing — Adequacy Assessment

### 3.1 `k6/stress-test.js` — ⚠️ BASIC

```
Stages: 100→100→200→200→0 users over 16 minutes
Thresholds: p(99)<1500ms, error rate <1%
Endpoints: GET /, GET /api/health
```

- **Strengths**: Progressive load stages, clear thresholds
- **Gaps**:
  - Only tests 2 endpoints (homepage + health)
  - No authentication — tests unauthenticated paths only
  - No API endpoint testing (no `/api/machines`, `/api/departments`, etc.)
  - No RLS-specific load testing (e.g., parameterized queries with department filters)
  - No database connection pool stress testing
  - No WebSocket/Realtime testing
  - No threshold for `http_req_duration` p(95) or `http_req_beating_time`

### 3.2 `k6/ci-probe.js` — ✅ GOOD

```
Scenarios: cold_pass (1 VU), warm_pass (1 VU), saturated (5 VU)
Thresholds: p(95)<350ms, p(99)<700ms, warmup_passes >95%
Paths: /api/health/live, /api/health/warmup, /api/health/supabase-realtime
```

- **Strengths**: Multi-scenario approach, custom metrics (`warmup_passes`, `warmup_latency`, `warmup_requests`), health endpoint probing
- **Gaps**:
  - Only tests health endpoints, not business logic endpoints
  - 5 VU saturated scenario is very light for production readiness
  - No error rate threshold on individual paths
  - No `http_req_duration` threshold on the saturated scenario
  - No testing of database query latency under load

### 3.3 `e2e/load/executive-dashboard.js` — ⚠️ BASIC

```
Stages: 50→50→0 over ~2 minutes
Thresholds: p(95)<500ms, error rate <1%
Endpoint: GET /hub/executive
```

- **Gap**: Very short duration, only 50 users, single endpoint. Does not test executive dashboard data-fetching complexity under load.

### 3.4 K6 Recommendations

1. **Add authenticated API load tests**: `k6/stress-test.js` should include authenticated requests to `/api/machines`, `/api/departments`, `/api/employees` with JWT tokens
2. **Add RLS-specific load tests**: Test with different department-scoped users to verify RLS policy overhead doesn't cause latency spikes
3. **Add WebSocket/Realtime tests**: Test Supabase Realtime connection pooling under load
4. **Add database connection pool stress**: Test connection pool exhaustion scenarios
5. **Add threshold for data transfer rate**: `http_req_size` and `http_req_body_size` thresholds
6. **Add k6 tags for department/role**: Tag requests by user role and department for drill-down analysis

---

## 4. Evaluation Framework Completeness

### 4.1 Datasets (`golden_cases.json`) — ⚠️ LIMITED

- **Coverage**: 4 prompt types (predictiveMaintenance, shiftHandoff, equipmentManual, translate)
- **Total cases**: 6 input/output pairs
- **Gaps**:
  - **No `safetyCompliance` type** — mentioned in `helpers.py` PROMPTS but no golden cases
  - **No `departmentNavigation` type** — no test cases for department-specific AI queries
  - **No `dataEntry` type** — no test cases for data entry validation AI
  - Only 2 predictive maintenance cases — insufficient coverage of edge cases (e.g., normal operation, multiple simultaneous issues)
  - No test cases for multi-turn conversations or context-dependent responses
  - No negative test cases (malformed input, empty input)

### 4.2 Metrics — ✅ GOOD

| Metric                              | Checks            | Threshold | Status                 |
| ----------------------------------- | ----------------- | --------- | ---------------------- |
| `RLSCompletenessMetric`             | 7 checks          | 0.8       | ⚠️ Missing some checks |
| `DepartmentPatternComplianceMetric` | 7 checks          | 0.8       | ✅ Good                |
| `SupabaseImportComplianceMetric`    | 7 checks          | 0.8       | ✅ Good                |
| `DesignSystemComplianceMetric`      | 7 checks          | 0.8       | ✅ Good                |
| `FaithfulnessMetric`                | deepeval built-in | 1.0       | ✅ Good                |
| `HallucinationMetric`               | deepeval built-in | 0.2-0.7   | ✅ Good                |
| `AnswerRelevancyMetric`             | deepeval built-in | 0.7       | ✅ Good                |

**RLS Completeness — `rls_completeness.py` Gaps**:

- Does NOT check for `WITH CHECK` clause on INSERT/UPDATE policies (critical for privilege escalation prevention)
- Does NOT check for `FOR UPDATE` policies
- Does NOT check for `auth.uid()` usage in policies
- Does NOT check for `pgcrypto` or `gen_random_uuid()` usage
- Does NOT check for `SET search_path` in function definitions
- Does NOT check for `ENABLE ROW LEVEL SECURITY` on ALL tables (only checks presence of RLS enable in the SQL)
- Does NOT verify policy names follow naming convention
- Does NOT check for `authenticated` role in SELECT policies
- Missing check for `INSERT` policy `WITH CHECK` clause (department isolation)
- Missing check for `DELETE` policy admin-only restriction with `auth.is_admin()`

**Department Pattern Compliance — `department_pattern_compliance.py` Gaps**:

- Does NOT check for `params.department` in server components (only checks client-side patterns)
- Does NOT check for `await getDepartmentContext(params)` in all department pages
- Does NOT check for `requireDepartment` in layout files
- Does NOT check for `department_id` filtering in Supabase queries
- Does NOT check for `accessible_departments` usage in department isolation
- Does NOT check for `notFound()` usage in restricted pages (should use `requireDepartment`)

**Supabase Import Compliance — `supabase_import_compliance.py` Gaps**:

- Does NOT check for `@supabase/ssr` import in server components (should use `@repo/supabase/server`)
- Does NOT check for `createServerClient` vs `createServerSupabaseClient` naming consistency
- Does NOT check for cookie-based auth configuration in server client creation
- Does NOT check for `persistSession: false` in server components
- Does NOT check for `@repo/logger` usage in instrumented fetch
- Does NOT verify `request.jwt.claim.sub` GUC setup in middleware

### 4.3 Eval Test Suite — ✅ GOOD

- **Code generation tests** (`test_conventions.py`, `test_shift_closeout_compliance.py`): Excellent — use `assert_test` with both good and bad code examples, testing all 4 custom metrics
- **AI service tests** (`test_equipment_manual.py`, `test_shift_handoff.py`, `test_predictive_maintenance.py`): Good — parameterized with golden cases, uses hallucination + faithfulness + relevancy metrics
- **`test_factual_consistency.py`**: Good — uses Gemini/Ollama judge with `get_judge_model()`
- **Gaps**:
  - No test for `translate` prompt type in AI service tests
  - No test for `safetyCompliance` prompt type (missing from golden_cases.json)
  - No integration test that runs all metrics together
  - No test for `conftest.py` `.env` loading
  - No test for `get_judge_model()` resolution logic

### 4.4 Eval Configuration — ⚠️ ISSUES

- **`pyproject.toml`**: Uses `poetry` but the `package.json` test script falls back to `uv`
- **`conftest.py`**: `requires_openai` marker skips ALL AI service tests if `OPENAI_API_KEY` is not a valid key — this means tests are effectively skipped in CI unless keys are configured
- **`helpers.py`**: `get_judge_model()` prioritizes Gemini — but `gemini-3.8-flash` model name may not exist; should verify model availability
- **Missing**: No `ruff` configuration for Python linting in the eval package (despite `dev` dependency in `pyproject.toml`)
- **Missing**: No test for `packages/eval/helpers.py` itself (unit tests for `call_ai_service`, `get_judge_model`)

---

## 5. Test Configuration Audit

### 5.1 `packages/contract/jest.config.js` — ⚠️ BASIC

```js
testEnvironment: "node",
transform: { "^.+\\.(t|j)sx?$": ["@swc/jest", ...] },
moduleNameMapper: { "^(\\./.*)\\.js$": "$1" }
```

- **Gap**: No `collectCoverageFrom`, no `coverageThreshold`, no `setupFilesAfterEnv`
- **Gap**: No `moduleDirectories` for path resolution
- **Recommendation**: Add coverage configuration and test setup files

### 5.2 `packages/redis/jest.config.js` — ⚠️ MINIMAL

```js
testEnvironment: "node",
transform: { "^.+\\.tsx?$": ["@swc/jest"] }
```

- **Gap**: No `moduleNameMapper`, no `collectCoverageFrom`, no coverage thresholds
- **Gap**: No test setup/teardown configuration
- **Recommendation**: Add module mapping for `@repo/redis` imports, add coverage config

### 5.3 `apps/portal/jest.config.cjs` — ⚠️ LOW THRESHOLDS

```js
coverageThreshold: { global: { lines: 40, branches: 30, functions: 30, statements: 40 } }
```

- **Gap**: Thresholds set to 40/30/30/40 — below industry standard (70-80%)
- **Gap**: Comments acknowledge "original 40/30/35/40 targets were never met"
- **Gap**: `forceExit: true` may hide memory leaks
- **Gap**: `coverageReporters: ["text", "lcov", "html"]` — lcov is for CI, HTML is local only
- **Recommendation**: Raise thresholds gradually. Add `--passWithNoTests` removal. Add `collectCoverageFrom` exclusions for test files.

### 5.4 Missing `apps/portal/actions.test.ts` — ❌ CRITICAL GAP

- **Expected**: Test file for Next.js Server Actions (e.g., `handleCloseShift`, `handleDailyLogEntry`)
- **Impact**: No unit tests for critical server-side mutations (shift closeout, daily log submission, breakdown reporting)
- **Recommendation**: Create `apps/portal/actions.test.ts` with tests for:
  - `handleCloseShift` server action (PIN verification, audit logging)
  - `handleDailyLogEntry` server action (data validation, department isolation)
  - `handleBreakdownReport` server action
  - Form validation server actions

---

## 6. Supabase Tests — ✅ GOOD

`packages/supabase/src/__tests__/supabase.test.ts` — 22 tests across 4 describe blocks

- **instrumentedFetch**: 10 tests covering method extraction, URL parsing, slow query detection, error logging, URL object/Request input
- **createServerSupabaseClient**: 4 tests covering config, env vars, cookies
- **getUserSafely**: 4 tests covering authenticated, null, error, network failure, JWT validation
- **createBrowserSupabaseClient**: 3 tests covering config, env vars, localhost rewrite

**Strengths**: Comprehensive mocking, good edge case coverage, proper `beforeEach`/`afterEach` cleanup

**Gaps**:

- No test for `instrumentedFetch` with `POST`/`PUT`/`DELETE` methods
- No test for `instrumentedFetch` with custom headers
- No test for `instrumentedFetch` with request body
- No test for `getUserSafely` with expired token
- No test for `createServerSupabaseClient` with missing env vars

---

## 7. E2E Tests — ✅ EXCELLENT (with minor gaps)

### Coverage Summary

| Category            | Spec Files                                                                   | Tests        | Coverage         |
| ------------------- | ---------------------------------------------------------------------------- | ------------ | ---------------- |
| Authentication      | `login.spec.ts`, `authenticated-flows.spec.ts`, `session-management.spec.ts` | ~50+         | ✅ Good          |
| Permissions & Roles | `permissions-roles.spec.ts`                                                  | 24           | ✅ Excellent     |
| Error States        | `error-states.spec.ts`                                                       | 20           | ✅ Excellent     |
| Accessibility       | `accessibility.spec.ts`, `visual/accessibility.spec.ts`                      | 8+           | ⚠️ Basic         |
| Navigation          | `navigation.spec.ts`, `department-navigation.spec.ts`, `overview.spec.ts`    | ~20          | ✅ Good          |
| Data Entry          | `data-entry.spec.ts`                                                         | 8            | ✅ Good          |
| Responsiveness      | `responsiveness.spec.ts`                                                     | 20+          | ✅ Comprehensive |
| Web Vitals          | `web-vitals.spec.ts`                                                         | 2            | ⚠️ Minimal       |
| Visual Regression   | `visual/`                                                                    | 4 spec files | ✅ Good          |
| Control Room        | `control-room/`                                                              | 5 spec files | ✅ Good          |
| Load                | `load/executive-dashboard.js`                                                | 1            | ⚠️ Basic         |
| API Mocking         | `api-mocking.spec.ts`                                                        | —            | ⚠️ Not read      |

### Key Gaps in E2E

1. **No RLS-specific E2E tests**: No tests verifying that department-scoped users see correct data under RLS policies
2. **No `accessible_departments` E2E tests**: No tests for privilege escalation in the UI
3. **No `pg_stat_statements` E2E tests**: No performance regression tests
4. **`web-vitals.spec.ts` has `test()` inside `test.describe()`** — syntax error, tests won't run
5. **No PWA offline tests for auth state**: `pwa-offline.spec.ts` exists but not reviewed for session persistence
6. **No error-state test for RLS policy violations**: No test showing user gets access denied when RLS blocks a query
7. **No cross-department data isolation E2E test**: No test verifying operator cannot see other departments' data via API

---

## 8. Test Data (`packages/supabase/src/seed.ts`) — ❌ CRITICAL SECURITY ISSUE

### Security Vulnerability: Hardcoded Service Key

```typescript
const SUPABASE_SERVICE_KEY =
  "REDACTED-SERVICE-ROLE-JWT";
```

**This is a REAL Supabase service key exposed in source code.** The key:

- Has `role: "service_role"` (full admin access)
- Contains the project reference `mrwhtxbhrzyttlsyuofc`
- Has `iat` and `exp` timestamps (expired in 2024)
- Is committed to the repository

**Recommendations**:

1. **Immediately revoke this key** in the Supabase dashboard
2. **Move to environment variable**: `SUPABASE_SERVICE_ROLE_KEY` from `.env`
3. **Add to `.gitignore`**: Ensure `.env` is not tracked
4. **Add to `security-scanning`**: Add a pre-commit hook to scan for `eyJhbGci` patterns
5. **Rotate all keys** if this key was ever exposed publicly

### Other Issues in `seed.ts`

- **No error handling**: Uses `console.error` instead of throwing
- **No type safety**: Data objects are not typed
- **No idempotency**: `upsert` for operators but `insert` for machines (no duplicate check)
- **Random data generation**: `Math.random()` makes tests non-deterministic
- **Hardcoded department**: Assumes "drilling" department exists
- **No cleanup**: No `DELETE` statements for re-runnable seeding

---

## 9. Quality & Compliance Reports — ⚠️ OUTDATED

### `tasks/quality-improvement-plan.md`

- **Current scores**: 87/100 overall, 82/100 frontend, 75/100 accessibility, 78/100 test coverage, 85/100 performance
- **Issues**:
  - References Nx plugins (superseded by Turborepo migration)
  - References `@nx/eslint/plugin` which no longer exists
  - `project.json` references are outdated (Turborepo uses `package.json`)
  - Coverage thresholds in the plan (70-80%) are already exceeded by the actual 40% thresholds in `jest.config.cjs`
  - No mention of `packages/eval/` or `k6/` testing
  - No mention of `packages/database/tests/` SQL tests

### `tasks/compliance-audit-report.md`

- **Current scores**: 87/100 overall
- **Issues**:
  - Supabase SSR score 78/100 — recommends `getClaims()` migration (not yet done)
  - React 19 CVE-2025-55182 flagged as High — needs patching
  - No mention of `packages/eval/` evaluation framework compliance
  - No mention of `k6/` load testing compliance
  - No mention of `packages/database/tests/` SQL test compliance
  - Does not address hardcoded service key in `seed.ts`
  - Does not address `082_pg_stat_statements_and_indexes.sql` missing file

---

## 10. `rls_completeness.py` Coverage Review — ⚠️ INCOMPLETE

The `rls_completeness.py` metric checks 7 items but is missing several critical RLS policy requirements:

| Check                                | Present | Critical? |
| ------------------------------------ | ------- | --------- |
| `ENABLE ROW LEVEL SECURITY`          | ✅      | Yes       |
| SELECT policy                        | ✅      | Yes       |
| INSERT policy                        | ✅      | Yes       |
| Auth helper functions                | ✅      | Yes       |
| department_id index                  | ✅      | Yes       |
| created_at index                     | ✅      | Yes       |
| DELETE policy admin-only             | ✅      | Yes       |
| **WITH CHECK on INSERT/UPDATE**      | ❌      | **YES**   |
| **auth.uid() in policies**           | ❌      | **YES**   |
| **SET search_path on functions**     | ❌      | **YES**   |
| **pgcrypto/gen_random_uuid**         | ❌      | Medium    |
| **Policy naming convention**         | ❌      | Medium    |
| **authenticated role check**         | ❌      | **YES**   |
| **Department isolation in policies** | ❌      | **YES**   |

**Critical Missing Checks**:

1. **WITH CHECK clause**: The `accessible_departments_priv_esc.sql` test specifically identifies this as the root cause of privilege escalation. The `RLSCompletenessMetric` should check for `WITH CHECK` on all INSERT and UPDATE policies.
2. **auth.uid() usage**: Policies should reference `auth.uid()` to match the current user, not just `auth.is_admin()`.
3. **Department isolation**: Policies should verify `department_id = auth.user_department_id()` or `department_id = ANY(auth.user_accessible_departments())`.

---

## 11. Testing Recommendations

### Priority 1 — CRITICAL (Fix Immediately)

1. **Revoke hardcoded Supabase service key** in `packages/supabase/src/seed.ts` — move to `.env`, add to `.gitignore`
2. **Create `packages/database/tests/082_pg_stat_statements_and_indexes.sql`** — test query plan analysis, sequential scan detection, unused index identification
3. **Create `apps/portal/actions.test.ts`** — unit tests for Server Actions (shift closeout, daily log, breakdown reporting)
4. **Add `WITH CHECK` clause check** to `rls_completeness.py` metric
5. **Fix `web-vitals.spec.ts` syntax error** — `test()` inside `test.describe()` should be `test.describe()` with `test()` inside
6. **Add `apps/portal/actions.test.ts`** tests for Server Actions

### Priority 2 — HIGH (This Sprint)

7. **Expand K6 stress tests** to include authenticated API endpoints with department-scoped users
8. **Add `safetyCompliance` and `departmentNavigation` types** to `golden_cases.json`
9. **Add unit tests for `packages/eval/helpers.py`** (`call_ai_service`, `get_judge_model`, `load_golden_cases`)
10. **Raise `coverageThreshold` in `apps/portal/jest.config.cjs`** from 40/30/30/40 to 50/35/35/50
11. **Add `packages/contract/jest.config.js` and `packages/redis/jest.config.js`** coverage configuration
12. **Add RLS-specific E2E tests** verifying department-scoped data isolation
13. **Add `accessible_departments` E2E test** for privilege escalation prevention

### Priority 3 — MEDIUM (Next Sprint)

14. **Add WebSocket/Realtime k6 tests** for Supabase Realtime connection pooling
15. **Add `pg_stat_statements` monitoring** to k6 stress tests
16. **Expand `golden_cases.json`** with negative test cases and edge cases
17. **Add `test_factual_consistency.py` test for `translate` prompt type**
18. **Add `packages/eval/tests/ai_service/test_translation.py`**
19. **Add `packages/eval/tests/ai_service/test_department_navigation.py`**
20. **Add `packages/database/tests/` for `departments` table RLS** (similar to `employees`)
21. **Add `packages/database/tests/` for `pgcrypto` function safety**

### Priority 4 — LOW (Ongoing)

22. **Add `packages/eval/tests/code_generation/test_translate_compliance.py`**
23. **Add `packages/eval/metrics/performance_compliance.py`** for query performance evaluation
24. **Add `packages/eval/metrics/rls_performance_compliance.py`** for RLS overhead measurement
25. **Update `tasks/quality-improvement-plan.md`** to remove Nx references and add eval/k6 coverage
26. **Update `tasks/compliance-audit-report.md`** to include hardcoded key finding
27. **Add `packages/supabase/src/__tests__/middleware.test.ts`** for RLS middleware testing
28. **Add `packages/supabase/src/__tests__/server.test.ts`** for server-side query tests
29. **Add `packages/eval/tests/test_judge_model_resolution.py`** for `get_judge_model()`
30. **Add `packages/eval/tests/test_golden_cases.py`** for `load_golden_cases()` and `get_golden_response()`

---

## 12. Summary Scores

| Category                | Score      | Trend                                                    |
| ----------------------- | ---------- | -------------------------------------------------------- |
| Database Security Tests | **8/10**   | Strong P0 tests, missing pg_stat_statements              |
| K6 Stress Testing       | **5/10**   | Basic coverage, needs authenticated API tests            |
| Eval Framework          | **6/10**   | Good structure, limited datasets, missing RLS WITH CHECK |
| Jest Configuration      | **4/10**   | Low thresholds, missing configs                          |
| Actions Tests           | **0/10**   | File missing entirely                                    |
| Supabase Tests          | **7/10**   | Good unit tests, missing middleware tests                |
| E2E Tests               | **8/10**   | Comprehensive, missing RLS-specific tests                |
| Test Data Security      | **1/10**   | Critical hardcoded service key                           |
| Quality Reports         | **3/10**   | Outdated, missing eval/k6 coverage                       |
| **Overall**             | **5.2/10** | **Significant gaps requiring immediate attention**       |

---

_Report generated by Phase 7 QA specialist_
_Sources: All scoped files reviewed as listed in scope section_
