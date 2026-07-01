---
title: Test Coverage — Deep Dive
created: 2026-05-15
updated: 2026-06-15
type: summary
tags: [quality, metrics, breakdown]
confidence: high
---

# Test Coverage — Deep Dive

**Metric**: Test Coverage | **Score**: 7.2/10 | **Trend**: ↑↑ (up from ~3.0) | **Target**: 9.0/10

---

## Current Score

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TEST COVERAGE SCORECARD                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Overall          ████████████████████████████░░░░░░░░░░░░  7.2/10     │
│                                                                         │
│  Unit Tests       ████████████████████████████████████░░░░   8.5/10 🟢 │
│  E2E Tests        ████████████████████████████████████░░░░   8.5/10 🟢 │
│  Line Coverage    ████████████████░░░░░░░░░░░░░░░░░░░░░░░░   4.0/10 🟡 │
│  Branch Coverage  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░   3.1/10 🔴 │
│  Load Testing     ████████████████████████████████████████  10/10  🟢  │
│  AI Eval          ████████████████████████████████████████  10/10  🟢  │
│  Visual Regression████████████████████████████████████░░░░   8.5/10 🟢 │
│  Security Pentest ████████████████████████████░░░░░░░░░░░░   7.0/10 🟡 │
│  Component Tests  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0/10  🔴  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Industry comparison**: Arch Systems 7.2/10 vs industry average 6.5/10 — **above average**, but line coverage at 40% vs industry 60-70% is the main gap.

---

## What's In Place

### Test Infrastructure

| Type              | Tool                 | Config                       | Status        |
| ----------------- | -------------------- | ---------------------------- | ------------- |
| Unit              | Jest 30.x + ts-jest  | `apps/portal/jest.config.js` | ✅ Active     |
| E2E               | Playwright           | `playwright.config.ts`       | ✅ Active     |
| Visual Regression | Playwright snapshots | `e2e/visual/`                | ✅ Active     |
| Load              | k6                   | `load-tests/`                | ✅ Configured |
| AI Eval           | DeepEval + Python    | `pkgs/eval/`             | ✅ Active     |
| Security          | OWASP ZAP (scripted) | `ops/pentest.sh`         | ✅ Scripted   |
| Component         | Storybook            | —                            | ❌ Not set up |

### Unit Tests — 37 Files, 178 Passing

```
apps/portal/
├── app/
│   ├── actions.test.ts
│   ├── api/ai/chat/route.test.ts
│   ├── api/plugins/rust-telemetry/route.test.ts
│   ├── api/sync/playback/route.test.ts
│   ├── api/webhooks/[id]/logs/route.test.ts
│   ├── api/webhooks/[id]/route.test.ts
│   ├── api/webhooks/route.test.ts
│   ├── (auth)/login/LoginForm.test.tsx
│   ├── (departments)/[department]/daily-log/DailyLogForm.test.tsx
│   └── (departments)/[department]/machines/actions.test.ts
├── features/
│   ├── departments/components/control-room/ (3 tests)
│   ├── departments/components/engineering/breakdowns/ (2 tests)
│   ├── departments/components/machines/AddMachineForm.test.tsx
│   ├── departments/components/safety/SafetyIncidentForm.test.tsx
│   └── departments/components/tools/UniverSheet.test.tsx
└── lib/
    ├── ai/ (8 tests: ai-service, chunking, embeddings, memory, prompts, schemas, serpapi, tools)
    ├── errors/error-logger.test.ts
    ├── audit.test.ts
    ├── dashboard-service.test.ts
    ├── departments.test.ts
    ├── dept-context.test.ts
    ├── monitoring-api.test.ts
    ├── plugins/orchestrator.test.ts
    ├── shift-closeout.test.ts
    ├── sync/sync-queue.test.ts
    ├── weather-api.test.ts
    └── proxy.test.ts
```

### Coverage Thresholds (jest.config.js)

| Metric     | Threshold | Actual     | Status              |
| ---------- | --------- | ---------- | ------------------- |
| Lines      | 40%       | **40.26%** | 🟢 Passing (barely) |
| Branches   | 30%       | **31.41%** | 🟢 Passing          |
| Functions  | 35%       | **28.47%** | 🔴 FAILING          |
| Statements | 40%       | ~40%       | 🟢 Passing          |

> **Note**: Functions threshold is failing (28.47% < 35%). This is the active blocker in CI.

