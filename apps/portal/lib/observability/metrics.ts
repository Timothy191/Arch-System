import type { Registry, Histogram, Counter, Gauge } from "prom-client";

// AGENT-TRACE: Performance metrics for Control Room operations
// Uses prom-client for Prometheus-compatible metrics
// Edge-safe wrapper: prom-client depends on Node.js APIs incompatible with Edge Runtime

let promClient: any = null;
let register: Registry | null = null;

if (typeof process !== "undefined" && process.versions && process.versions.node) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    promClient = require("prom-client");
    if (promClient) {
      register = new promClient.Registry();
      promClient.collectDefaultMetrics({ register });
    }
  } catch (e) {
    // Fallback for environments where require or prom-client is unavailable
    promClient = null;
  }
}

function createHistogram(config: any): Histogram | null {
  return promClient ? new promClient.Histogram(config) : null;
}

function createCounter(config: any): Counter | null {
  return promClient ? new promClient.Counter(config) : null;
}

function createGauge(config: any): Gauge | null {
  return promClient ? new promClient.Gauge(config) : null;
}

// AGENT-TRACE: Shift closeout metrics
const shiftCloseoutDuration = createHistogram({
  name: "control_room_shift_closeout_duration_seconds",
  help: "Duration of shift closeout operations in seconds",
  labelNames: ["department_id", "shift_type", "success"],
  buckets: [0.5, 1, 2, 5, 10, 30, 60], // Buckets for 0.5s, 1s, 2s, 5s, 10s, 30s, 60s
});

const shiftCloseoutTotal = createCounter({
  name: "control_room_shift_closeout_total",
  help: "Total number of shift closeout attempts",
  labelNames: ["department_id", "shift_type", "success"],
});

const shiftCloseoutValidationErrors = createCounter({
  name: "control_room_shift_closeout_validation_errors_total",
  help: "Total number of validation errors during shift closeout",
  labelNames: ["department_id", "error_type"],
});

