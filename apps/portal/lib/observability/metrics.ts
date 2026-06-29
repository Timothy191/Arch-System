import promClient from "prom-client";

export {
  clearObservabilityMetrics,
  getObservabilityMetrics,
  recordDbQuery,
  recordJobExecution,
} from "./job-metrics";

// AGENT-TRACE: Performance metrics for Control Room operations
// Uses prom-client for Prometheus-compatible metrics

// Create a Registry with default metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// AGENT-TRACE: Shift closeout metrics
const shiftCloseoutDuration = new promClient.Histogram({
  name: "control_room_shift_closeout_duration_seconds",
  help: "Duration of shift closeout operations in seconds",
  labelNames: ["department_id", "shift_type", "success"],
  buckets: [0.5, 1, 2, 5, 10, 30, 60], // Buckets for 0.5s, 1s, 2s, 5s, 10s, 30s, 60s
});

const shiftCloseoutTotal = new promClient.Counter({
  name: "control_room_shift_closeout_total",
  help: "Total number of shift closeout attempts",
  labelNames: ["department_id", "shift_type", "success"],
});

const shiftCloseoutValidationErrors = new promClient.Counter({
  name: "control_room_shift_closeout_validation_errors_total",
  help: "Total number of validation errors during shift closeout",
  labelNames: ["department_id", "error_type"],
});

// AGENT-TRACE: Machine status update metrics
const machineStatusUpdateDuration = new promClient.Histogram({
  name: "control_room_machine_status_update_duration_seconds",
  help: "Duration of machine status update operations in seconds",
  labelNames: ["machine_id", "operation_type"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const machineStatusUpdateTotal = new promClient.Counter({
  name: "control_room_machine_status_update_total",
  help: "Total number of machine status update operations",
  labelNames: ["machine_id", "operation_type", "success"],
});

// AGENT-TRACE: SCADA metrics
const scadaPanelLoadDuration = new promClient.Histogram({
  name: "control_room_scada_panel_load_duration_seconds",
  help: "Duration of SCADA panel load operations in seconds",
  labelNames: ["panel_type"], // machine_list or scada_dashboard
  buckets: [0.5, 1, 2, 5, 10, 15, 30],
});

const scadaFetchMachineDuration = new promClient.Histogram({
  name: "control_room_scada_fetch_machines_duration_seconds",
  help: "Duration of SCADA machine fetch operations in seconds",
  labelNames: ["department_id"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const scadaConnectionStatus = new promClient.Gauge({
  name: "control_room_scada_connection_status",
  help: "SCADA connection status (1 = connected, 0 = disconnected)",
  labelNames: ["fuxa_url"],
});

// AGENT-TRACE: Alert panel metrics
const alertPanelLoadDuration = new promClient.Histogram({
  name: "control_room_alert_panel_load_duration_seconds",
  help: "Duration of alert panel load operations in seconds",
  labelNames: ["department_id"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const alertCount = new promClient.Gauge({
  name: "control_room_active_alerts",
  help: "Number of active (unacknowledged) alerts",
  labelNames: ["department_id", "severity"],
});

// AGENT-TRACE: Hourly loads metrics
const hourlyLoadsUpdateDuration = new promClient.Histogram({
  name: "control_room_hourly_loads_update_duration_seconds",
  help: "Duration of hourly loads update operations in seconds",
  labelNames: ["department_id", "update_type"], // increment or direct_edit
  buckets: [0.1, 0.5, 1, 2, 5],
});

const hourlyLoadsUpdateTotal = new promClient.Counter({
  name: "control_room_hourly_loads_update_total",
  help: "Total number of hourly loads update operations",
  labelNames: ["department_id", "update_type"],
});

// AGENT-TRACE: API response time metrics
const apiResponseTime = new promClient.Histogram({
  name: "control_room_api_response_time_seconds",
  help: "API response time in seconds",
  labelNames: ["endpoint", "method", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

const apiTotalRequests = new promClient.Counter({
  name: "control_room_api_requests_total",
  help: "Total number of API requests",
  labelNames: ["endpoint", "method", "status_code"],
});

// AGENT-TRACE: Data integrity metrics
const dataIntegrityScore = new promClient.Gauge({
  name: "control_room_data_integrity_score",
  help: "Data integrity score (0-100)",
  labelNames: ["department_id"],
});

const orphanedRecordsCount = new promClient.Gauge({
  name: "control_room_orphaned_records_count",
  help: "Number of orphaned records detected",
  labelNames: ["table_name", "issue_type"],
});

const shiftCompletenessRate = new promClient.Gauge({
  name: "control_room_shift_completeness_rate",
  help: "Shift completeness rate (percentage)",
  labelNames: ["department_id", "shift_type"],
});

// AGENT-TRACE: Register all metrics
register.registerMetric(shiftCloseoutDuration);
register.registerMetric(shiftCloseoutTotal);
register.registerMetric(shiftCloseoutValidationErrors);
register.registerMetric(machineStatusUpdateDuration);
register.registerMetric(machineStatusUpdateTotal);
register.registerMetric(scadaPanelLoadDuration);
register.registerMetric(scadaFetchMachineDuration);
register.registerMetric(scadaConnectionStatus);
register.registerMetric(alertPanelLoadDuration);
register.registerMetric(alertCount);
register.registerMetric(hourlyLoadsUpdateDuration);
register.registerMetric(hourlyLoadsUpdateTotal);
register.registerMetric(apiResponseTime);
register.registerMetric(apiTotalRequests);
register.registerMetric(dataIntegrityScore);
register.registerMetric(orphanedRecordsCount);
register.registerMetric(shiftCompletenessRate);

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

