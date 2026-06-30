interface TelemetryMetric {
  name: string;
  duration: number;
  attributes?: Record<string, string | number | boolean>;
  timestamp: number;
}

const metrics: TelemetryMetric[] = [];

/** Track client-side operation duration via the Performance API. */
export function trackClientMetric(
  name: string,
  fn: () => void | Promise<void>,
  attributes?: Record<string, string | number | boolean>,
): void | Promise<void> {
  const startTime = performance.now();
  const result = fn();

  const record = () => {
    const duration = performance.now() - startTime;
    metrics.push({ name, duration, attributes, timestamp: Date.now() });
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(`[Client Telemetry] ${name}`, { duration, attributes });
    }
  };

  if (result instanceof Promise) {
    return result.finally(record);
  }
  record();
}
