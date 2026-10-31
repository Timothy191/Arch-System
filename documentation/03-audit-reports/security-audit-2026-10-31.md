# Security Audit Report — 2026-10-31

## Scope

Investigated vulnerabilities across the Arch-System monorepo (`apps/portal`, `packages/*`, `libs/*`, `tools/*`).

## Audits Run

- `tools/audits/secrets-scan.cjs` — gitleaks not installed; fallback supply-chain scan used.
- `tools/audits/audit-supply-chain.cjs` — **PASS** (0 violations, 0 warnings, 2304 files scanned).
- `tools/audits/enforce-security-checks.cjs` — PASS with 28 warnings (console.log in production code paths).
- `tools/audits/audit-rls.cjs` — **PASS** (103 tables, all with RLS, 0 critical).
- `tools/audits/semgrep-scan.cjs` — **PASS** (0 findings).
- `pnpm audit` — 9 advisories (1 low, 6 moderate, 2 high); 1 high unresolved.

## Findings

### Critical

None.

### High

1. **joi DoS (GHSA-4528-x5fx-h6hg)** — vulnerable versions `>=18.0.0 <18.3.1`. Transitive dependency via `@storybook/test-runner@0.24.4 > jest-process-manager > wait-on > joi@18.2.9`. Dev/test tooling only; not shipped to production runtime. Recommend upgrading `@storybook/test-runner` or pinning `joi >=18.3.1` via pnpm override when feasible.

### Moderate / Low

- 6 moderate, 1 low advisories reported by `pnpm audit`; all transitive through dev tooling. No production runtime exposure identified.
- 28 `console.log` statements in production code (e.g. `apps/portal/app/api/queues/process-order/route.ts`, `apps/portal/app/api/auth/login/route.ts`, `apps/portal/components/PWAInstallButton.tsx`). Not a security vulnerability but should be replaced with structured logger (`@repo/logger`) to avoid leaking operational detail.

### SQL Injection

No raw SQL template interpolation found in `apps/portal`. All database access routes through `@repo/supabase` (Kysely/typed clients) and parameterized RPCs.

### XSS

No `dangerouslySetInnerHTML` usage in production code (only test fixture). User inputs validated via Zod (`@repo/contract`).

### Exposed Secrets

No hardcoded secrets detected by supply-chain scan. Service-role key accessed only server-side via `process.env.SUPABASE_SERVICE_ROLE_KEY`.

### RLS Policies

All 103 public tables have RLS enabled. No missing policies.

### Authentication

No weak patterns identified. JWT/session handling via Supabase SSR; service role used only in server routes.

## Recommendations

1. Add pnpm override for `joi >=18.3.1` or upgrade Storybook test-runner.
2. Replace `console.log` with `@repo/logger` structured logging.
3. Re-run `gitleaks`/`osv-scanner` in CI once installed for deeper coverage.
4. Keep `audit:rls` and `audit:supply-chain` in the completion gate.
   }
