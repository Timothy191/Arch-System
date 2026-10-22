-- ============================================================================
-- Migration: 192_enforce_function_search_paths.sql
-- Description: Hardens all public-schema SQL and PL/pgSQL functions by
--              enforcing an explicit, immutable `search_path = public, pg_temp`
--              configuration (remediating Supabase security linter warning
--              `function_search_path_mutable` / CWE-426).
-- ============================================================================

-- 1. Dynamic catalog sweep: idempotently lock `search_path = public, pg_temp`
--    on every function in the `public` schema that does not already have an
--    explicit `search_path` configuration in `pg_proc.proconfig`.
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM unnest(p.proconfig) AS cfg
          WHERE cfg LIKE 'search_path=%'
        )
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      fn_record.schema_name,
      fn_record.function_name,
      fn_record.identity_args
    );
  END LOOP;
END;
$$;

-- 2. Explicit signature-guarded hardening for known public functions across
--    migrations 001..191 (satisfies static analyzers and guarantees explicit
--    `search_path = public, pg_temp` across all overload signatures).
DO $$
DECLARE
  fn_sig TEXT;
  fn_signatures TEXT[] := ARRAY[
    'public.user_department_id()',
    'public.is_admin()',
    'public.has_department_access(uuid)',
    'public.handle_new_user()',
    'public.update_updated_at_column()',
    'public.update_breakdowns_updated_at()',
    'public.search_memories_hybrid(text, vector, double precision, integer)',
    'public.search_memories_hybrid(extensions.vector, text, uuid, text, text, integer, double precision, double precision, double precision, integer)',
    'public.search_memories_semantic(vector, double precision, integer)',
    'public.search_memories_semantic(extensions.vector, uuid, text, text, integer, double precision, integer)',
    'public.get_conversation_history(uuid, integer)',
    'public.get_conversation_history(text, uuid, integer)',
    'public.is_not_deleted()',
    'public.process_audit_log()',
    'public.is_active( timestamp with time zone )',
    'public.ensure_updated_at_trigger(text)',
    'public.submit_user_feedback(uuid, text, text, integer)',
    'public.submit_user_feedback(text, text, integer, text, uuid)',
    'public.submit_quick_feedback(uuid, text, integer)',
    'public.submit_quick_feedback(text, text, text, text)',
    'public.trigger_webhook_delivery()',
    'public.queue_webhook_delivery()',
    'public.get_monolithized_department_dashboard_payload(uuid)',
    'public.create_next_month_partitions()',
    'public.get_dept_production_summary()',
    'public.get_machine_utilization_weekly()',
    'public.get_safety_incident_monthly()',
    'public.update_drill_operations_updated_at()',
    'public.archive_telemetry_month(date)',
    'public.get_telemetry_summary(uuid, timestamp with time zone, timestamp with time zone)',
    'public.check_and_archive_telemetry()',
    'public.archive_monthly_drill_operations()',
    'public.get_user_daily_spend(uuid, date)',
    'public.archive_weekly_access_logs()',
    'public.set_updated_at()',
    'public.archive_monthly_control_room_shifts()',
    'public.notify_telemetry_webhook()',
    'public.get_avg_tire_lifespan()',
    'public.add_partition_check_constraints()',
    'public.apply_offline_mutations(uuid, jsonb)',
    'public.archive_old_partitions()',
    'public.atomic_approve_shift_report(uuid, uuid, text)',
    'public.atomic_machine_operator_dispatch(uuid, uuid, uuid, text)',
    'public.atomic_shift_closeout(uuid, date, text, uuid, text)',
    'public.atomic_split_hourly_load(uuid, numeric, numeric)',
    'public.auto_share_breakdown_with_control_room()',
    'public.autofill_machine_operation_start_smu()',
    'public.cache_vector_search_results(text, uuid, text, jsonb, integer)',
    'public.can_access_department(uuid)',
    'public.check_delay_hours_max_12_hours()',
    'public.check_mv_freshness()',
    'public.check_shift_immutable()',
    'public.cleanup_vector_search_cache()',
    'public.compute_breakdown_shift_delay()',
    'public.current_employee_id()',
    'public.enforce_employee_update_constraints()',
    'public.evaluate_feature_flag(text, uuid, jsonb)',
    'public.generate_vector_search_cache_key(text, uuid, text, integer)',
    'public.get_access_control_metrics_jsonb()',
    'public.get_cached_vector_search(text)',
    'public.get_drill_monthly_summary(date)',
    'public.get_employee_department()',
    'public.get_machine_latest_closing_smr(uuid)',
    'public.get_multi_site_shift_compilation(date, text)',
    'public.get_mv_refresh_stats()',
    'public.get_production_summary(uuid, date, date)',
    'public.get_production_trend(uuid, integer)',
    'public.get_slow_queries(integer)',
    'public.get_unified_shift_compilation(uuid, date, text)',
    'public.has_permission(text)',
    'public.is_access_control()',
    'public.log_mv_refresh_end(bigint, text, bigint, text)',
    'public.log_mv_refresh_start(text, text)',
    'public.record_slo_measurement(text, numeric, boolean, jsonb)',
    'public.record_vector_search_performance(uuid, text, integer, integer, boolean, integer)',
    'public.refresh_dept_production_summary_smart()',
    'public.refresh_hourly_production()',
    'public.refresh_machine_utilization_weekly_smart()',
    'public.refresh_production_summary()',
    'public.refresh_safety_incident_monthly_smart()',
    'public.resolve_breakdown_machine_id()',
    'public.sync_delays_to_drill_operations()',
    'public.sync_employee_to_operators()',
    'public.sync_personnel_to_operators()',
    'public.sync_smr_reading_to_machine_operations()',
    'public.sync_to_drill_operations()',
    'public.trg_control_room_shift_reports_lifecycle()',
    'public.update_satellite_deformations_updated_at()',
    'public.validate_delay_entry_time()',
    'public.validate_dozer_roll_date()'
  ];
BEGIN
  FOREACH fn_sig IN ARRAY fn_signatures
  LOOP
    IF to_regprocedure(fn_sig) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn_sig);
    END IF;
  END LOOP;
END;
$$;

-- Static analyzer reference declarations (all enforced above via to_regprocedure & pg_proc loop):
-- ALTER FUNCTION public.user_department_id() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.has_department_access(UUID) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.update_breakdowns_updated_at() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.process_audit_log() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.is_active(TIMESTAMPTZ) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.submit_user_feedback(UUID, TEXT, TEXT, INT) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.submit_quick_feedback(UUID, TEXT, INT) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.trigger_webhook_delivery() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.queue_webhook_delivery() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.get_monolithized_department_dashboard_payload(UUID) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.create_next_month_partitions() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.get_dept_production_summary() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.get_machine_utilization_weekly() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.get_safety_incident_monthly() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.update_drill_operations_updated_at() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.archive_telemetry_month(DATE) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.get_telemetry_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.check_and_archive_telemetry() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.archive_monthly_drill_operations() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.search_memories_hybrid(TEXT, vector, FLOAT, INT) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.search_memories_semantic(vector, FLOAT, INT) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.get_conversation_history(UUID, INT) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.get_user_daily_spend(UUID, DATE) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.archive_weekly_access_logs() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.archive_monthly_control_room_shifts() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.notify_telemetry_webhook() SET search_path = public, pg_temp;
-- ALTER FUNCTION public.get_avg_tire_lifespan() SET search_path = public, pg_temp;
