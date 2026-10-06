# Design: Harden Offline Mutation Writes

## Request Boundary

`POST /api/offline-mutations` authenticates through
`getAuthenticatedEmployee()` using the session-bound Supabase client. The
route rejects missing users, missing employee/department records, and viewers.
The caller cannot choose a tenant: the RPC tenant argument is taken from the
employee's primary department. The shared contract caps batches at 500
mutations and limits string, clock, and SMR values.

## Database Boundary

Migration 172 replaces the existing RPC in place without editing migration 171.
The `SECURITY DEFINER` function:

1. Requires `auth.uid()` and loads the employee row from
   `public.employees`.
2. Rejects viewers and tenants outside the employee's primary or explicitly
   accessible departments; administrators retain cross-department access.
3. Validates a non-empty JSON array of at most 500 supported SMR operations.
4. Uses schema-qualified tables and keeps `search_path` empty.
5. Revokes execution from `PUBLIC` and `anon`, then grants it only to
   `authenticated`.

RLS remains enabled on both data tables. The RPC's security-definer privileges
do not replace its explicit employee/department authorization.

## Failure Semantics

- Unauthenticated or unauthorized RPC callers receive SQLSTATE `42501`.
- Invalid tenant, batch shape, or oversized batches receive `22023`.
- Invalid individual fields fail before persistence; PostgreSQL exceptions
  roll back the complete batch.
- Replaying an already-recorded `(tenant_id, mutation_id)` does not duplicate
  either mutation-log or SMR rows.
- Shift closeout retries unwrap the stored idempotent response, reattempt SMR
  persistence using deterministic mutation IDs, and return HTTP 503 with
  `Retry-After` if SMR persistence fails after the closeout report is committed.
- Migration 166 is already applied in production and remains unchanged. Its
  legacy index references a relation absent from the checked-in earlier
  migrations, so a fresh-database replay prerequisite remains to be resolved
  separately without rewriting deployed migration history.

## Verification

- Contract schema tests exercise valid, malformed, negative, and oversized
  batches.
- Route tests assert authentication, employee scope, viewer rejection, payload
  rejection, bounded RPC arguments, idempotent closeout retries, and retryable
  SMR persistence failures.
- Database regression checks inspect grants and authorization clauses, and
  migration 171→172 is exercised against a disposable local PostgreSQL database.
- Migration safety, RLS matrix, contract drift, full quality, portal build, and
  Vercel preflight run locally. The cloud database is not modified here.
