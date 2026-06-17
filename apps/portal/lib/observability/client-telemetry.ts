/**
 * Client-side telemetry utilities for React components
 *
 * This file provides helper functions to track performance metrics
 * for client-side operations using the Performance API.
 */

interface TelemetryMetric {
  name: string;
  duration: number;
  attributes?: Record<string, string | number | boolean>;
  timestamp: number;
}

const metrics: TelemetryMetric[] = [];

/**
 * Track a client-side operation duration
 */
export function trackClientMetric(
  name: string,
  fn: () => void | Promise<void>,
  attributes?: Record<string, string | number | boolean>,
): void | Promise<void> {
  const startTime = performance.now();

  const result = fn();

  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - startTime;
      const metric: TelemetryMetric = {
        name,
        duration,
        attributes,
        timestamp: Date.now(),
      };
      metrics.push(metric);

      // Log to console for development
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(`[Client Telemetry] ${name}`, { duration, attributes });
      }
    });
  } else {
    const duration = performance.now() - startTime;
    const metric: TelemetryMetric = {
      name,
      duration,
      attributes,
      timestamp: Date.now(),
    };
    metrics.push(metric);

    // Log to console for development
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(`[Client Telemetry] ${name}`, { duration, attributes });
    }
  }
}
