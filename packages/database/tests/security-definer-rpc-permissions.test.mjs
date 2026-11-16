import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { extractCreateFunction } from './sql-extract.mjs';

const MIGRATION_PATH = new URL(
  '../migrations/219_harden_security_definer_rpc_permissions.sql',
  import.meta.url
);

const REDEFINED_RPCS = [
  'public.get_unified_shift_compilation',
  'public.get_multi_site_shift_compilation',
  'public.atomic_machine_operator_dispatch',
  'public.get_monolithized_department_dashboard_payload',
  'public.get_machine_latest_closing_smr',
  'public.get_avg_tire_lifespan',
  'public.cache_vector_search_results',
  'public.get_cached_vector_search',
  'public.record_vector_search_performance',
  'public.refresh_safety_incident_monthly_smart',
];

const DEPARTMENT_SCOPED_RPCS = [
  'public.get_unified_shift_compilation',
  'public.get_multi_site_shift_compilation',
  'public.atomic_machine_operator_dispatch',
  'public.get_monolithized_department_dashboard_payload',
];

const USER_SCOPED_VECTOR_RPCS = [
  'public.cache_vector_search_results',
  'public.get_cached_vector_search',
  'public.record_vector_search_performance',
];

const AUTHENTICATED_RPC_SIGNATURES = [
  'public.get_unified_shift_compilation(uuid, date, character varying)',
  'public.get_multi_site_shift_compilation(uuid, date, character varying)',
  'public.atomic_machine_operator_dispatch(uuid, uuid, uuid, uuid, date, text, time without time zone, uuid)',
  'public.get_monolithized_department_dashboard_payload(uuid)',
  'public.get_machine_latest_closing_smr(uuid)',
  'public.get_avg_tire_lifespan()',
  'public.cache_vector_search_results(character varying, jsonb, jsonb, uuid, text, integer)',
  'public.get_cached_vector_search(character varying, uuid)',
  'public.record_vector_search_performance(uuid, text, integer, integer, integer, double precision, boolean)',
  'public.can_access_department(uuid, public.department_access_level)',
  'public.current_employee_id()',
  'public.get_employee_department()',
  'public.has_permission(text)',
  'public.is_access_control()',
  'public.get_production_summary(date, date)',
  'public.get_production_trend(integer)',
];

const MAINTENANCE_RPC_SIGNATURES = [
  'public.refresh_safety_incident_monthly_smart()',
  'public.add_partition_check_constraints()',
  'public.archive_old_partitions(integer)',
  'public.cleanup_vector_search_cache()',
  'public.create_next_month_partitions()',
  'public.log_mv_refresh_end(uuid, text, text, integer)',
  'public.log_mv_refresh_start(text, boolean, text)',
  'public.refresh_dept_production_summary_smart()',
  'public.refresh_machine_utilization_weekly_smart()',
  'public.archive_monthly_drill_operations()',
  'public.refresh_hourly_production()',
  'public.refresh_production_summary()',
  'public.record_slo_measurement(text, numeric, numeric, numeric, timestamp with time zone, timestamp with time zone, jsonb)',
];

