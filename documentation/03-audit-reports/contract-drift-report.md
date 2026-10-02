# Schema & Contract Drift Audit Report

Generated on 2026-10-02T09:35:08.961Z

## Fitness Function Telemetry

- **Database Tables Scanned**: 94
- **Zod Contract Schemas**: 179
- **Drift Health Index (DHI)**: 95.7%
- **Contract Coverage Rating**: 🟢 Tier-1 Synchronized

## Synchronized Domain Contracts (90 Tables)

| Database Table                         | Migration Source                                 | Contract Schema                                            |
| :------------------------------------- | :----------------------------------------------- | :--------------------------------------------------------- |
| `departments`                          | `001_initial.sql`                                | `departmentsSchema`                                        |
| `employees`                            | `001_initial.sql`                                | `employeesSchema`                                          |
| `machines`                             | `001_initial.sql`                                | `machinesSchema`                                           |
| `daily_logs`                           | `001_initial.sql`                                | `dailyLogSchema`                                           |
| `machine_hours`                        | `001_initial.sql`                                | `machineHoursSchema`                                       |
| `fuel_logs`                            | `001_initial.sql`                                | `fuelLogsSchema`                                           |
| `production_logs`                      | `001_initial.sql`                                | `productionDailyLogSchema`                                 |
| `operators`                            | `002_control_room_tables.sql`                    | `operatorsSchema`                                          |
| `sites`                                | `002_control_room_tables.sql`                    | `sitesSchema`                                              |
| `machine_operations`                   | `002_control_room_tables.sql`                    | `machineOperationsSchema`                                  |
| `hourly_loads`                         | `002_control_room_tables.sql`                    | `hourlyLoadsSchema`                                        |
| `delay_categories`                     | `002_control_room_tables.sql`                    | `delayCategoriesSchema`                                    |
| `shift_notes`                          | `002_control_room_tables.sql`                    | `controlRoomShiftReportSchema, unifiedShiftReportSchema`   |
| `excavator_activity`                   | `002_control_room_tables.sql`                    | `excavatorHaulSchema`                                      |
| `dozer_rolls`                          | `002_control_room_tables.sql`                    | `dozerRollSchema`                                          |
| `report_templates`                     | `002_control_room_tables.sql`                    | `reportTemplatesSchema`                                    |
| `generated_reports`                    | `002_control_room_tables.sql`                    | `generatedReportsSchema`                                   |
| `engineering_notes`                    | `003_control_room_revisions.sql`                 | `engineeringNotesSchema`                                   |
| `operational_delays`                   | `003_control_room_revisions.sql`                 | `operationalDelaysSchema`                                  |
| `breakdowns`                           | `004_breakdowns.sql`                             | `createBreakdownSchema, breakdownReportEntrySchema`        |
| `safety_severities`                    | `006_safety_department.sql`                      | `safetySeveritiesSchema`                                   |
| `safety_incident_categories`           | `006_safety_department.sql`                      | `safetyIncidentCategoriesSchema`                           |
| `safety_incidents`                     | `006_safety_department.sql`                      | `safetyIncidentsSchema`                                    |
| `audit_logs`                           | `007_audit_logs.sql`                             | `auditLogsSchema`                                          |
| `mine_blocks`                          | `008_excavator_activity_redesign.sql`            | `mineBlocksSchema`                                         |
| `excavator_dumper_assignments`         | `008_excavator_activity_redesign.sql`            | `excavatorDumperAssignmentsSchema`                         |
| `memory_embeddings`                    | `009_ai_memory.sql`                              | `aiHandoffSchema, riskAssessmentSchema`                    |
| `shift_status`                         | `0145_shift_closeout.sql`                        | `lockAndSignShiftSchema`                                   |
| `tires`                                | `0146_tire_management.sql`                       | `tireSchema, createTireSchema, replaceTireSchema`          |
| `tire_inspections`                     | `0146_tire_management.sql`                       | `tireInspectionSchema, logTireInspectionSchema`            |
| `user_feedback`                        | `015_user_feedback.sql`                          | `userFeedbackSchema`                                       |
| `quick_feedback`                       | `015_user_feedback.sql`                          | `quickFeedbackSchema`                                      |
| `webhook_endpoints`                    | `017_webhooks.sql`                               | `createWebhookSchema, updateWebhookSchema`                 |
| `webhook_delivery_logs`                | `017_webhooks.sql`                               | `webhookDeliveryLogsSchema`                                |
| `drill_operations`                     | `024_drill_operations.sql`                       | `drillOperationSchema, drillTelemetryIngestSchema`         |
| `machine_telemetry`                    | `025_machine_telemetry.sql`                      | `machineTelemetrySchema`                                   |
| `machine_telemetry_archive`            | `025_machine_telemetry.sql`                      | `machineTelemetryArchiveSchema`                            |
| `drill_operations_archive`             | `027_drill_shifts_and_archiving.sql`             | `drillOperationsArchiveSchema`                             |
| `personnel`                            | `028_access_control_system.sql`                  | `personnelSchema`                                          |
| `visitors`                             | `028_access_control_system.sql`                  | `visitorsSchema`                                           |
| `badges`                               | `028_access_control_system.sql`                  | `scannerBadgeSchema`                                       |
| `access_logs`                          | `028_access_control_system.sql`                  | `accessLogsSchema`                                         |
| `sync_watermarks`                      | `031_embedding_sync_watermarks.sql`              | `syncWatermarksSchema`                                     |
| `ai_usage_logs`                        | `032_ai_usage_logs.sql`                          | `aiChatSchema, aiSafetySchema, aiPredictSchema`            |
| `access_logs_archive`                  | `033_access_logs_weekly_archival.sql`            | `accessLogsArchiveSchema`                                  |
| `fleet`                                | `035_fleet_and_equipment_tables.sql`             | `fleetSchema`                                              |
| `equipment`                            | `035_fleet_and_equipment_tables.sql`             | `equipmentSchema`                                          |
| `documents`                            | `036_documents.sql`                              | `documentsSchema`                                          |
| `document_versions`                    | `036_documents.sql`                              | `documentVersionsSchema`                                   |
| `machine_configurations`               | `042_machine_configurations.sql`                 | `machineConfigurationsSchema`                              |
| `machine_operations_archive`           | `046_control_room_archiving.sql`                 | `machineOperationsArchiveSchema`                           |
| `excavator_activity_archive`           | `046_control_room_archiving.sql`                 | `excavatorActivityArchiveSchema`                           |
| `excavator_dumper_assignments_archive` | `046_control_room_archiving.sql`                 | `excavatorDumperAssignmentsArchiveSchema`                  |
| `operational_delays_archive`           | `046_control_room_archiving.sql`                 | `operationalDelaysArchiveSchema`                           |
| `dozer_rolls_archive`                  | `046_control_room_archiving.sql`                 | `dozerRollsArchiveSchema`                                  |
| `engineering_notes_archive`            | `046_control_room_archiving.sql`                 | `engineeringNotesArchiveSchema`                            |
| `embedding_cache`                      | `059_embedding_cache.sql`                        | `embeddingCacheSchema`                                     |
| `vector_search_cache`                  | `064_vector_search_query_optimization.sql`       | `vectorSearchCacheSchema`                                  |
| `vector_search_performance`            | `064_vector_search_query_optimization.sql`       | `vectorSearchPerformanceSchema`                            |
| `materialized_view_refresh_log`        | `065_materialized_view_refresh_optimization.sql` | `materializedViewRefreshLogSchema`                         |
| `cache_events`                         | `067_cache_events.sql`                           | `cacheEventsSchema`                                        |
| `cache_anomalies`                      | `067_cache_events.sql`                           | `cacheAnomaliesSchema`                                     |
| `delay_entries`                        | `068_delay_entries_table.sql`                    | `delayEntriesSchema`                                       |
| `delay_entries_archive`                | `068_delay_entries_table.sql`                    | `delayEntriesArchiveSchema`                                |
| `roles`                                | `070_control_room_operator_role_and_lookup.sql`  | `rolesSchema`                                              |
| `material_density`                     | `073_production_summary_view.sql`                | `materialDensitySchema`                                    |
| `card_printers`                        | `076_card_printing_infrastructure.sql`           | `PrintRequestSchema`                                       |
| `card_templates`                       | `076_card_printing_infrastructure.sql`           | `PrintRequestSchema`                                       |
| `print_jobs`                           | `076_card_printing_infrastructure.sql`           | `PrintRequestSchema`                                       |
| `issued_cards`                         | `076_card_printing_infrastructure.sql`           | `PrintRequestSchema, EmployeeProfileUpdateSchema`          |
| `satellite_deformations`               | `078_satellite_insar_deformations.sql`           | `insarTelemetryIngestSchema, insarGeoTIFFUploadSchema`     |
| `secrets_rotation_log`                 | `086_secrets_rotation_log.sql`                   | `secretsRotationLogSchema`                                 |
| `shift_completeness_alerts`            | `087_shift_completeness_alerts.sql`              | `shiftCompletenessAlertsSchema`                            |
| `data_integrity_issues`                | `088_data_integrity_issues.sql`                  | `dataIntegrityIssuesSchema`                                |
| `shift_integrity_reports`              | `089_shift_integrity_reports.sql`                | `shiftIntegrityReportsSchema`                              |
| `slo_metrics`                          | `092_slo_monitoring.sql`                         | `sloMetricsSchema`                                         |
| `feature_flags`                        | `093_feature_flags.sql`                          | `featureFlagsSchema`                                       |
| `feature_flag_exposures`               | `093_feature_flags.sql`                          | `featureFlagExposuresSchema`                               |
| `ab_test_results`                      | `093_feature_flags.sql`                          | `abTestResultsSchema`                                      |
| `control_room_shift_reports`           | `097_control_room_shift_reports.sql`             | `controlRoomShiftReportsSchema`                            |
| `ai_token_usage`                       | `102_ai_token_usage_tracking.sql`                | `aiChatSchema, aiPredictSchema`                            |
| `excavator_haul_logs`                  | `150_multi_site_production_report.sql`           | `excavatorHaulSchema`                                      |
| `excavator_truck_tallies`              | `150_multi_site_production_report.sql`           | `truckTallySchema`                                         |
| `dozer_rollover_logs`                  | `150_multi_site_production_report.sql`           | `dozerRolloverEntrySchema`                                 |
| `ancillary_shift_logs`                 | `150_multi_site_production_report.sql`           | `ancillaryReportEntrySchema`                               |
| `compliance_audit_runs`                | `153_operational_compliance_checks.sql`          | `complianceAuditRunSchema, createComplianceAuditRunSchema` |
| `idempotency_keys`                     | `162_idempotency_and_outbox.sql`                 | `idempotencyKeysSchema`                                    |
| `control_room_outbox`                  | `162_idempotency_and_outbox.sql`                 | `controlRoomOutboxSchema`                                  |
| `mutation_log`                         | `165_offline_crdt_mutation_log_and_smr.sql`      | `mutationLogSchema`                                        |
| `smr_readings`                         | `165_offline_crdt_mutation_log_and_smr.sql`      | `smrReadingsSchema`                                        |

## System & Infrastructure Tables (4 Tables)

- `integration_catalog` (168_integration_platform.sql)
- `integration_installations` (168_integration_platform.sql)
- `integration_credentials` (168_integration_platform.sql)
- `integration_audit_logs` (168_integration_platform.sql)
