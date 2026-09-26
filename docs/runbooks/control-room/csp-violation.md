# Runbook: CSP Violation

**Severity:** Critical
**Impact:** Possible XSS or unauthorized iframe injection.

## Symptoms

- CSP Violation reports in Sentry / Datadog.
- Alert: `CSPViolationSpike`

## Actions

1. Identify the blocked origin.
2. If it's legitimate SCADA, update `NEXT_PUBLIC_FUXA_URL` and redeploy.
3. Otherwise, escalate to Security.
