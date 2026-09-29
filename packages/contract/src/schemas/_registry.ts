import { z } from 'zod';

export const abTestResultsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const accessLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const accessLogsArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const aiTokenUsageSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const aiUsageLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const ancillaryShiftLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const auditLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const badgesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const breakdownsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const cacheAnomaliesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const cacheEventsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const cardPrintersSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const cardTemplatesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const complianceAuditRunsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const controlRoomOutboxSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const controlRoomShiftReportsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const dailyLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const dataIntegrityIssuesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const delayCategoriesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const delayEntriesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const delayEntriesArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const departmentsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const documentVersionsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const documentsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const dozerRolloverLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const dozerRollsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const dozerRollsArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const drillOperationsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const drillOperationsArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const embeddingCacheSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const employeesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const engineeringNotesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const engineeringNotesArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const equipmentSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const excavatorActivitySchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const excavatorActivityArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const excavatorDumperAssignmentsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const excavatorDumperAssignmentsArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const excavatorHaulLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const excavatorTruckTalliesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const featureFlagExposuresSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const featureFlagsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const fleetSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const fuelLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const generatedReportsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const hourlyLoadsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const idempotencyKeysSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const issuedCardsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const machineConfigurationsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const machineHoursSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const machineOperationsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const machineOperationsArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const machineTelemetrySchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const machineTelemetryArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const machinesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const materialDensitySchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const materializedViewRefreshLogSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const memoryEmbeddingsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const mineBlocksSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const operationalDelaysSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const operationalDelaysArchiveSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const operatorsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const personnelSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const printJobsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const productionLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const quickFeedbackSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const reportTemplatesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const rolesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const safetyIncidentCategoriesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const safetyIncidentsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const safetySeveritiesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const satelliteDeformationsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const secretsRotationLogSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const shiftCompletenessAlertsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const shiftIntegrityReportsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const shiftNotesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const shiftStatusSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const sitesSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const sloMetricsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const syncWatermarksSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const tireInspectionsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const tiresSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const userFeedbackSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const vectorSearchCacheSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const vectorSearchPerformanceSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const visitorsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const webhookDeliveryLogsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const webhookEndpointsSchema = z
  .object({
    id: z.string().optional(),
    tenant_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const tableSchemas = {
  ab_test_results: abTestResultsSchema,
  access_logs: accessLogsSchema,
  access_logs_archive: accessLogsArchiveSchema,
  ai_token_usage: aiTokenUsageSchema,
  ai_usage_logs: aiUsageLogsSchema,
  ancillary_shift_logs: ancillaryShiftLogsSchema,
  audit_logs: auditLogsSchema,
  badges: badgesSchema,
  breakdowns: breakdownsSchema,
  cache_anomalies: cacheAnomaliesSchema,
  cache_events: cacheEventsSchema,
  card_printers: cardPrintersSchema,
  card_templates: cardTemplatesSchema,
  compliance_audit_runs: complianceAuditRunsSchema,
  control_room_outbox: controlRoomOutboxSchema,
  control_room_shift_reports: controlRoomShiftReportsSchema,
  daily_logs: dailyLogsSchema,
  data_integrity_issues: dataIntegrityIssuesSchema,
  delay_categories: delayCategoriesSchema,
  delay_entries: delayEntriesSchema,
  delay_entries_archive: delayEntriesArchiveSchema,
  departments: departmentsSchema,
  document_versions: documentVersionsSchema,
  documents: documentsSchema,
  dozer_rollover_logs: dozerRolloverLogsSchema,
  dozer_rolls: dozerRollsSchema,
  dozer_rolls_archive: dozerRollsArchiveSchema,
  drill_operations: drillOperationsSchema,
  drill_operations_archive: drillOperationsArchiveSchema,
  embedding_cache: embeddingCacheSchema,
  employees: employeesSchema,
  engineering_notes: engineeringNotesSchema,
  engineering_notes_archive: engineeringNotesArchiveSchema,
  equipment: equipmentSchema,
  excavator_activity: excavatorActivitySchema,
  excavator_activity_archive: excavatorActivityArchiveSchema,
  excavator_dumper_assignments: excavatorDumperAssignmentsSchema,
  excavator_dumper_assignments_archive: excavatorDumperAssignmentsArchiveSchema,
  excavator_haul_logs: excavatorHaulLogsSchema,
  excavator_truck_tallies: excavatorTruckTalliesSchema,
  feature_flag_exposures: featureFlagExposuresSchema,
  feature_flags: featureFlagsSchema,
  fleet: fleetSchema,
  fuel_logs: fuelLogsSchema,
  generated_reports: generatedReportsSchema,
  hourly_loads: hourlyLoadsSchema,
  idempotency_keys: idempotencyKeysSchema,
  issued_cards: issuedCardsSchema,
  machine_configurations: machineConfigurationsSchema,
  machine_hours: machineHoursSchema,
  machine_operations: machineOperationsSchema,
  machine_operations_archive: machineOperationsArchiveSchema,
  machine_telemetry: machineTelemetrySchema,
  machine_telemetry_archive: machineTelemetryArchiveSchema,
  machines: machinesSchema,
  material_density: materialDensitySchema,
  materialized_view_refresh_log: materializedViewRefreshLogSchema,
  memory_embeddings: memoryEmbeddingsSchema,
  mine_blocks: mineBlocksSchema,
  operational_delays: operationalDelaysSchema,
  operational_delays_archive: operationalDelaysArchiveSchema,
  operators: operatorsSchema,
  personnel: personnelSchema,
  print_jobs: printJobsSchema,
  production_logs: productionLogsSchema,
  quick_feedback: quickFeedbackSchema,
  report_templates: reportTemplatesSchema,
  roles: rolesSchema,
  safety_incident_categories: safetyIncidentCategoriesSchema,
  safety_incidents: safetyIncidentsSchema,
  safety_severities: safetySeveritiesSchema,
  satellite_deformations: satelliteDeformationsSchema,
  secrets_rotation_log: secretsRotationLogSchema,
  shift_completeness_alerts: shiftCompletenessAlertsSchema,
  shift_integrity_reports: shiftIntegrityReportsSchema,
  shift_notes: shiftNotesSchema,
  shift_status: shiftStatusSchema,
  sites: sitesSchema,
  slo_metrics: sloMetricsSchema,
  sync_watermarks: syncWatermarksSchema,
  tire_inspections: tireInspectionsSchema,
  tires: tiresSchema,
  user_feedback: userFeedbackSchema,
  vector_search_cache: vectorSearchCacheSchema,
  vector_search_performance: vectorSearchPerformanceSchema,
  visitors: visitorsSchema,
  webhook_delivery_logs: webhookDeliveryLogsSchema,
  webhook_endpoints: webhookEndpointsSchema,
} as const;

export function validateMutation<T>(schema: z.ZodType<T>, payload: unknown): T {
  return schema.parse(payload);
}
