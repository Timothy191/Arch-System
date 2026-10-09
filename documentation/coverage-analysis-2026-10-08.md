# Test Coverage Analysis - October 8, 2026

## Executive Summary

**Overall Status**: Portal test suite shows **high test count** (996 passing tests) but **fails global coverage thresholds**.

### Coverage Metrics (Portal App)

| Metric       | Current | Threshold | Status |
|--------------|---------|-----------|--------|
| Statements   | ~40%+   | 40%       | ✅ PASS |
| Branches     | 28.58%  | 30%       | ❌ FAIL |
| Functions    | 25.89%  | 30%       | ❌ FAIL |
| Lines        | ~40%+   | 40%       | ✅ PASS |

**Test Suite Health**: 145 passed, 1 skipped (146 total), 996 test cases

---

## Critical Coverage Gaps

### 🔴 High-Priority Areas (Need 90%+ Coverage)

#### 1. Server Actions (Security Critical)
- `lib/actions/shift-closeout.ts`: **64.15%** statements, **38.23%** branches
  - Missing coverage lines: 37-47, 70, 88-91, 125-154, 174-175
  - **Risk**: Authentication, authorization, validation gaps
  - **Priority**: CRITICAL - handles atomic shift closeout mutations

#### 2. RLS & Auth Helpers
- `lib/employee.ts`: **75%** statements, **50%** branches
  - **Risk**: Employee role resolution, department permissions
  - **Priority**: HIGH

#### 3. Core Business Logic
- `lib/shift-closeout.ts`: **71.75%** statements, **67.74%** branches, **62.5%** functions
  - Missing: Lines 31-44, 68-78, 85-86, 100-110, 123, 153-154, 170, 183-184, 206-208, 216-227, 286, 381-387, 414-415, 456-457
  - **Risk**: Data integrity, shift validation, completeness checks
  - **Priority**: HIGH

- `lib/shift-completeness.ts`: **88.29%** statements (better coverage)
  - Missing: Lines 45, 233, 236, 249-251, 271-272, 280, 285
  - **Priority**: MEDIUM

#### 4. Rate Limiting & API Security
- `lib/api/rate-limit-middleware.ts`: **77.77%** statements, **74.19%** branches, **70.58%** functions
  - Missing: Lines 19-37, 58-60, 124, 151, 191, 261-269
  - **Risk**: DoS protection gaps
  - **Priority**: HIGH

---

## 🟡 Medium-Priority Gaps

### Integration & Services
- `lib/integrations/crypto.ts`: **0%** coverage (Lines 15-54)
  - **Note**: Crypto utilities should be 100% tested
  - **Priority**: MEDIUM-HIGH

- `lib/integrations/mcp-client-manager.ts`: **0%** coverage (Lines 17-170)
  - **Priority**: MEDIUM

- `lib/integrations/service.ts`: **0%** coverage (Lines 48-502)
  - **Priority**: MEDIUM

### Background Jobs (Partial Coverage)
- `lib/jobs/autonomous-scada-simulation.ts`: **26.08%** statements
- `lib/jobs/machine-breakdown-notification.ts`: **33.33%** statements
- `lib/jobs/outbox-drain.ts`: **15.9%** statements
- `lib/jobs/shift-closeout-report.ts`: **17.07%** statements
- `lib/jobs/workflow-runner.ts`: **0%** coverage

**Note**: Background jobs can tolerate lower coverage but need smoke tests.

### Observability
- `lib/observability/client-telemetry.ts`: **0%** coverage
- `lib/observability/metrics.ts`: **0%** coverage
- `lib/observability/tracing.ts`: **75%** statements, **25%** branches

---

## ✅ Well-Covered Areas

### Excellent Coverage (90%+)
- `lib/cache-utils.ts`: **100%**
- `lib/audit.ts`: **100%**
- `lib/dept-context.ts`: **100%**
- `lib/production-reconciliation.ts`: **100%**
- `lib/tools.ts`: **100%**
- `lib/weather-api.ts`: **100%**
- `lib/env.ts`: **100%**
- `lib/api/cors.ts`: **100%**
- `lib/errors/error-classes.ts`: **96.47%**
- `lib/errors/error-logger.ts`: **97.67%**
- `lib/observability/simple-metrics.ts`: **100%**
- `lib/observability/speed-insights.ts`: **91.89%**
- `lib/reports/shift-integrity.ts`: **93.42%**
- `server/proxy.ts`: **86.92%** (Edge middleware - critical and well-tested)

### Good Coverage (70-89%)
- `lib/ai/chunking.ts`: **94.26%**
- `lib/shift-completeness.ts`: **88.29%**
- `hooks/useFormDraft.ts`: **86.79%**
- `lib/sync/sync-queue.ts`: **88.63%**
- `lib/api/rate-limit-config.ts`: **82.35%**

