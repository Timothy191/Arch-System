# Database Package Agent Tracer

## 2026-10-27T07:06:00+02:00: Schema-Qualify pg_stat_statements, MV Refresh Logs & Expose get_pg_cron_jobs_health (209)

- **Purpose**: `public.get_slow_queries`, `public.log_mv_refresh_start`, `public.log_mv_refresh_end`, `public.check_mv_freshness`, and `public.get_mv_refresh_stats` set `search_path = ''` while referencing `pg_stat_statements` (installed in `extensions`) and `materialized_view_refresh_log` (in `public`) without schema qualification (`42P01`).
- **Changes**:
  - `migrations/209_fix_pg_stat_statements_and_cron_health_rpc.sql`: Schema-qualified `extensions.pg_stat_statements` and `public.materialized_view_refresh_log`, hardened execute grants (`REVOKE ALL FROM PUBLIC, anon`), and added `public.get_pg_cron_jobs_health()` returning `cron.job` schedules joined with latest `cron.job_run_details`.
- **Verification**: `pnpm --filter @repo/database test` ✅, `pnpm --filter @repo/database lint:migrations` ✅.

## 2026-10-23T09:05:51+02:00: Repair get_production_summary search_path Replay Failure (194)

- **Purpose**: `get_production_summary` and `refresh_production_summary` declare `SET search_path = ''` but referenced `view_production_summary` unqualified. Creation fails on a fresh replay under the default `check_function_bodies = on`, and calls fail where creation was forced off (the executive Hub silently rendered zero KPIs).
- **Changes**:
  - `migrations/073_production_summary_view.sql`: Schema-qualified the materialized view in both function bodies; added reviewed Squawk inline ignores for the historical `BEGIN`/`COMMIT`, drop-view, and non-concurrent-index patterns that re-linting would otherwise flag.
  - `migrations/194_fix_production_summary_rpc.sql`: Idempotent `CREATE OR REPLACE` repair plus grant for databases that already applied 073.
  - `tests/production-summary-functions.test.mjs`: Static guard that both migrations keep the view schema-qualified; wired into `pnpm test`.
  - `tests/migration-replay.mjs`: Docker replay of the real 073/194 DDL against `postgres:17-alpine` with a negative control, functional call, `proconfig`, and `SECURITY DEFINER` assertions; exposed as `test:migration-replay` and run in the CI policy-check job.
- **Verification**: `pnpm --filter @repo/database test` ✅, `test:migration-replay` (14/14) ✅, Squawk/RLS lint on both migrations ✅, `check-migrations` ✅, `policy:check` ✅, codebase-map parity ✅.

## 2026-10-23T02:51:00+02:00: Active Operational Sites Consolidation Migration (193)

- **Purpose**: Deactivate legacy placeholder sites (`PIT-01`, `PIT-02`, `STOCK-A`, `BRD-01`, `NP-01`, `UMALAZI`, `WIT-01`) and ensure the three operational sites (`Brakfontein Pit` `BRAK-PIT`, `Brakfontein Plant` `BRAK-PLANT`, `Extension Pit` `EXT-PIT`) are active in `sites`.
- **Changes**:
  - `packages/database/migrations/193_correct_active_sites.sql`: Added idempotent update and `ON CONFLICT (code) DO UPDATE` upsert for the active sites.
- **Verification**: `pnpm --filter @repo/database test` ✅.

## 2026-10-22T10:37:00+02:00: Baseline Immutable Applied Migrations in Rollback Safety Checker

- **Purpose**: Baseline immutable applied migrations (`001`–`189`) in `tests/migration-rollback-safety.mjs` while enforcing strict `DROP ... IF EXISTS` errors across all 142 migrations and strict rollback warnings on all new migrations (`> 189`), achieving 0 errors and 0 warnings without mutating historical migration files.

## 2026-10-05T17:12:00+02:00: Offline Mutation RPC Hardening

- **Purpose**: Independently enforce authentication and department authorization
  for the offline SMR mutation RPC while preserving deployed migration history.
- **Changes**:
  - Added migration 172 to validate employee permissions and bounded SMR
    payloads, schema-qualify affected tables, keep `search_path` empty, and
    restrict function execution to `authenticated`.
  - Added static regression assertions for RPC authorization, grants, migration
    sequence uniqueness, and database migration prerequisites.
- **Runtime verification**: Applied migrations 171 and 172 in a disposable
  local PostgreSQL database and verified a valid write, cross-department denial,
  empty-batch rejection, and `anon`/`authenticated` execute privileges. The
  temporary database was dropped. No existing local data or cloud database was
  modified.
- **Quality checks**: Database migration/security checks, RLS audit (94/94
  tables), and the repository-wide quality gate passed. The rollback-safety
  analyzer continues to report 92 legacy warnings and zero errors.
