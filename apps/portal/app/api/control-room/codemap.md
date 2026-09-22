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
  - Enforces `operator`, `supervisor`, `admin` roles, strictly rejecting `viewer`.
  - Executes atomically using `db.transaction()` (Kysely) against `control_room_shift_reports`.
  - Performs a synchronous JSON snapshot upsert into `shift_status` using Supabase client to maintain compatibility with legacy triggers.
  - Returns `status: 'already_closed'` natively on idempotency hits.
