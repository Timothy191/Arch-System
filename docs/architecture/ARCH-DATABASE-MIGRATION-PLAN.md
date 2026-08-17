# ArchDB production migration plan

## Target

Move the business portal from fragmented database access toward one governed PostgreSQL data plane and a Supabase-inspired Studio/control plane.

## Phase 0 — inventory

- Identify every current database, SQLite file, ORM model, API route and direct SQL caller.
- Map each business entity to an owning PostgreSQL schema/table.
- Identify sensitive columns and current access rules.
- Freeze destructive legacy changes during migration windows.

## Phase 1 — foundation

- Deploy PostgreSQL with encrypted storage and automated backups.
- Create separate owner, migration, application-read/write and read-only roles.
- Establish schemas for business domains and `arch` metadata.
- Add migration table and advisory-lock based migration runner.
- Add health checks and connection-pool monitoring.

## Phase 2 — data migration

For each legacy store:

1. Export and checksum source data.
2. Transform into normalized PostgreSQL staging tables.
3. Validate row counts, keys, nullability and referential integrity.
4. Load production tables inside controlled transactions.
5. Compare checksums and sampled records.
6. Run application integration tests.
7. Switch reads.
8. Switch writes.
9. Keep rollback snapshot until verification passes.

## Phase 3 — security

- Enable RLS for tenant/user-owned data.
- Create explicit policies for every exposed table.
- Deny public access by default.
- Restrict schema changes to migration role.
- Record privileged actions in append-only audit tables.
- Rotate all legacy database credentials after cutover.

## Phase 4 — Studio

Studio must provide:

- Projects and environments.
- Database connection health.
- Schema explorer.
- Table browser.
- Row CRUD.
- SQL editor with permission boundaries.
- Index/constraint inspection.
- RLS policy editor.
- Roles/grants inspection.
- Migration history.
- Audit log.
- Realtime subscriptions/status.
- Backup/restore status.

## Phase 5 — integrations

Expose versioned APIs and typed SDKs for the business portal, CLI agents and MCP adapters. Keep integration credentials scoped to their required operations.

## Phase 6 — production hardening

- Load and concurrency tests.
- Backup restore drills.
- Migration rollback drills.
- Connection exhaustion tests.
- RLS authorization tests.
- Audit integrity checks.
- Realtime reconnect tests.
- Rate-limit and abuse tests.
- Disaster-recovery runbook.

## Definition of done

The legacy database is read-only or retired, all production writes pass through governed PostgreSQL interfaces, migrations are reproducible, RLS and role boundaries are tested, backups restore successfully, and Studio can inspect and operate the database without exposing privileged credentials to clients.