### Coverage collected from

```js
collectCoverageFrom: [
  "lib/**/*.{ts,tsx}",
  "features/**/*.{ts,tsx}",
  "app/**/*.{ts,tsx}",
  "proxy.ts",
  "!**/*.test.{ts,tsx}",
  "!**/*.d.ts",
  "!**/node_modules/**",
];
```

### E2E Tests — 5 Specs

| Spec                                      | Tests                  | Coverage                       |
| ----------------------------------------- | ---------------------- | ------------------------------ |
| `e2e/login.spec.ts`                       | Login flow             | ✅ Happy path + error state    |
| `e2e/navigation.spec.ts`                  | 14 tests               | ✅ All 8 departments navigate  |
| `e2e/data-entry.spec.ts`                  | 11 tests               | ✅ Control Room shift log form |
| `e2e/visual/login.visual.spec.ts`         | Visual snapshot        | ✅ 2% tolerance                |
| `e2e/visual/design-system.visual.spec.ts` | Design system snapshot | ✅ 2% tolerance                |

Run command: `pnpm test:e2e` (app must be running on `:3000`)

### Load Tests — k6

Location: `load-tests/`

| Scenario     | VUs       | Duration | Thresholds           |
| ------------ | --------- | -------- | -------------------- |
| Login flow   | 0→40 ramp | 5 min    | p95 < 2s, error < 1% |
| Hub redirect | 0→40 ramp | 5 min    | p95 < 2s, error < 1% |
| AI chat      | 0→40 ramp | 5 min    | p95 < 2s, error < 1% |

### DeepEval AI Tests — 25 Tests

Location: `pkgs/eval/`

| Suite           | Tests | Custom Metrics                                                |
| --------------- | ----- | ------------------------------------------------------------- |
| Code generation | 12    | DesignSystem, SupabaseImport, RLS, DeptPattern, ShiftCloseout |
| AI service      | 13    | Skips cleanly without OPENAI_API_KEY                          |

### Security Pentest

| Asset                         | Status     | Notes                                |
| ----------------------------- | ---------- | ------------------------------------ |
| `ops/pentest.sh`          | ✅ Created | OWASP ZAP baseline + full scan       |
| `docker-compose.security.yml` | ✅ Created | `zap-baseline` + `zap-full` services |
| Execution against local       | ⬜ Pending | Manual trigger, Docker required      |
| Last scan results             | None       | Not yet executed                     |

---

## Gaps & Issues

### 🔴 Critical — Functions coverage below threshold (28.47% < 35%)

- CI test step is currently failing on functions threshold
- 157 source files, many utility/lib functions untested
- Highest-impact targets: `lib/` helper functions (parsing, formatting, validation utils)

### 🔴 Critical — Line coverage at 40.26% vs 60% next target

- Jest threshold currently set at 40% — passing by 0.26%
- Next milestone: **60%** (Phase 1 end), then **80%** (Phase 4)
- ~200 more tests needed to reach 60%

### 🟡 Medium — 5 failing unit tests

- Identified in previous sessions: SafetyIncidentForm validation test, AI chat route test
- Root causes: test doesn't fill required fields before validation check; `req.headers` mock in jsdom
- Not yet fixed — these suppress coverage reporting accuracy

### 🟡 Medium — No component-level tests (Storybook)

- `@repo/ui` has 20+ components with no visual tests
- Playwright DOM tests cover some components but not visually
- Storybook + Chromatic would add regression safety for design system changes

### 🟢 Low — Security pentest not yet executed

- Scripts ready, requires Docker + running app
- Not blocking CI — manual step

---

## Action Plan

