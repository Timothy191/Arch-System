-- ============================================
-- Migration: 175_fix_cron_mv_refresh_schedules
-- Description: Reschedule pg_cron matview refreshes to direct CONCURRENTLY
--   statements, replacing function-wrapped refresh commands.
--
-- WHY THIS EXISTS
--   REFRESH MATERIALIZED VIEW CONCURRENTLY cannot run inside a transaction
--   block. Migrations 065/073/074 scheduled `SELECT public.<fn>()` cron
--   commands where those functions performed REFRESH ... CONCURRENTLY in their
--   plpgsql bodies, so every scheduled run failed at runtime with
--   "cannot be executed inside a transaction block". The scheduled job names
--   below had to be re-pointed at the bare REFRESH statements (pg_cron
--   executes each job command in its own transaction, so the direct statement
--   is legal -- the same pattern 023_pg_cron_schedules.sql already uses).
--
--   Environments that already applied 065/073/074 keep the broken schedules,
--   so this migration re-registers each job by name. cron.schedule(name, ...)
--   updates the existing job when the name is already registered, making this
--   idempotent across fresh boots and already-patched databases.
--
--   The refresh_production_summary() / refresh_hourly_production() /
--   refresh_*_smart() helpers remain as plain-refresh manual helpers; only the
--   scheduled command changes to the CONCURRENTLY form.
-- ============================================

-- dept production summary (was: SELECT public.refresh_dept_production_summary_smart())
SELECT cron.schedule(
  'refresh-dept-production-summary',
  '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY dept_production_summary'
);

-- machine utilization weekly (was: SELECT public.refresh_machine_utilization_weekly_smart())
SELECT cron.schedule(
  'refresh-machine-utilization-weekly',
  '5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY machine_utilization_weekly'
);

-- safety incident monthly (was: SELECT public.refresh_safety_incident_monthly_smart())
SELECT cron.schedule(
  'refresh-safety-incident-monthly',
  '10 0,6,12,18 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY safety_incident_monthly'
);

-- control-room production summary (was: SELECT refresh_production_summary())
SELECT cron.schedule(
  'refresh-view-production-summary',
  '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY view_production_summary'
);

-- hourly production trend (was: SELECT refresh_hourly_production())
SELECT cron.schedule(
  'refresh-view-hourly-production',
  '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY view_hourly_production'
);