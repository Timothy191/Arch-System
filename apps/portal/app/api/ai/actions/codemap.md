# apps/portal/app/api/ai/actions/

## Responsibility

Authenticated backend for the Aria operations assistant (aria-overlay sidecar).
Provides read access to live operational data (scoped to the signed-in
employee's department) and is the single portal-side execution point for the
assistant's database writes.

## Design

- `POST /api/ai/actions` with `{ kind, tool, args }`.
- `kind: "read"` — server-side proxy target for the sidecar's read tools. The
  sidecar forwards the portal session cookie, so Supabase auth + RLS apply.
  Supported tools:
  - `get_active_breakdowns` → active `breakdowns` rows for the employee's
    `department_id`.
  - `get_shift_summary` → active breakdowns plus today's `daily_logs`
    aggregate (`machine_hours.hours_worked` sum).
- `kind: "write"` — called by the confirmation card rendered in the sidebar
  iframe when a human confirms a draft. Reuses the engineering breakdowns
  server actions (`createBreakdown`, `bookOutBreakdown`, `directCheckout`)
  and injects `department_id` resolved from `employees` by `auth_id`. The
  model itself never writes; it only drafts.

## Flow

1. Parse and validate the payload shape.
2. `createServerSupabaseClient()` + `auth.getUser()` → 401 when signed out.
3. Resolve `employees` row by `auth_id` → 403 without a department.
4. Route to the read handler (department-scoped queries) or write handler
   (portal server actions).
5. Errors are logged via `@/lib/errors/error-logger`; `isAppError` responses
   return `{ success, error, code }`; `ZodError` input mismatches return 400.

## Integration

- Consumed by `aria-overlay/src/lib/tools.ts` read tools and the sidecar's
  `ToolConfirmCard` confirmation POST (same-origin via portal rewrite).
- Reads `breakdowns`, `daily_logs`, `machine_hours`.
- Writes reuse engineering breakdowns actions + contract schemas
  (`@/features/departments/components/engineering/breakdowns/actions.ts`,
  `@repo/contract` schemas).
