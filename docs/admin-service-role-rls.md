# Administration Service-Role and RLS Notes

## Service-role usage

- `/api/admin/data/[table]` uses `createServiceRoleClient()` only after `assertAdmin()` verifies the caller's employee role is `admin`.
- Service-role access is required for cross-table admin reads/writes and audit-log inserts.
- No service-role credentials are exposed to client bundles; all access is server-side.

## RLS coverage

- All 104 database tables have RLS enabled.
- Admin tables remain RLS-protected; service-role operations are audited in `audit_logs`.
- Admin mutations invalidate relevant cache tags and revalidate affected routes.

## Audit logging

- `create`, `update`, and `delete` operations write immutable `audit_logs` records with actor, table, record id, and before/after data.
