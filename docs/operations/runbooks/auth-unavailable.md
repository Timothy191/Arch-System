# Runbook: Auth Unavailable

Purpose: steps to follow when the portal reports "System Unavailable" or auth failures at scale.

1. Quick checks

- Confirm Sentry for recent auth errors: search for "Invalid Refresh Token", "Refresh Token Not Found", or spikes in auth failures.
- Check Redis status (cache) and Supabase health (auth, db) logs.
- Look at middleware logs (apps/portal/proxy.ts) for signout events.

2. Immediate mitigations

- If Supabase is degraded: fail open read-only mode where possible; inform users via status page.
- Flush relevant Redis keys: `arch:auth:employee:*` and `telemetry:last:*` if stale cache suspected.
- Redeploy/rollback recent releases if Sentry shows a recent deploy correlating with failures.

3. Browser-side guidance

- Advise users to hard-refresh the page, clear browser cache, and unregister service workers (PWA) after a deploy.
- Release note for ops: include a short script to clear stale service-worker registrations across devices if needed.

4. Root-cause analysis

- Correlate auth failures with release tags and Sentry release mappings.
- Check whether `@repo/utils` or other packages export browser-only modules from package root (this can trigger Turbopack runtime instantiation errors).
- Verify Cache-Control headers and service worker serving strategy (PWA integration).

5. Post-incident

- Add observability alert: >10 auth.failures/min for 5m -> page on-call.
- Add automated smoke test (Playwright) as part of deploy pipeline to validate login flow after production deploy.

6. Contacts

- Supabase admin, Redis admin, DevOps on-call, SRE lead.

Notes:

- Telemetry events are emitted to /api/telemetry/push (FUXA) and recorded in Redis for dashboards.
- Sentry breadcrumbs are added on auth success/failure (client) to aid debugging without PII.