- **Migration-history finding**: Production migration 166 is applied and was
  left unchanged. Its index references `smr_latest_tenant_meter`, which is not
  created by any earlier checked-in migration; clean database bootstrap still
  requires a separate, history-safe fix.
- **Deployment note**: The production migration history is not fully verified
  beyond migration 166, so no live migration or Vercel deployment was performed.
  The OpenSpec CLI could not validate the Markdown artifacts because the
  `openspec` mise shim reports no configured version.

## 2026-10-06: Remaining Migration Rollout Blockers

- **History evidence conflict**: an earlier linked snapshot reported migration
  164, while the 2026-10-05 review reports migration 166 applied. The target's
  complete history beyond 166 remains unverified; no hosted write was made.
- **Bootstrap defect**: migration 166 unconditionally creates
  `smr_latest_tenant_meter_idx` on `smr_latest_tenant_meter`, but no earlier
  checked-in migration creates that relation. The later offline migration 171
  instead creates `smr_latest` with different columns. Migration 166 is reported
  applied and was not edited; clean bootstrap repair requires a reviewed,
  history-safe plan.
- **Generated types**: `database.types.ts` still omits the new Control Room RPC
  signatures. The configured generator targets the hosted project; do not run
  it without approval. Generate from the reviewed target schema before rollout.

## 2026-10-06: Local and Linked Migration History Recheck

- **Local read-only evidence**: `supabase_migrations.schema_migrations`
  currently ends at version 164. The local schema nevertheless has
  `atomic_shift_closeout` and `atomic_split_hourly_load`, showing that prior
  local SQL testing did not record those operations as tracked migrations.
- **Migration 166 defect confirmed locally**:
  `to_regclass('public.smr_latest_tenant_meter')` is null, and
  `166_harden_legacy_migrations.sql` unconditionally creates an index on that
  relation. The committed migration 165 creates `smr_readings` and
  `smr_latest` with `(tenant_id, meter_id)` fields and a unique index on those
  columns, not `smr_latest_tenant_meter(tenant_id, meter_type, recorded_at)`.
  Thus the tracked 165→166 clean replay is inconsistent; migration 171's
  worktree version retains the same `smr_latest` schema and does not repair the
  mismatch.
- **Linked check unavailable**: `supabase migration list --linked` requires a
  Supabase access token and linked project ref; the configured Postgres MCP
  reports that its `postgres.<project-ref>` tenant cannot be found. No remote
  query or migration write was performed.
- **Vercel environment fallback unavailable**: production DB variable names
  are configured, but a protected environment pull supplied redacted
  placeholders to this runtime. The values were not logged or used to initiate
  a connection; hosted migration history remains unverified.
- **Type generation unavailable from this checkout**: `packages/database/supabase`
  has no Supabase `config.toml`; `supabase gen types --local` therefore cannot
  connect through the CLI workflow and requests a Supabase access token.
  Generated RPC signatures remain a deployment gate; no hand-edited generated
  types were introduced.

## 2026-10-06: Supabase CLI and Postgres MCP Repair Attempt

- **CLI config initialized**: ran `npx supabase init --workdir packages/database
--yes`, creating `packages/database/supabase/config.toml`.
- **Project endpoint verified**: the provided project ref
  `mrwhtxbhrzyttlsyuofc` resolves to a Supabase Auth endpoint (HTTP 401 without
  an API key, expected for this unauthenticated health request).
- **CLI authentication remains blocked**: no `SUPABASE_ACCESS_TOKEN` is
  available. `supabase login --no-browser` requires a token in this non-TTY
  runtime; the browser login flow requires the project owner to complete
  interactive verification. `supabase link --project-ref ...` correctly
  reports the missing CLI access token. No project link or remote write
  occurred.
- **MCP connection config corrected**: replaced the literal
  `postgres.<project-ref>` in `.mcp.json` with the supplied project ref and
  made the connection string an external `SUPABASE_DATABASE_URL` setting.
  Restart/reload MCP after setting the rotated URL; the database connection
  has not been authenticated or verified.
- **Verification**: `pnpm mcp:verify` passes and Biome validates `.mcp.json`.
  The connection itself was not testable because no DB password is configured.
  `pnpm agent:verify` currently fails at workspace lint due to pre-existing
  formatting in `packages/utils/src/openrouter.ts`; that unrelated file was
  not changed.
- **Current connection setting**: the root `.mcp.json` now reads a complete
  `SUPABASE_DATABASE_URL` from the MCP host environment and passes it quoted to
  the Postgres server process. The same variable is used in the other tracked
  client MCP configuration surfaces. This runtime has neither that variable
  nor `SUPABASE_ACCESS_TOKEN`; parsing/registration is not equivalent to
  authenticated connectivity.

## 2026-10-06: Postgres MCP Credential Handling