// AGENT-TRACE: Machine status update metrics
const machineStatusUpdateDuration = createHistogram({
  name: "control_room_machine_status_update_duration_seconds",
  help: "Duration of machine status update operations in seconds",
  labelNames: ["machine_id", "operation_type"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const machineStatusUpdateTotal = createCounter({
  name: "control_room_machine_status_update_total",
  help: "Total number of machine status update operations",
  labelNames: ["machine_id", "operation_type", "success"],
});

// AGENT-TRACE: SCADA metrics
const scadaPanelLoadDuration = createHistogram({
  name: "control_room_scada_panel_load_duration_seconds",
  help: "Duration of SCADA panel load operations in seconds",
  labelNames: ["panel_type"], // machine_list or scada_dashboard
  buckets: [0.5, 1, 2, 5, 10, 15, 30],
});

const scadaFetchMachineDuration = createHistogram({
  name: "control_room_scada_fetch_machines_duration_seconds",
  help: "Duration of SCADA machine fetch operations in seconds",
  labelNames: ["department_id"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const scadaConnectionStatus = createGauge({
  name: "control_room_scada_connection_status",
  help: "SCADA connection status (1 = connected, 0 = disconnected)",
  labelNames: ["fuxa_url"],
});

// AGENT-TRACE: Alert panel metrics
const alertPanelLoadDuration = createHistogram({
  name: "control_room_alert_panel_load_duration_seconds",
  help: "Duration of alert panel load operations in seconds",
  labelNames: ["department_id"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const alertCount = createGauge({
  name: "control_room_active_alerts",
  help: "Number of active (unacknowledged) alerts",
  labelNames: ["department_id", "severity"],
});

// AGENT-TRACE: Hourly loads metrics
const hourlyLoadsUpdateDuration = createHistogram({
  name: "control_room_hourly_loads_update_duration_seconds",
  help: "Duration of hourly loads update operations in seconds",
  labelNames: ["department_id", "update_type"], // increment or direct_edit
  buckets: [0.1, 0.5, 1, 2, 5],
});

const hourlyLoadsUpdateTotal = createCounter({
  name: "control_room_hourly_loads_update_total",
  help: "Total number of hourly loads update operations",
  labelNames: ["department_id", "update_type"],
});

// AGENT-TRACE: API response time metrics
const apiResponseTime = createHistogram({
  name: "control_room_api_response_time_seconds",
  help: "API response time in seconds",
  labelNames: ["endpoint", "method", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

const apiTotalRequests = createCounter({
  name: "control_room_api_requests_total",
  help: "Total number of API requests",
  labelNames: ["endpoint", "method", "status_code"],
});

// AGENT-TRACE: Data integrity metrics
const dataIntegrityScore = createGauge({
  name: "control_room_data_integrity_score",
  help: "Data integrity score (0-100)",
  labelNames: ["department_id"],
});

const orphanedRecordsCount = createGauge({
  name: "control_room_orphaned_records_count",
  help: "Number of orphaned records detected",
  labelNames: ["table_name", "issue_type"],
});

const shiftCompletenessRate = createGauge({
  name: "control_room_shift_completeness_rate",
  help: "Shift completeness rate (percentage)",
  labelNames: ["department_id", "shift_type"],
});

// AGENT-TRACE: Register all metrics if available
if (register) {
  if (shiftCloseoutDuration) register.registerMetric(shiftCloseoutDuration);
  if (shiftCloseoutTotal) register.registerMetric(shiftCloseoutTotal);
  if (shiftCloseoutValidationErrors) register.registerMetric(shiftCloseoutValidationErrors);
  if (machineStatusUpdateDuration) register.registerMetric(machineStatusUpdateDuration);
  if (machineStatusUpdateTotal) register.registerMetric(machineStatusUpdateTotal);
  if (scadaPanelLoadDuration) register.registerMetric(scadaPanelLoadDuration);
  if (scadaFetchMachineDuration) register.registerMetric(scadaFetchMachineDuration);
  if (scadaConnectionStatus) register.registerMetric(scadaConnectionStatus);
  if (alertPanelLoadDuration) register.registerMetric(alertPanelLoadDuration);
  if (alertCount) register.registerMetric(alertCount);
  if (hourlyLoadsUpdateDuration) register.registerMetric(hourlyLoadsUpdateDuration);
  if (hourlyLoadsUpdateTotal) register.registerMetric(hourlyLoadsUpdateTotal);
  if (apiResponseTime) register.registerMetric(apiResponseTime);
  if (apiTotalRequests) register.registerMetric(apiTotalRequests);
  if (dataIntegrityScore) register.registerMetric(dataIntegrityScore);
  if (orphanedRecordsCount) register.registerMetric(orphanedRecordsCount);
  if (shiftCompletenessRate) register.registerMetric(shiftCompletenessRate);
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register ? await register.metrics() : "";
}

// In-memory telemetry data for background jobs and database query profiling
interface JobMetricEntry {
  count: number;
  errors: number;
  totalDurationMs: number;
}

interface DbMetricEntry {
  count: number;
  errors: number;
  totalDurationMs: number;
}

const jobMetrics = new Map<string, JobMetricEntry>();
const dbMetrics = new Map<string, DbMetricEntry>();

export function clearObservabilityMetrics(): void {
  jobMetrics.clear();
  dbMetrics.clear();
}

export function recordJobExecution(jobId: string, durationMs: number, success: boolean): void {
  const entry = jobMetrics.get(jobId) || {
    count: 0,
    errors: 0,
    totalDurationMs: 0,
  };
  entry.count++;
  if (!success) {
    entry.errors++;
  }
  entry.totalDurationMs += durationMs;
  jobMetrics.set(jobId, entry);
}

export function recordDbQuery(
  tableName: string,
  operation: string,
  durationMs: number,
  success: boolean,
): void {
  const key = `${tableName}:${operation}`;
  const entry = dbMetrics.get(key) || {
    count: 0,
    errors: 0,
    totalDurationMs: 0,
  };
  entry.count++;
  if (!success) {
    entry.errors++;
  }
  entry.totalDurationMs += durationMs;
  dbMetrics.set(key, entry);
}

export async function getObservabilityMetrics() {
  return {
    jobMetrics,
    dbMetrics,
  };
}