const escapeRegex = (literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readMigrationSql = () => {
  assert.ok(
    existsSync(MIGRATION_PATH),
    'Missing migration 219_harden_security_definer_rpc_permissions.sql'
  );
  return readFileSync(MIGRATION_PATH, 'utf8');
};

test('Given migration 219, When checked for anti-patterns, Then anonymous bypass and transactional CONCURRENTLY refresh are absent', () => {
  const migrationSql = readMigrationSql();
  assert.doesNotMatch(
    migrationSql,
    /IF\s+auth\.uid\(\)\s+IS\s+NOT\s+NULL\s+AND\s+NOT\s+EXISTS/i,
    'Migration 219 must not reintroduce the anonymous auth.uid() IS NOT NULL bypass pattern'
  );
  assert.doesNotMatch(
    migrationSql,
    /REFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY/i,
    'Migration 219 must not execute REFRESH MATERIALIZED VIEW CONCURRENTLY inside migration or plpgsql bodies'
  );
});

test('Given migration 219, When each vulnerable SECURITY DEFINER function is extracted, Then it pins search_path and enforces caller authentication', () => {
  const migrationSql = readMigrationSql();

  for (const functionName of REDEFINED_RPCS) {
    const definition = extractCreateFunction(migrationSql, functionName);
    assert.ok(definition, `${functionName} must be redefined in migration 219`);
    assert.match(definition, /SECURITY\s+DEFINER/i, `${functionName} must remain SECURITY DEFINER`);
    assert.match(definition, /SET\s+search_path\s*=\s*''/i, `${functionName} must pin search_path`);
    assert.match(
      definition,
      /ERRCODE\s*=\s*'42501'/i,
      `${functionName} must raise SQLSTATE 42501 on unauthorized calls`
    );
    assert.match(
      definition,
      /request\.jwt\.claim\.role/,
      `${functionName} must inspect request.jwt.claim.role for service/anon context`
    );
  }
});

test('Given migration 219, When department and vector RPCs are extracted, Then they enforce RBAC and user identity isolation', () => {
  const migrationSql = readMigrationSql();

  for (const functionName of DEPARTMENT_SCOPED_RPCS) {
    const definition = extractCreateFunction(migrationSql, functionName);
    assert.ok(definition, `${functionName} must be present`);
    assert.match(
      definition,
      /FROM\s+public\.employees\b/i,
      `${functionName} must verify department access against public.employees`
    );
    assert.match(
      definition,
      /auth\.uid\(\)\s+IS\s+NULL/i,
      `${functionName} must reject NULL auth.uid() for non-service callers`
    );
  }

  for (const functionName of USER_SCOPED_VECTOR_RPCS) {
    const definition = extractCreateFunction(migrationSql, functionName);
    assert.ok(definition, `${functionName} must be present`);
    assert.match(
      definition,
      /p_user_id\s+IS\s+DISTINCT\s+FROM\s+auth\.uid\(\)/i,
      `${functionName} must enforce p_user_id matches auth.uid() for non-service callers`
    );
  }

  const dashboardDef = extractCreateFunction(
    migrationSql,
    'public.get_monolithized_department_dashboard_payload'
  );
  assert.match(
    dashboardDef,
    /to_regclass\(\s*'public\.safety_incidents'\s*\)/i,
    'get_monolithized_department_dashboard_payload must guard dropped public.safety_incidents via to_regclass'
  );

  const smartRefreshDef = extractCreateFunction(
    migrationSql,
    'public.refresh_safety_incident_monthly_smart'
  );
  assert.match(
    smartRefreshDef,
    /to_regclass\(\s*'public\.safety_incident_monthly'\s*\)/i,
    'refresh_safety_incident_monthly_smart must guard dropped public.safety_incident_monthly via to_regclass'
  );
});

test('Given migration 219, When RPC privileges are inspected, Then PUBLIC and anon EXECUTE are revoked across all 29 exposed RPCs', () => {
  const migrationSql = readMigrationSql();
  const normalizedSql = migrationSql.replace(/\s+/g, ' ');

  for (const signature of AUTHENTICATED_RPC_SIGNATURES) {
    const escaped = escapeRegex(signature);
    assert.match(
      normalizedSql,
      new RegExp(`REVOKE ALL ON FUNCTION ${escaped} FROM PUBLIC, anon;`, 'i'),
      `Missing REVOKE FROM PUBLIC, anon on ${signature}`
    );
    assert.match(
      normalizedSql,
      new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped} TO authenticated, service_role;`, 'i'),
      `Missing GRANT EXECUTE TO authenticated, service_role on ${signature}`
    );
  }

  for (const signature of MAINTENANCE_RPC_SIGNATURES) {
    const escaped = escapeRegex(signature);
    assert.match(
      normalizedSql,
      new RegExp(`REVOKE ALL ON FUNCTION ${escaped} FROM PUBLIC, anon, authenticated;`, 'i'),
      `Missing REVOKE FROM PUBLIC, anon, authenticated on maintenance RPC ${signature}`
    );
    assert.match(
      normalizedSql,
      new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped} TO service_role;`, 'i'),
      `Missing GRANT EXECUTE TO service_role on maintenance RPC ${signature}`
    );
  }

  assert.match(
    normalizedSql,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon/i,
    'Migration 219 must lock down default function execute privileges for PUBLIC and anon'
  );
});
