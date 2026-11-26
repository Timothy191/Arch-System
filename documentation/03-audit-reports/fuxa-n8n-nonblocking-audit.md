# FUXA & n8n Non-Blocking Health Integration — Compliance Audit

**Date:** 2026-11-26
**Scope:** `app/api/health/fuxa/route.ts`, `app/api/health/n8n/route.ts`, `packages/utils/src/n8n.ts`

## Requirement 1 — Explicit `optional: true` + `configured: false` reporting

- FUXA: `FuxaHealthResponse` now includes `optional: boolean` and `configured: boolean`. Unconfigured path returns `{ status: 'unconfigured', optional: true, configured: false, ... }`.
- n8n: `N8nHealthResult` now includes `configured: boolean`; route payload uses `configured: result.configured`. Unconfigured returns `status: 'unconfigured'`, `configured: false`, `optional: true`.
- ✅ Compliant.

## Requirement 2 — HTTP 200 in every operational state

- FUXA: all branches (healthy/degraded/unavailable/unconfigured) return `HTTP_STATUS_OK` (200). Previous 503 responses removed.
- n8n: route already returned 200 in all states; unchanged.
- ✅ Compliant (no 5xx for optional integration checks).

## Requirement 3 — No hard external dependencies

- `libs/shared/utils/src/env.ts`: `NEXT_PUBLIC_FUXA_URL` is `z.string().url().optional()`. `FUXA_URL` and `N8N_URL` are not declared as required (read directly via `process.env` with empty-string fallback).
- Health routes never throw: all fetch/redis calls wrapped in try/catch; unconfigured path returns immediately without outbound calls.
- Core portal starts and runs without FUXA/n8n (verified via build + runtime health).
- ✅ Compliant.

## Requirement 4 — Core portal fully operational when unconfigured

- Health endpoints report unconfigured status without blocking.
- No performance degradation: unconfigured FUXA path skips fetch entirely (0 ms probe).
- ✅ Compliant.

## Verification Results

| Check                                  | Result                |
| -------------------------------------- | --------------------- |
| FUXA route tests                       | 6/6 pass              |
| n8n util tests (`@repo/utils`)         | 41/41 pass (7 suites) |
| Redis live integration (`@repo/redis`) | 27/27 pass            |
| Portal Redis integration               | 7/7 pass              |
| Agent-verify (28 gates)                | 28/28 pass, 0 failed  |
| Type-check (portal + utils)            | 0 errors              |
| Biome lint                             | 0 errors (1919 files) |

## Discrepancies

None identified. All mandatory requirements satisfied; optional integrations remain non-blocking and report their configuration state unambiguously.
