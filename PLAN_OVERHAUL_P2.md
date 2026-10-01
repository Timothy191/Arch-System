# Arch-System — Complete Production Overhaul Plan (cont.)

## 1. Phased Remediation (cont.)

### Phase 1 — Fix (2-6h): repair the data layer

**1a. Index `departments` and `employees` properly.** The 19s `departments`
queries are a missing-index + correlated-subquery problem. The RLS policies
in migration 001 re-scan `employees` for every row. Add a migration:
```sql
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_employees_auth_id ON employees(auth_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_accessible_departments
  ON employees USING gin(accessible_departments);
```
The GIN index on `accessible_departments` is the critical one — the
`ANY(e.accessible_departments)` clause in every RLS policy currently does a
seq scan.

**1b. Replace per-request `departments` lookups with a cached map.** Four
call sites do `.from('departments').select('id').eq('name', slug).single()`:
- `apps/portal/server/proxy.ts:138` (resolveDeptUuid, per request, on the Edge)
- `apps/portal/lib/dept-context.ts:30` (getDepartmentContext, per page render)
- `apps/portal/lib/prewarm-cache.ts:24` (prewarmDepartmentCache, per layout)
- `apps/portal/lib/hub-departments.ts:33`, plus 6 more in jobs/

Fix: create `apps/portal/lib/dept-registry.ts` that loads ALL departments once
into a module-level Map keyed by name, with a 5-min TTL, and have all four
call sites read from it. The DB query happens once per TTL window, not once
per request. This is the single highest-impact change for the 19s latency.

**1c. Fix the Redis 150 ms timeout race.** Both `getAuthenticatedEmployee`
(auth.ts:60-64) and `proxy.ts:301-316` use `Promise.race([cachePromise,
timeoutPromise])` with a 150 ms timeout. On Vercel, Redis round-trips to a
managed Redis instance routinely exceed 150 ms. The race then throws, the
catch swallows it, and the code falls through to a direct DB query — which is
what produces the 19s queries. Two fixes:
  - Raise the timeout to 500 ms (still bounded, still fails safe).
  - Better: make the timeout a soft deadline — return `null` from the cache
    path on timeout but do NOT fall through to DB; instead mark the cache as
    degraded and let the caller proceed with the cached value or a safe
    default. Falling through to DB on every timeout is the amplifier.

**1d. Fix the `machines` 500.** Live log: `Database query failed: machines
(GET)`. The `machines` RLS policy (migration 001, refined by 012 and 043)
requires the requesting employee to be admin, same-department, or have the
department in `accessible_departments`. The `machines/page.tsx:15` query uses
the anon-scoped server client with no `department_id` filter — it asks for
ALL machines and relies entirely on RLS. If the requesting user's
`accessible_departments` array is empty or null (common for new employees
created by the `handle_new_user` trigger, which only sets `full_name` and
`role`), the policy returns zero rows and PostgREST returns a 406/500.
Fix: add a `department_id` filter to the query matching the route's
department, and ensure the `handle_new_user` trigger populates
`accessible_departments` from `department_id` when it is set.

**1e. Run the audit suite.** `pnpm audit:rls` and `pnpm audit:rls-matrix`
produce the authoritative RLS coverage matrix. Diff it against the live
failures. `pnpm audit:drift` checks contract/schema sync.