- **Connection source**: changed the Postgres MCP launcher to pass
  `SUPABASE_DATABASE_URL` through a quoted shell expansion. This supports the
  supplied direct-host connection format without storing a database password
  in tracked MCP configuration or relying on argument interpolation.
- **Credential safety**: database credentials and a Supabase secret key were
  pasted into the conversation. Do not reuse or record them. Rotate the
  database password and revoke/rotate the exposed secret key in Supabase, then
  set `SUPABASE_DATABASE_URL` in the local MCP host environment using the new
  password (URL-encode reserved characters) and restart/reload MCP.
- **State**: no authenticated database query was made, and no Supabase CLI
  access token was available for `supabase login`/`supabase link`.
- **Git scope requested by user**: staged 212 expanded source/config/document
  paths from the working tree without committing; excluded nine local
  generated index/state artifacts. The staged diff has whitespace warnings in
  archived content and existing unrelated files; no unrelated mass-formatting
  was performed.

## 2026-10-06: Migration Tree Consolidation & Fresh-Boot Hardening

- **Purpose**: Implement the delivered DB/migration remediation plan end to end —
  single migration tree, fresh-boot-safe legacy guards, and a drift gate that
  catches the ghost-relation bug class automatically.
- **Changes**:
  - Consolidated the stale `packages/supabase/migrations/` duplicate (122
    tracked files) into the canonical `packages/database/migrations/` via a
    symlink (`../database/migrations`); wired the Supabase CLI project dir
    (`packages/database/supabase/migrations`) to the same tree (`../migrations`).
    The only file that existed solely in the stale tree
    (165 block_drilled sync) is preserved as new migration **174**.
  - Replaced transaction-block-hostile `REFRESH MATERIALIZED VIEW CONCURRENTLY`
    calls inside plpgsql bodies (065/073/074) with plain refreshes in the
    functions; pg_cron jobs now invoke bare `REFRESH ... CONCURRENTLY`
    statements directly (pg_cron's own transaction). New migration **175**
    re-registers the five cron jobs by name so already-applied environments
    converge too (`cron.schedule` upserts by name → idempotent).
  - Guarded every legacy ghost-relation reference in 166 (`smr_latest_tenant_meter`,
    `production_summary`, `hourly_production`) behind `to_regclass()` checks so a
    clean 001..175 bootstrap no longer fails on relations no migration creates.
  - Moved `standalone_unblock_missing_tables.sql` out of the migration tree into
    `packages/database/ops/` (it would otherwise install a wide-open
    `delay_entries` policy on fresh boots); removed three untracked `.backup`
    artifacts; fixed `supabase/config.toml` seed path (`../../supabase/seed.sql`).
  - Added `tests/check-migration-drift.mjs` (filename/duplicate-version lint,
    symlink consolidation enforcement, missing-relation hygiene with
    `to_regclass` guard awareness, CONCURRENTLY-in-body detection, `.backup`
    ban) and wired `check-migrations`, `migrate:lint`, `sync-migrations`,
    `supabase:start/reset/push` package scripts with root-level aliases.
  - Removed the dead `@repo/database` alias from `apps/portal/tsconfig.json`
    and `apps/portal/jest.config.cjs` (verified zero imports).
- **Runtime verification**: The drift linter first reproduced the ghost-index
  bug as 15 errors, then reported 0 errors / 7 warnings after the guards
  (6 legacy-compat to_regclass guards + the pre-existing 0145/0146 ordering
  quirk, deliberately not renumbered to protect prod `schema_migrations`).
  Rollback-safety and offline-mutation-security test suites still pass.
- **Deployment note**: No live migration was pushed; 174/175 are new versions
  for environments that never applied 165/166+ locally. Fresh-boot and
  already-applied environments both converge.

## 2026-10-22T08:50:00+02:00: Post-165 Index Idempotency Hardening

- **Purpose**: Ensure all post-165 migrations use idempotent `CREATE [UNIQUE] INDEX IF NOT EXISTS` statements in `migration-rollback-safety.mjs`.
- **Changes**:
  - Updated `smr_latest_tenant_meter_idx` index creation in `migrations/166_harden_legacy_migrations.sql` and `migrations/171_offline_crdt_mutation_log_and_smr.sql` to include `IF NOT EXISTS`.
- **Verification**: `pnpm --filter @repo/database test` passed with 0 errors.

## 2026-10-26T18:30:00Z: Migration 206 Integration Platform RLS & Constraint Hardening

- **Purpose**: Drop overly permissive `WITH CHECK (true)` insert policy on `integration_audit_logs`, add `auth.users(id)` FKs for `installed_by`/`invoked_by`, add NULL-safe unique index `integration_installations_unique_scope`, and index `(installation_id, created_at DESC)`.
- **Changes**: `migrations/206_integration_rls_hardening.sql`.
- **Verification**: `pnpm --filter @repo/database test` passed (156 migrations, 0 errors, 0 warnings).
