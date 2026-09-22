# Task 007: Deployment and Monitoring for Auth

## Execution Date

2026-09-22

## Synopsis

Implemented deployment and monitoring enhancements focused on the Auth feature, complying with AGENTS.md rules.

## Actions Taken

- **Sentry Error Boundaries:** Wrapped `(auth)/layout.tsx` in a Sentry ErrorBoundary.
- **OTel Tracing & Security Logging:** Rewrote the `apps/portal/app/api/auth/login/route.ts` API route to wrap authentication logic inside `tracer.startActiveSpan("loginAttempt")`. Added structured logs (avoiding PII) for failed auth scenarios (upstream failure, rate limit, invalid credentials) and success.
- **CI Tier 2 Validation:** Added a `tier2-check` in `.github/workflows/ci.yml` that checks if `features/auth/`, `supabase/migrations/` or `packages/auth/` are modified, requiring at least 2 approvals for the PR.
- **Preview Database Branching:** Added `.github/workflows/preview.yml` to automatically branch the Supabase database on PRs.
- **Build-Time Env Validation:** Added build-time checks in `apps/portal/next.config.mjs` for `NEXT_PUBLIC_SUPABASE_URL` and `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Verification

- Syntax verified with `pnpm turbo run type-check`.
- Quality gates verified via `pnpm quality`.
