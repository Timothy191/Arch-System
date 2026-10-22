export interface TelemetryMetric {
  name: string;
  duration: number;
  value?: number;
  attributes?: Record<string, string | number | boolean>;
  timestamp: number;
}

export const MAX_METRICS_BUFFER = 200;

export const metrics: TelemetryMetric[] = [];

/**
 * Push a telemetry metric into the bounded buffer, deduplicating identical
 * (name, timestamp, value/duration) entries and evicting the oldest entries
 * when exceeding MAX_METRICS_BUFFER.
 */
export function recordClientMetric(metric: TelemetryMetric): boolean {
  const effectiveValue = metric.value ?? metric.duration;

  // Deduplicate identical (name, timestamp, value/duration) entries
  const isDuplicate = metrics.some((existing) => {
    const existingValue = existing.value ?? existing.duration;
    return (
      existing.name === metric.name &&
      existing.timestamp === metric.timestamp &&
      existingValue === effectiveValue
    );
  });

  if (isDuplicate) {
    return false;
  }

  while (metrics.length >= MAX_METRICS_BUFFER) {
    metrics.shift();
  }

  metrics.push(metric);
  return true;
}

/**
 * Return a shallow copy of current buffered telemetry metrics.
 */
export function getClientMetrics(): TelemetryMetric[] {
  return [...metrics];
}

/**
 * Clear buffered telemetry metrics.
 */
export function clearClientMetrics(): void {
  metrics.length = 0;
}

/** Track client-side operation duration via the Performance API. */
export function trackClientMetric(
  name: string,
  fn: () => void | Promise<void>,
  attributes?: Record<string, string | number | boolean>
): void | Promise<void> {
  const startTime = performance.now();
  const result = fn();

  const record = () => {
    const duration = performance.now() - startTime;
    const timestamp = Date.now();
    recordClientMetric({
      name,
      duration,
      value: duration,
      attributes,
      timestamp,
    });
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`[Client Telemetry] ${name}`, { duration, attributes });
    }
  };

  if (result instanceof Promise) {
    return result.finally(record);
  }
  record();
}
