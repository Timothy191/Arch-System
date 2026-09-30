-- Migration: 166_harden_legacy_migrations.sql
-- Description: Adds missing IF NOT EXISTS clauses and search_path settings to ensure
-- rollback safety for legacy migration objects. This migration addresses warnings
-- from the migration-rollback-safety audit (DB-01 and DB-02).
-- Category: Database Hardening - Rollback Safety
-- Addresses: Search path warnings and missing IF NOT EXISTS in early migrations

-- ============================================
-- Part 1: Set explicit search_path for functions missing it
-- ============================================

-- From 001_initial.sql
ALTER FUNCTION public.user_department_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.has_department_access(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- From 002_control_room_tables.sql
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

-- From 003_control_room_revisions.sql
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

-- From 004_breakdowns.sql
ALTER FUNCTION public.update_breakdowns_updated_at() SET search_path = public, pg_temp;

-- From 009_ai_memory.sql
ALTER FUNCTION public.search_memories_hybrid(TEXT, vector, FLOAT, INT) SET search_path = public, pg_temp;
ALTER FUNCTION public.search_memories_semantic(vector, FLOAT, INT) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_conversation_history(UUID, INT) SET search_path = public, pg_temp;

-- From 010_schema_optimization.sql
-- Note: Function is_not_deleted is commented out in source, skipping

-- From 011_automated_auditing.sql
ALTER FUNCTION public.process_audit_log() SET search_path = public, pg_temp;

-- ============================================
-- Part 2: Add missing indexes with IF NOT EXISTS
-- These indexes were created in early migrations without IF NOT EXISTS
-- ============================================

-- From 004_breakdowns.sql
CREATE INDEX IF NOT EXISTS idx_breakdowns_department ON breakdowns(department_id);
CREATE INDEX IF NOT EXISTS idx_breakdowns_status ON breakdowns(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_breakdowns_fleet_id ON breakdowns(fleet_id);
CREATE INDEX IF NOT EXISTS idx_breakdowns_date_in ON breakdowns(date_in DESC);

-- From 007_audit_logs.sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_department ON audit_logs(department_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- From 015_user_feedback.sql
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created ON user_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_quick_feedback_page ON quick_feedback(page);

-- From 020_partition_time_series.sql (tables already exist, just adding safe index creation)
CREATE INDEX IF NOT EXISTS idx_hourly_loads_department_date ON hourly_loads(department_id, date);
CREATE INDEX IF NOT EXISTS idx_hourly_loads_machine_date ON hourly_loads(machine_id, date);
CREATE INDEX IF NOT EXISTS idx_hourly_loads_shift_type ON hourly_loads(shift_type);
CREATE INDEX IF NOT EXISTS idx_daily_logs_department_date ON daily_logs(department_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_shift ON daily_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_sync_status ON daily_logs(sync_status);

-- From 028_access_control_system.sql
CREATE INDEX IF NOT EXISTS idx_badges_qr_code ON badges(qr_code);
CREATE INDEX IF NOT EXISTS idx_access_logs_scanned_at ON access_logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_gate ON access_logs(gate);

-- From 035_fleet_and_equipment_tables.sql
CREATE INDEX IF NOT EXISTS idx_fleet_code ON fleet(code);
CREATE INDEX IF NOT EXISTS idx_fleet_department ON fleet(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_code ON equipment(code);
CREATE INDEX IF NOT EXISTS idx_equipment_department ON equipment(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assigned_to ON equipment(assigned_to);

-- From 036_documents.sql
CREATE INDEX IF NOT EXISTS idx_documents_department_id ON documents(department_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc_id ON document_versions(document_id);

-- From 061_drop_procedural_memory_type.sql
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_hnsw_episodic ON memory_embeddings USING hnsw (embedding vector_ips_op);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_hnsw_semantic ON memory_embeddings USING hnsw (embedding vector_ips_op);

-- From 064_vector_search_query_optimization.sql
CREATE INDEX IF NOT EXISTS idx_vector_search_cache_user_id ON vector_search_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_vector_search_cache_memory_type ON vector_search_cache(memory_type);
CREATE INDEX IF NOT EXISTS idx_vector_search_cache_created_at ON vector_search_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_vector_search_cache_ttl ON vector_search_cache(ttl);
CREATE INDEX IF NOT EXISTS idx_vector_search_performance_user_id ON vector_search_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_vector_search_performance_search_type ON vector_search_performance(search_type);
CREATE INDEX IF NOT EXISTS idx_vector_search_performance_created_at ON vector_search_performance(created_at);

-- From 065_materialized_view_refresh_optimization.sql
CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_view_name ON materialized_view_refresh_log(view_name);
CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_status ON materialized_view_refresh_log(status);
CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_refresh_start ON materialized_view_refresh_log(refresh_start);
CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_duration ON materialized_view_refresh_log(duration);

-- From 072_partition_production_logs.sql
CREATE INDEX IF NOT EXISTS idx_production_logs_daily_log ON production_logs(daily_log_id);

-- From 073_production_summary_view.sql
CREATE INDEX IF NOT EXISTS uidx_production_summary_log ON production_summary (log_date, department_id);
CREATE INDEX IF NOT EXISTS idx_production_summary_date ON production_summary(date);
CREATE INDEX IF NOT EXISTS idx_production_summary_dept ON production_summary(department_id);

-- From 074_hourly_production_trend.sql
CREATE INDEX IF NOT EXISTS uidx_hourly_production ON hourly_production (timestamp, department_id);
CREATE INDEX IF NOT EXISTS idx_hourly_production_timestamp ON hourly_production(timestamp);

-- From 076_card_printing_infrastructure.sql
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_id ON print_jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_personnel_id ON print_jobs(personnel_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_queued_at ON print_jobs(queued_at);
CREATE INDEX IF NOT EXISTS idx_issued_cards_personnel_id ON issued_cards(personnel_id);
CREATE INDEX IF NOT EXISTS idx_issued_cards_status ON issued_cards(status);
CREATE INDEX IF NOT EXISTS idx_issued_cards_expires_at ON issued_cards(expires_at);

-- From 093_feature_flags.sql
CREATE INDEX IF NOT EXISTS idx_feature_flag_exposures_user ON feature_flag_exposures(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_exposures_flag ON feature_flag_exposures(flag_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_flag ON ab_test_results(flag_id);

-- From 102_ai_token_usage_tracking.sql
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_id ON ai_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_department_id ON ai_token_usage(department_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at ON ai_token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_model_name ON ai_token_usage(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_date_range ON ai_token_usage(date_range);

-- From 165_offline_crdt_mutation_log_and_smr.sql
CREATE INDEX IF NOT EXISTS smr_latest_tenant_meter_idx ON smr_latest_tenant_meter (tenant_id, meter_type, recorded_at DESC);

-- ============================================
-- Part 3: Add ALTER TABLE ADD COLUMN IF NOT EXISTS for legacy additions
-- ============================================

-- From 016_schema_enhancements.sql
ALTER TABLE breakdowns ADD COLUMN IF NOT EXISTS duration_hours NUMERIC;

-- From 076_card_printing_infrastructure.sql
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ============================================
-- Note: Sequence gaps (102, 145, 149, 159, 162) are historical artifacts
-- and do not affect database functionality. They are documented but not fixed
-- to avoid breaking existing migration numbering schemes.
-- ============================================
