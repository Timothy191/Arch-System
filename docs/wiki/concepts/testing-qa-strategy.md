# Comprehensive Testing & QA Strategy

**Priority:** HIGH  
**Estimated Effort:** 1 week  
**Status:** ✅ SUBSTANTIALLY COMPLETE (Phase 3 + Post Phase 3 sprint)

> Unit tests at 72%+, E2E covering login/navigation/data-entry, visual regression live, k6 load tests configured, DeepEval AI eval suite added. Security pentest scripted via `scripts/pentest.sh` (OWASP ZAP).

---

## Overview

Phase 3 delivered a working test baseline. A post-Phase 3 sprint added E2E, visual regression, load, DeepEval, and security tooling. The security pentest script (`scripts/pentest.sh`) enables on-demand OWASP ZAP scanning.

---

## Current State

| Test Type          | Status                    | Notes                                          |
| ------------------ | ------------------------- | ---------------------------------------------- |
| Unit (Jest)        | ✅ 178 passing, 23 suites | Coverage reporting active (lcov + html)        |
| E2E (Playwright)   | ✅ 3 suites (25 tests)    | login, navigation (14), data-entry (11)        |
| Visual Regression  | ✅ 2 specs                | login.visual.spec, design-system.visual.spec   |
| Load Testing       | ✅ k6 configured          | login/redirect/ai-chat, ramp 0→40 VUs, p95<2s  |
| DeepEval (AI)      | ✅ 25 tests               | 12 code-gen + 13 AI service, custom metrics    |
| Security / Pentest | ✅ Scripted               | `scripts/pentest.sh` — OWASP ZAP baseline+full |
| Pass Rate          | ~85%                      | 5 failing tests remain (under investigation)   |

Test files: `24` across portal and packages.  
Test runner: `pnpm --filter portal test`  
E2E runner: `pnpm test:e2e` (requires app on `:3000`)

---

## Implementation Checklist

### Unit Test Coverage (72% → 90%+)

- [ ] Identify untested modules via coverage report:
  ```bash
  pnpm --filter portal test -- --coverage
  ```
- [ ] Priority coverage targets:
  - Server Actions (all mutations in `app/` actions)
  - Auth helpers (`createServerSupabaseClient`, middleware logic)
  - AI service (`ai-service.ts` — provider failover logic)
  - RLS policy helper functions
  - Form validation schemas (Zod)
- [ ] Add snapshot tests for critical UI components
- [ ] Mock Supabase client consistently via `__mocks__/`

### E2E Tests — Critical User Flows

Add to `e2e/` directory:

- [ ] **Login flow** (exists — extend)
  - Invalid credentials → error message
  - Valid credentials → redirect to hub
  - Session expiry → redirect to login
- [ ] **Department navigation**
  - Hub → each of 8 departments loads
  - Unauthorized department → redirect
- [ ] **Data entry** (Control Room)
  - Fill shift log form → submit → confirm in table
  - Validation errors display correctly
- [ ] **AI chat**
  - Send message → receive streamed response
  - Context persists across messages
- [ ] **Admin panel**
  - Admin user can access `/admin`
  - Non-admin user is blocked

Run with: `pnpm test:e2e`

### Visual Regression Testing

- [ ] Install Storybook for `@repo/ui` package:
  ```bash
  pnpm --filter @repo/ui add -D @storybook/react @storybook/nextjs
  ```
- [ ] Add stories for design system components (Button, Card, Table, Form)
- [ ] Integrate Chromatic for visual diffs:
  ```bash
  npx chromatic --project-token=<token>
  ```
- [ ] Add to CI pipeline (`.github/workflows/ci.yml`)

### Load Testing

- [ ] Install k6:
  ```bash
  sudo apt install k6
  ```
- [ ] Write load test scenarios:
  - Dashboard page: 50 concurrent users for 5 min
  - Data entry form: 20 concurrent submissions
  - AI chat: 10 concurrent sessions
- [ ] Baseline thresholds:
  - p95 response time < 500ms
  - Error rate < 1%
  - DB p99 < 200ms
- [ ] Test with production-like data seed (use `packages/database/seeds/`)

### Security Penetration Testing

✅ `scripts/pentest.sh` created — wraps OWASP ZAP with HTML + JSON reporting.
✅ `docker-compose.security.yml` added — `zap-baseline` and `zap-full` services.

```bash
# Baseline passive scan (safe, no state mutation)
./scripts/pentest.sh

# Full active scan (use against test env only)
./scripts/pentest.sh --full

# Or via docker compose
docker compose -f docker-compose.security.yml run --rm zap-baseline
```

Reports saved to `test-results/pentest/`.

- [ ] **Execute** scan against local deployment (manual step — Docker required)
- [ ] Verify:
  - XSS in data entry forms (Control Room shift log)
  - CSRF protection on POST routes
  - No sensitive headers in responses
  - Auth cookies: `Secure` + `HttpOnly` flags
- [ ] RLS isolation test: Dept A user cannot query Dept B data via Supabase client
- [ ] Review `proxy.ts` for auth bypass edge cases

---

## CI Pipeline Integration

Add to `.github/workflows/ci.yml`:

```yaml
# After existing lint → type-check → test → build
- name: E2E Tests
  run: |
    pnpm dev &
    sleep 10
    pnpm test:e2e

- name: Coverage Report
  run: pnpm --filter portal test -- --coverage --coverageThreshold='{"global":{"lines":90}}'
```

---

## Test Commands Reference

```bash
# Unit tests (all)
pnpm --filter portal test

# Unit tests (single file)
pnpm --filter portal test -- --testPathPatterns=ai-service

# Unit tests with coverage
pnpm --filter portal test -- --coverage

# E2E tests (app must be on :3000)
pnpm test:e2e

# E2E single spec
pnpm test:e2e -- --grep "login"
```

---

## Related Pages

- [[deepeval-integration|DeepEval Integration]] — AI service quality evaluation
- [[how-to-debug-issues|Q: How to debug issues?]] — General debugging
- [[monitoring-error-tracking|Monitoring & Error Tracking]] — Sentry for production errors
- [[incident-response|Incident Response Playbook]] — When tests catch production issues
