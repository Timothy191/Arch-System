# apps/portal/app/api/admin/data/

## Responsibility

Provides a single dynamic admin data endpoint for operational tables, replacing per-table route proliferation with one whitelisted router.

## Design

- Route shape: `/api/admin/data/[table]`
- Supported methods: `GET`, `PUT`, `DELETE`
- Table access is controlled by `OPERATIONAL_TABLES`, a hardcoded allowlist of operational tables.
- Reads support pagination and ordering via query params: `limit`, `offset`, `order_by`, `order_dir`.
- Updates require an `id` in the request body; deletes require an `id` query parameter.
- Machine status updates are rate-limited via Redis-backed fixed-window strategy.
- Every mutation writes an `audit_logs` entry with `action`, `table_name`, `record_id`, `old_data`, `new_data`, and `performed_by`.

## Flow

### GET

1. Assert admin.
2. Validate table name against whitelist.
3. Build paginated query with ordering.
4. Return `{ data, count, limit, offset }`.

### PUT

1. Assert admin.
2. Validate table and require `id`.
3. If table is `machines` and payload includes `active`, apply per-machine rate limit.
4. Fetch current row, apply update, insert audit log, return `{ success: true }`.

### DELETE

1. Assert admin.
2. Validate table and require `id` query param.
3. Fetch current row, delete by `id`, insert audit log, return `{ success: true }`.

## Integration

- Uses `createServerSupabaseClient()` for auth checks and `createServiceRoleClient()` for data access.
- Uses `withRateLimit()` for global request rate limiting and optional Redis-backed machine-status limiting.
- Audit logging creates a durable operational history tied to admin employee identity.
- Swagger docs in the route file describe the public contract for admin data access.
