# 4-Operation Row-Level Security (RLS) Coverage Matrix Report

Generated on 2026-09-02T05:15:34.244Z

## Summary Metrics
- **Total Tables**: 86
- **RLS Enabled**: 86/86 (100.0%)
- **Critical Security Violations**: 0

## 4-Operation Policy Coverage Matrix
| Table Name | RLS Status | SELECT | INSERT | UPDATE | DELETE | Source Migration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `departments` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `001_initial.sql` |
| `employees` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `001_initial.sql` |
| `machines` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `001_initial.sql` |
| `daily_logs` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `001_initial.sql` |
| `machine_hours` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `001_initial.sql` |
| `fuel_logs` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `001_initial.sql` |
| `production_logs` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `001_initial.sql` |
| `operators` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `002_control_room_tables.sql` |
| `sites` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `002_control_room_tables.sql` |
| `machine_operations` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `002_control_room_tables.sql` |
| `hourly_loads` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `002_control_room_tables.sql` |
| `delay_categories` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `002_control_room_tables.sql` |
| `shift_notes` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `002_control_room_tables.sql` |
| `excavator_activity` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `002_control_room_tables.sql` |
| `dozer_rolls` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `002_control_room_tables.sql` |
| `report_templates` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `002_control_room_tables.sql` |
| `generated_reports` | ✅ ENABLED | 🟢 | ⚪ (Deny) | 🟢 | 🟢 | `002_control_room_tables.sql` |
| `engineering_notes` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `003_control_room_revisions.sql` |
| `operational_delays` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `003_control_room_revisions.sql` |
| `breakdowns` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `004_breakdowns.sql` |
| `safety_severities` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `006_safety_department.sql` |
| `safety_incident_categories` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `006_safety_department.sql` |
| `safety_incidents` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `006_safety_department.sql` |
| `audit_logs` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | 🟢 | `007_audit_logs.sql` |
| `mine_blocks` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `008_excavator_activity_redesign.sql` |
| `excavator_dumper_assignments` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `008_excavator_activity_redesign.sql` |
| `memory_embeddings` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `009_ai_memory.sql` |
| `shift_status` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `0145_shift_closeout.sql` |
| `tires` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `0146_tire_management.sql` |
| `tire_inspections` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `0146_tire_management.sql` |
| `user_feedback` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `015_user_feedback.sql` |
| `quick_feedback` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `015_user_feedback.sql` |
| `webhook_endpoints` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `017_webhooks.sql` |
| `webhook_delivery_logs` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `017_webhooks.sql` |
| `drill_operations` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `024_drill_operations.sql` |
| `machine_telemetry` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `025_machine_telemetry.sql` |
| `machine_telemetry_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `025_machine_telemetry.sql` |
| `drill_operations_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `027_drill_shifts_and_archiving.sql` |
| `personnel` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | 🟢 | 🟢 | `028_access_control_system.sql` |
| `visitors` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | 🟢 | 🟢 | `028_access_control_system.sql` |
| `badges` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | 🟢 | 🟢 | `028_access_control_system.sql` |
| `access_logs` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `028_access_control_system.sql` |
| `sync_watermarks` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `031_embedding_sync_watermarks.sql` |
| `ai_usage_logs` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `032_ai_usage_logs.sql` |
| `access_logs_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `033_access_logs_weekly_archival.sql` |
| `fleet` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | 🟢 | 🟢 | `035_fleet_and_equipment_tables.sql` |
| `equipment` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | 🟢 | 🟢 | `035_fleet_and_equipment_tables.sql` |
| `documents` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `036_documents.sql` |
| `document_versions` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `036_documents.sql` |
| `machine_configurations` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `042_machine_configurations.sql` |
| `machine_operations_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `046_control_room_archiving.sql` |
| `excavator_activity_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `046_control_room_archiving.sql` |
| `excavator_dumper_assignments_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `046_control_room_archiving.sql` |
| `operational_delays_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `046_control_room_archiving.sql` |
| `dozer_rolls_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `046_control_room_archiving.sql` |
| `engineering_notes_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `046_control_room_archiving.sql` |
| `embedding_cache` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `059_embedding_cache.sql` |
| `vector_search_cache` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `064_vector_search_query_optimization.sql` |
| `vector_search_performance` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `064_vector_search_query_optimization.sql` |
| `materialized_view_refresh_log` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `065_materialized_view_refresh_optimization.sql` |
| `cache_events` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `067_cache_events.sql` |
| `cache_anomalies` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `067_cache_events.sql` |
| `delay_entries` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `068_delay_entries_table.sql` |
| `delay_entries_archive` | ✅ ENABLED | 🟢 | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `068_delay_entries_table.sql` |
| `roles` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `070_control_room_operator_role_and_lookup.sql` |
| `material_density` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `073_production_summary_view.sql` |
| `card_printers` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `076_card_printing_infrastructure.sql` |
| `card_templates` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `076_card_printing_infrastructure.sql` |
| `print_jobs` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `076_card_printing_infrastructure.sql` |
| `issued_cards` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `076_card_printing_infrastructure.sql` |
| `satellite_deformations` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `078_satellite_insar_deformations.sql` |
| `secrets_rotation_log` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `085_secrets_rotation_log.sql` |
| `shift_completeness_alerts` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `086_shift_completeness_alerts.sql` |
| `data_integrity_issues` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `087_data_integrity_issues.sql` |
| `shift_integrity_reports` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `088_shift_integrity_reports.sql` |
| `slo_metrics` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `091_slo_monitoring.sql` |
| `feature_flags` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | 🟢 | `092_feature_flags.sql` |
| `feature_flag_exposures` | ✅ ENABLED | ⚪ (Deny) | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `092_feature_flags.sql` |
| `ab_test_results` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `092_feature_flags.sql` |
| `control_room_shift_reports` | ✅ ENABLED | 🟢 | 🟢 | 🟢 | ⚪ (Deny) | `096_control_room_shift_reports.sql` |
| `ai_token_usage` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | 🟢 | `100_ai_token_usage_tracking.sql` |
| `excavator_haul_logs` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `148_multi_site_production_report.sql` |
| `excavator_truck_tallies` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `148_multi_site_production_report.sql` |
| `dozer_rollover_logs` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `148_multi_site_production_report.sql` |
| `ancillary_shift_logs` | ✅ ENABLED | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | ⚪ (Deny) | `148_multi_site_production_report.sql` |
| `compliance_audit_runs` | ✅ ENABLED | 🟢 | 🟢 | ⚪ (Deny) | ⚪ (Deny) | `151_operational_compliance_checks.sql` |

*Legend: 🟢 = Explicit Policy Defined | ⚪ (Deny) = Default Secure Tenant Isolation (Implicit Deny)*
