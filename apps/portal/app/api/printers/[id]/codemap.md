# apps/portal/app/api/printers/[id]/

## Responsibility

Handles item-level printer operations. Currently provides soft deletion for a specific registered printer by ID.

## Design

- Uses dynamic route params as an async promise (`params: Promise<{ id: string }>`).
- Uses server-side Supabase auth via `createServerSupabaseClient()`.
- Restricts access to `admin` and `access_control` roles by checking `employees.role`.
- Performs soft delete by setting `deleted_at` instead of removing the row.

## Flow

- `DELETE /api/printers/:id`
  - Authenticates the user.
  - Authorizes by employee role.
  - Resolves `id` from route params.
  - Updates `card_printers.deleted_at` for the matching `id`.
  - Returns `{ success: true }` on success.

## Integration

- Depends on `@repo/supabase/server` for database and auth.
- Operates on the same `card_printers` table as `apps/portal/app/api/printers/`.
- Intended to be paired with list/create endpoints in the parent printers route group.