| Priority | Action                                                  | Status                | Impact                         |
| -------- | ------------------------------------------------------- | --------------------- | ------------------------------ |
| 🔴 P0    | Fix 5 failing unit tests                                | ⬜ Pending            | Unblocks CI, improves coverage |
| 🔴 P0    | Raise function coverage — add tests to `lib/` utilities | ⬜ Pending            | Fix CI failure                 |
| 🟡 P1    | Reach 60% line coverage — add ~200 targeted tests       | ⬜ Pending            | Hit Phase 1 target             |
| 🟡 P1    | Add E2E test: AI chat send + receive                    | ⬜ Pending            | Critical path coverage         |
| 🟡 P1    | Add E2E test: Admin panel access control                | ⬜ Pending            | Security smoke test            |
| 🟡 P1    | Execute OWASP ZAP scan (`./ops/pentest.sh`)         | ⬜ Pending            | Pentest findings               |
| 🟢 P2    | Set up Storybook for `@repo/ui`                         | ⬜ Pending            | Component visual tests         |
| 🟢 P2    | Raise coverage threshold to 60% in jest.config.js       | ⬜ After reaching 60% | CI gate                        |
| 🟢 P2    | Add E2E to CI pipeline                                  | ⬜ Pending            | Automated regression           |
| ✅ Done  | 37-file unit test suite (178 passing)                   | ✅ Complete           | Foundation                     |
| ✅ Done  | Coverage threshold set (40/30/35/40)                    | ✅ Complete           | CI gate                        |
| ✅ Done  | E2E: login + navigation + data-entry (25 tests)         | ✅ Complete           | Critical flows                 |
| ✅ Done  | Visual regression (2 specs)                             | ✅ Complete           | UI snapshot safety             |
| ✅ Done  | k6 load testing (3 scenarios)                           | ✅ Complete           | Performance baseline           |
| ✅ Done  | DeepEval AI eval suite (25 tests)                       | ✅ Complete           | AI quality gate                |
| ✅ Done  | Security pentest scripted                               | ✅ Complete           | Ready to execute               |

---

## Industry Comparison

| Metric          | Arch Systems    | Industry Avg       | Best Practice     | Gap               |
| --------------- | --------------- | ------------------ | ----------------- | ----------------- |
| Line coverage   | 40.26%          | 60-70%             | 80%+              | ⚠️ -20% to target |
| Branch coverage | 31.41%          | 50-60%             | 70%+              | ⚠️ -19% to target |
| Test file count | 37 unit + 5 E2E | Varies             | —                 | 🟢 Good           |
| E2E framework   | Playwright      | Cypress/Playwright | Same              | 🟢 On par         |
| Load testing    | k6              | Often absent       | perf/Gatling        | 🟢 A+             |
| AI eval         | DeepEval        | Rare               | Emerging practice | 🟢 A+             |
| Security scan   | ZAP scripted    | Often absent       | OWASP ZAP         | 🟢 A              |
| Component tests | None            | Storybook ~40%     | Storybook         | 🔴 Missing        |

---

## Score Breakdown

| Sub-metric               | Score      | Rationale                           |
| ------------------------ | ---------- | ----------------------------------- |
| Unit test infrastructure | 8.5/10     | 37 files, 178 passing, CI-gated     |
| E2E coverage             | 8.5/10     | 3 flows + 2 visual specs            |
| Line coverage            | 4.0/10     | 40% vs 60% target                   |
| Branch coverage          | 3.1/10     | 31% vs 50% target                   |
| Function coverage        | 2.8/10     | 28% — failing threshold             |
| Load testing             | 10/10      | k6 with 3 production-like scenarios |
| AI eval                  | 10/10      | DeepEval suite with custom metrics  |
| Visual regression        | 8.5/10     | 2 specs, snapshot comparison        |
| Security pentest         | 7.0/10     | Scripted, not yet executed          |
| Component tests          | 0/10       | No Storybook                        |
| **Overall**              | **7.2/10** | Strong infrastructure, coverage gap |

---

## Test Commands Reference

```bash
# Unit tests
pnpm --filter portal test

# Unit tests with coverage report
pnpm --filter portal test -- --coverage

# E2E (app must be on :3000)
pnpm test:e2e

# Single E2E spec
pnpm test:e2e -- --grep "login"

# Load tests (k6 must be installed)
k6 run load-tests/login.js

# AI eval (Python venv + DeepEval)
cd pkgs/eval && python -m pytest

# Security pentest (Docker required, app on :3000)
./ops/pentest.sh
./ops/pentest.sh --full
```

---

## Related Docs

- [`../concepts/testing-qa-strategy.md`](../concepts/testing-qa-strategy.md) — full QA strategy
- [`../concepts/deepeval-integration.md`](../concepts/deepeval-integration.md) — AI eval details
- [`../../apps/portal/jest.config.js`](../../apps/portal/jest.config.js) — coverage config
- [`../../playwright.config.ts`](../../playwright.config.ts) — E2E config
- [`../../ops/pentest.sh`](../../ops/pentest.sh) — security scan
