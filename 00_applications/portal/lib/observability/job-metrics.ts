// Edge-safe in-memory telemetry (no prom-client / Node APIs).

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
