# apps/portal/app/api/admin/

## Responsibility

Hosts admin-facing API surface for operational data management. This folder owns the entrypoint route behavior for admin data access and delegates table-specific behavior to the nested `data/` route group.

## Design

- Thin top-level admin route that preserves a single responsibility: admin gating and routing.
- Actual table operations are centralized in `data/[table]/route.ts` using a whitelist-driven dynamic table router.
- Auth is enforced via `assertAdmin()`, which checks Supabase session and requires `employees.role === "admin"`.
- Mutations use a service-role Supabase client and write audit trail entries to `audit_logs`.

## Flow

1. Request arrives at an admin API route.
2. Auth middleware / route handler verifies admin role.
3. For data operations, the request is forwarded to the dynamic `data/[table]` handler.
4. The handler validates the table against `OPERATIONAL_TABLES`, then performs paginated reads or validated writes.
5. Writes optionally apply rate limiting, then persist changes and log before/after state.

## Integration

- Depends on `@repo/supabase/server`, `@repo/supabase/service-role`, `@repo/redis`, and `@repo/rate-limiter`.
- Connects to portal auth/session flow and operational tables used across the admin experience.
- Audit logging ties admin mutations back to employee identity for traceability.
