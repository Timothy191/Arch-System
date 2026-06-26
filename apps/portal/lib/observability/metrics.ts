// AGENT-TRACE: In-memory telemetry data for background jobs and database query profiling.
// Prometheus metrics (using prom-client) have been moved to prom-metrics.ts to prevent
// Edge Runtime compilation errors when imported by middleware.ts.

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