---

## Recommended Action Plan

### Phase 1: Critical Security Coverage (Week 1-2)
**Goal**: Bring Server Actions, Auth, RLS to 90%+

1. **Server Actions**
   ```bash
   # Focus test files
   apps/portal/app/(departments)/[department]/hourly-loads/actions.test.ts
   apps/portal/app/(departments)/access-control/card-actions/actions.test.ts
   apps/portal/app/(departments)/drilling/drilling-operations/actions.test.ts
   apps/portal/lib/actions/shift-closeout.ts (add more test cases)
   ```

2. **Auth & Employee Context**
   - Add edge case tests for `lib/employee.ts`
   - Test all role/department resolution paths
   - Validate RLS policy enforcement

3. **Rate Limiting**
   - Test rate limit bypass scenarios
   - Validate sliding window/token bucket strategies
   - Test Redis fallback to memory store

### Phase 2: Core Business Logic (Week 3-4)
**Goal**: Shift closeout, completeness, SCADA to 85%+

1. **Shift Closeout Pipeline**
   - Add integration tests for atomic RPC
   - Test idempotency with SHA-256 payload
   - Validate cache invalidation

2. **SCADA & Telemetry**
   - Test real-time streaming edge cases
   - Validate offline queue behavior
   - Test pit connectivity degradation

### Phase 3: Integration & Jobs (Week 5-6)
**Goal**: Background jobs to 60%+, integrations to 70%+

1. **Crypto Utilities** (should be 100%)
   - Test all encryption/hashing functions
   - Validate key derivation

2. **Background Jobs**
   - Add smoke tests for all Inngest jobs
   - Test retry logic and error handling
   - Validate outbox drain patterns

### Phase 4: Observability & Monitoring (Week 7-8)
**Goal**: Telemetry to 80%+

1. **OpenTelemetry Integration**
   - Test span creation and propagation
   - Validate metrics collection

2. **Client Telemetry**
   - Test browser telemetry capture
   - Validate Web Vitals reporting

---

## Quick Wins (Can Do Now)

1. **Add crypto utility tests** (0% → 100% possible in 1 day)
2. **Increase rate-limit coverage** (77% → 90% with edge cases)
3. **Cover error logger branches** (97.67% → 100%)
4. **Test feature flags** (0% → 100% - simple boolean logic)
5. **Hub departments** (0% → 80% - static data)

---

## Test Execution Commands

```bash
# Run all tests with coverage
pnpm --filter portal test -- --coverage

# Run specific test file
pnpm --filter portal test -- --testPathPattern="shift-closeout"

# Run tests for changed files only
pnpm turbo run test --filter=...[HEAD~1]

# Watch mode for TDD
pnpm --filter portal test -- --watch

# Generate HTML coverage report
pnpm --filter portal test -- --coverage --coverageReporters=html
# View: apps/portal/coverage/lcov-report/index.html
```

---

## Coverage Thresholds to Adjust

Current `jest.config.cjs` thresholds are failing. Two options:

### Option A: Fix Coverage (Recommended)
Bring branches to 30%+ and functions to 30%+ through targeted test additions.

### Option B: Adjust Thresholds (Tactical)
Temporarily lower thresholds while working toward strategic 90% for critical paths:

```javascript
// apps/portal/jest.config.cjs
coverageThreshold: {
  global: {
    statements: 40,
    branches: 28,      // Temporarily accept current
    functions: 25,     // Temporarily accept current
    lines: 40,
  },
  // Add strategic high-water marks
  './lib/actions/**/*.ts': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },
  './lib/employee.ts': {
    statements: 90,
    branches: 90,
    functions: 100,
    lines: 90,
  },
  './server/proxy.ts': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },
}
```

---

## Monitoring & Automation

### Set Up Coverage Tracking
```bash
# Add to .github/workflows or CI
pnpm test:coverage
pnpm bundlesize

# Upload to Codecov or similar
# Set PR comment bot to block <30% branch/function coverage
```

### Pre-commit Hook
```bash
# In .husky/pre-commit
pnpm turbo run test --filter=...[HEAD] -- --coverage --passWithNoTests
```

---

## Conclusion

**Current State**: Good test discipline (996 tests), but coverage gaps in critical security paths.

**Target State**: 90%+ on Server Actions, Auth, RLS; 70%+ overall.

**Estimated Effort**: 6-8 weeks of focused test development (1-2 devs).

**Quick Win ROI**: Crypto utilities, feature flags, rate-limit edge cases can improve metrics within 1 week.

---

**Next Steps**:
1. Prioritize Server Actions test expansion
2. Add auth/employee edge cases
3. Set up coverage tracking in CI
4. Document test patterns in `apps/portal/TESTING.md`

