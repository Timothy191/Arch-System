# Schema & Contract Drift Audit Report

Generated on 2026-09-03T10:31:18.524Z

## Fitness Function Telemetry
- **Database Tables Scanned**: 86
- **Zod Contract Schemas**: 63
- **Drift Health Index (DHI)**: 31.4%
- **Contract Coverage Rating**: 🟡 Needs Review

## Synchronized Domain Contracts (27 Tables)
| Database Table | Migration Source | Contract Schema |
| :--- | :--- | :--- |
| `daily_logs` | `001_initial.sql` | `dailyLogSchema` |
| `production_logs` | `001_initial.sql` | `productionDailyLogSchema` |
| `shift_notes` | `002_control_room_tables.sql` | `controlRoomShiftReportSchema, unifiedShiftReportSchema` |
| `excavator_activity` | `002_control_room_tables.sql` | `excavatorHaulSchema` |
| `dozer_rolls` | `002_control_room_tables.sql` | `dozerRollSchema` |
| `breakdowns` | `004_breakdowns.sql` | `createBreakdownSchema, breakdownReportEntrySchema` |
| `memory_embeddings` | `009_ai_memory.sql` | `aiHandoffSchema, riskAssessmentSchema` |
| `shift_status` | `0145_shift_closeout.sql` | `lockAndSignShiftSchema` |
| `tires` | `0146_tire_management.sql` | `tireSchema, createTireSchema, replaceTireSchema` |
| `tire_inspections` | `0146_tire_management.sql` | `tireInspectionSchema, logTireInspectionSchema` |
| `webhook_endpoints` | `017_webhooks.sql` | `createWebhookSchema, updateWebhookSchema` |
| `drill_operations` | `024_drill_operations.sql` | `drillOperationSchema, drillTelemetryIngestSchema` |
| `badges` | `028_access_control_system.sql` | `scannerBadgeSchema` |
| `ai_usage_logs` | `032_ai_usage_logs.sql` | `aiChatSchema, aiSafetySchema, aiPredictSchema` |
| `fleet` | `035_fleet_and_equipment_tables.sql` | `fleetSchema` |
| `equipment` | `035_fleet_and_equipment_tables.sql` | `equipmentSchema` |
| `card_printers` | `076_card_printing_infrastructure.sql` | `PrintRequestSchema` |
| `card_templates` | `076_card_printing_infrastructure.sql` | `PrintRequestSchema` |
| `print_jobs` | `076_card_printing_infrastructure.sql` | `PrintRequestSchema` |
| `issued_cards` | `076_card_printing_infrastructure.sql` | `PrintRequestSchema, EmployeeProfileUpdateSchema` |
| `satellite_deformations` | `078_satellite_insar_deformations.sql` | `insarTelemetryIngestSchema, insarGeoTIFFUploadSchema` |
| `ai_token_usage` | `100_ai_token_usage_tracking.sql` | `aiChatSchema, aiPredictSchema` |
| `excavator_haul_logs` | `148_multi_site_production_report.sql` | `excavatorHaulSchema` |
| `excavator_truck_tallies` | `148_multi_site_production_report.sql` | `truckTallySchema` |
| `dozer_rollover_logs` | `148_multi_site_production_report.sql` | `dozerRolloverEntrySchema` |
| `ancillary_shift_logs` | `148_multi_site_production_report.sql` | `ancillaryReportEntrySchema` |
| `compliance_audit_runs` | `151_operational_compliance_checks.sql` | `complianceAuditRunSchema, createComplianceAuditRunSchema` |

## System & Infrastructure Tables (59 Tables)
- `departments` (001_initial.sql)
- `employees` (001_initial.sql)
- `machines` (001_initial.sql)
- `machine_hours` (001_initial.sql)
- `fuel_logs` (001_initial.sql)
- `operators` (002_control_room_tables.sql)
- `sites` (002_control_room_tables.sql)
- `machine_operations` (002_control_room_tables.sql)
- `hourly_loads` (002_control_room_tables.sql)
- `delay_categories` (002_control_room_tables.sql)
- `report_templates` (002_control_room_tables.sql)
- `generated_reports` (002_control_room_tables.sql)
- `engineering_notes` (003_control_room_revisions.sql)
- `operational_delays` (003_control_room_revisions.sql)
- `safety_severities` (006_safety_department.sql)
- `safety_incident_categories` (006_safety_department.sql)
- `safety_incidents` (006_safety_department.sql)
- `audit_logs` (007_audit_logs.sql)
- `mine_blocks` (008_excavator_activity_redesign.sql)
- `excavator_dumper_assignments` (008_excavator_activity_redesign.sql)
- `user_feedback` (015_user_feedback.sql)
- `quick_feedback` (015_user_feedback.sql)
- `webhook_delivery_logs` (017_webhooks.sql)
- `machine_telemetry` (025_machine_telemetry.sql)
- `machine_telemetry_archive` (025_machine_telemetry.sql)
- `drill_operations_archive` (027_drill_shifts_and_archiving.sql)
- `personnel` (028_access_control_system.sql)
- `visitors` (028_access_control_system.sql)
- `access_logs` (028_access_control_system.sql)
- `sync_watermarks` (031_embedding_sync_watermarks.sql)
- `access_logs_archive` (033_access_logs_weekly_archival.sql)
- `documents` (036_documents.sql)
- `document_versions` (036_documents.sql)
- `machine_configurations` (042_machine_configurations.sql)
- `machine_operations_archive` (046_control_room_archiving.sql)
- `excavator_activity_archive` (046_control_room_archiving.sql)
- `excavator_dumper_assignments_archive` (046_control_room_archiving.sql)
- `operational_delays_archive` (046_control_room_archiving.sql)
- `dozer_rolls_archive` (046_control_room_archiving.sql)
- `engineering_notes_archive` (046_control_room_archiving.sql)
- `embedding_cache` (059_embedding_cache.sql)
- `vector_search_cache` (064_vector_search_query_optimization.sql)
- `vector_search_performance` (064_vector_search_query_optimization.sql)
- `materialized_view_refresh_log` (065_materialized_view_refresh_optimization.sql)
- `cache_events` (067_cache_events.sql)
- `cache_anomalies` (067_cache_events.sql)
- `delay_entries` (068_delay_entries_table.sql)
- `delay_entries_archive` (068_delay_entries_table.sql)
- `roles` (070_control_room_operator_role_and_lookup.sql)
- `material_density` (073_production_summary_view.sql)
- `secrets_rotation_log` (085_secrets_rotation_log.sql)
- `shift_completeness_alerts` (086_shift_completeness_alerts.sql)
- `data_integrity_issues` (087_data_integrity_issues.sql)
- `shift_integrity_reports` (088_shift_integrity_reports.sql)
- `slo_metrics` (091_slo_monitoring.sql)
- `feature_flags` (092_feature_flags.sql)
- `feature_flag_exposures` (092_feature_flags.sql)
- `ab_test_results` (092_feature_flags.sql)
- `control_room_shift_reports` (096_control_room_shift_reports.sql)
