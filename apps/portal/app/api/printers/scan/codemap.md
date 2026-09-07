# apps/portal/app/api/printers/scan/

## Responsibility

Discovers currently available printers and reconciles them against the registered printer inventory. This route supports setup/operations workflows by identifying new or existing printers from local detection.

## Design

- Uses server-side Supabase auth via `createServerSupabaseClient()`.
- Restricts access to `admin` and `access_control` roles by checking `employees.role`.
- Separates detection from persistence: it does not create or update DB records, only reports state.
- Combines live detection results with registered DB rows to classify printers.

## Flow

- `GET /api/printers/scan`
  - Authenticates the user.
  - Authorizes by employee role.
  - Detects printers via `detectAllPrinters()` from `@/app/(departments)/access-card-actions/lib/printer-detection`.
  - Fetches non-deleted registered printers from `card_printers` (`cups_name`, `id`).
  - Marks each detected printer as `isRegistered` and attaches `dbId` when matched.
  - Returns `{ printers, count }`.
  - On failure, returns `{ error, printers: [], count: 0 }` with `500`.

## Integration

- Depends on `@repo/supabase/server` for auth and inventory lookup.
- Depends on local printer detection utilities for CUPS/USB discovery.
- Feeds operational workflows that register or reconcile printers against `apps/portal/app/api/printers/`.
