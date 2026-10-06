# apps/portal/app/api/control-room/

This folder hosts Control Room API routes that serve operational dashboards and resilience checks.

## Responsibility

- Expose read-only control-room endpoints under `/api/control-room/*`.
- Provide authenticated department/shift metrics and SCADA/Redis health status.
- Keep route handlers thin; delegate business logic to shared lib/services.

## Design

- Next.js App Router route handlers in `route.ts` files.
- Auth via `createServerSupabaseClient()`; unauthenticated requests return `401`.
- Input validation happens in-route from query params; required params return `400`.
- CORS applied through shared `applyCors` helper where needed.
- External system health is probed defensively with timeouts and fallback status.

## Flow

- `shift-completeness`: validate auth → parse `deptId`, `deptSlug`, `date`, `shift` → call `getShiftCompleteness(...)` → return JSON metrics.
- `scada-status`: probe FUXA with `HEAD` and timeout → check Redis cached telemetry keys → derive `healthy`/`degraded`/`offline` → return status payload with latency and cache metadata.

## Integration

- Depends on `@repo/supabase/server` for auth and database-backed metrics.
- Depends on `@repo/redis` for cached telemetry availability checks.
- Uses internal helpers from `@/lib/shift-completeness` and `@/lib/api/cors`.
- Serves Control Room UI surfaces that need shift completeness and SCADA resilience data.

## Shift Closeout (Hardened)

- `/shift-closeout/route.ts`: Exposes a secure, idempotent API for submitting the operator shift closeout report.
  - Requires `Idempotency-Key` to prevent double-closing.
  - Allows only `operator`, `supervisor`, `admin` and verifies access to the requested department.
  - Invokes `atomic_shift_closeout` to persist the report and shift status with database idempotency. The function validates `auth.uid()`, employee identity, role, department access, input shape and idempotency before writing.
  - The migration revokes execution from `PUBLIC`, `anon`, and `service_role`; only authenticated user sessions can call this closeout function.
  - Returns `status: 'already_closed'` natively on idempotency hits.

## C66 Machine & Operator Assignment

- `/machine-operator-scan/route.ts` serves authorized operator options for a selected machine and accepts machine/operator IDs from dropdowns or scanned codes.
- Machine lookup accepts a database UUID or registered serial number from the shared fleet, which can be owned by the `admin` registry while the shift operation is assigned to Control Room. Assignment rechecks active status, machine-type job-title match, medical/induction expiry, and badge validity when a badge is scanned before inserting a `machine_operations` row via the session-bound Supabase client.
- Control Room UI uses native camera barcode detection when supported, plus dropdown and keyboard-wedge fallbacks. Scanner network addressing/protocol is intentionally not configured here.
- Dump trucks remain listed by Hourly Loads from the active machine registry; assignment does not create fabricated load counts.
- The schema has no operator-license/certificate matrix. Matching personnel job titles filters operators but is not equivalent to verifying machine-specific certification.
- Hourly Loads actions use server-validated role and department access. Split-segment lock/insert now uses `atomic_split_hourly_load`, a single transaction-scoped service-role RPC that locks the shift key, scopes rows by department/machine/date/shift, resolves the required daily-log FK, and returns the inserted segment.
- The split RPC is not executable by `PUBLIC`, `anon`, or `authenticated`; only the server service role can invoke it. It independently checks the service-role JWT claim and active machine, while the server action remains responsible for the end-user authorization check.
