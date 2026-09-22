# Runbook: Database Restore Drill

**Severity:** Critical

## Actions

1. This system relies on `idempotency_keys` strictly tied to `shift_reports`.
2. Do not restore partial tables. Use PITR (Point-In-Time Recovery) on the entire cluster.
3. Validate `supabase_migrations` table is in sync after restore.
