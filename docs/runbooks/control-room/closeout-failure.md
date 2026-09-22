# Runbook: Shift Closeout Failure

**Severity:** High
**Impact:** Operators cannot finalize their shift records, delaying handovers.

## Symptoms

- 5xx errors on `/api/control-room/shift-closeout`
- Alert: `ShiftCloseoutErrorRateHigh`

## Actions

1. Check Postgres `idempotency_keys` deadlocks.
2. If `atomic_shift_closeout` RPC is failing, check DB logs for `statement_timeout`.
3. Operators can retry safely (idempotency guarantees exact-once).
