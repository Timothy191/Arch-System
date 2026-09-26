# apps/portal/app/api/printers/

## Responsibility

Serves the printer registry API for the portal. This folder exposes the collection-level endpoints for card printers: listing registered printers and creating new printer records.

## Design

- Uses server-side Supabase auth via `createServerSupabaseClient()`.
- Restricts access to `admin` and `access_control` roles by checking `employees.role`.
- Normalizes errors into JSON responses with appropriate HTTP status codes.
- Soft-delete is not handled here; deletion is delegated to `apps/portal/app/api/printers/[id]/`.

## Flow

- `GET /api/printers`
  - Authenticates the user.
  - Authorizes by employee role.
  - Queries `card_printers` where `deleted_at IS NULL`, ordered by `created_at DESC`.
  - Returns `{ printers }`.
- `POST /api/printers`
  - Authenticates the user.
  - Authorizes by employee role.
  - Validates required fields: `cups_name` and `name`.
  - Inserts a new `card_printers` row with printer metadata.
  - Returns the created printer with `201`.

## Integration

- Depends on `@repo/supabase/server` for database and auth.
- Shares auth/role enforcement patterns with sibling printer routes.
- Complements `apps/portal/app/api/printers/[id]/` for item-level deletion and `apps/portal/app/api/printers/scan/` for discovery.
