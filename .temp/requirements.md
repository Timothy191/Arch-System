# Complete Production Overhaul — Requirements (EARS Syntax)

## Ubiquitous Requirements

- **REQ-UBI-01**: The system SHALL strictly adhere to the light-mode invariant
  (#f3f4f6 canvas, background luminance > 200, semantic OKLCH tokens, zero
  `dark:` Tailwind classes) across all fixed routes.
- **REQ-UBI-02**: All data persistence and security state mutations SHALL
  execute exclusively via Next.js Server Actions with atomic audit logging.
- **REQ-UBI-03**: All primary telemetry, badge inventories, and access event
  queries SHALL execute in Server Components (RSC) with Suspense streaming
  fallbacks.
- **REQ-UBI-04**: Timestamps, Badge hex codes, RFID EPCs, and Gate IDs SHALL
  render in tabular monospace font (`JetBrains Mono`).

## Event-Driven Requirements

- **REQ-EVT-01**: WHEN an authorized user navigates to `/engineering`, the
  system SHALL render the breakdowns dashboard with all non-deleted breakdowns
  for the current department without throwing a 500 or a blank screen.
- **REQ-EVT-02**: WHEN an authorized user navigates to `/api/departments/{id}/fleet`,
  the system SHALL return a JSON array of fleet vehicles with HTTP 200, not
  HTTP 500, regardless of the requesting user's role.
- **REQ-EVT-03**: WHEN an authorized user navigates to `/control-room`, the
  system SHALL render the control room dashboard with data loaded in under
  2 seconds (p95), not 19 seconds.
- **REQ-EVT-04**: WHEN an authorized user navigates to `/machines`, the
  system SHALL render the machine database with the correct active/inactive
  counts for the current department, not a 500.
- **REQ-EVT-05**: WHEN the Vercel CLI is invoked with `vercel env ls`, the
  system SHALL return the project's environment variables, not a
  `Custom Environment not found` api_error.
- **REQ-EVT-06**: WHEN a new user signs up, the `handle_new_user` trigger
  SHALL populate `accessible_departments` from `department_id` so RLS
  policies on `machines`, `breakdowns`, and other department-scoped tables
  return rows instead of zero.

## State-Driven Requirements

- **REQ-STA-01**: WHILE the Redis cache is available, the department UUID
  lookup SHALL be served from cache with a 500 ms soft deadline, falling
  through to a direct DB query only on cache miss (not on cache timeout).
- **REQ-STA-02**: WHILE the Redis cache is unavailable or slow, the system
  SHALL NOT fall through to a direct DB query on every request; it SHALL
  serve a stale or empty cached value and let the caller proceed, preventing
  a thundering herd on the `departments` and `employees` tables.
- **REQ-STA-03**: WHILE network connectivity is intermittent, the system
  SHALL fall back to cached metrics and enqueue offline security
  registrations via the `useOfflineQueue` background sync engine.
- **REQ-STA-04**: WHILE the `departments` table is queried, the query SHALL
  use an index scan (not a seq scan) on `departments(name)` and
  `employees(auth_id)` so the RLS policy sub-plan is efficient.

## Optional & Unwanted Behavior Requirements

- **REQ-OPT-01**: WHERE available, the system SHALL display the resolved
  department UUID in logs and traces for easier debugging of RLS failures.
- **REQ-UNW-01**: The system SHALL NOT fail or present a blank screen or
  unhandled crash if the database metrics RPC encounters schema cache lag
  or if a non-admin role views site headcount.
- **REQ-UNW-02**: The system SHALL NOT allow badge issuance without validating
  required entity relationships (Personnel, Contractor, Fleet Vehicle, or
  Heavy Equipment).
- **REQ-UNW-03**: The system SHALL NOT deploy untracked files that call
  `inngest.createFunction(...)` at module load without registration in the
  Inngest serve route, as this can break the client bundle.
- **REQ-UNW-04**: The system SHALL NOT ship a build where `pnpm quality`
  fails, as Vercel will deploy a broken build to production.