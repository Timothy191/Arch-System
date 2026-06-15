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

      // In production, this could send to monitoring endpoint
      // sendToMonitoring(metric);
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

/**
 * Get all collected client metrics
 */
export function getClientMetrics(): TelemetryMetric[] {
  return [...metrics];
}

/**
 * Clear all collected client metrics
 */
export function clearClientMetrics(): void {
  metrics.length = 0;
}

/**
 * React hook to track component render time
 */
export function useRenderTime(componentName: string) {
  useEffect(() => {
    const renderStart = performance.now();

    return () => {
      const renderDuration = performance.now() - renderStart;
      const metric: TelemetryMetric = {
        name: `${componentName}_render`,
        duration: renderDuration,
        timestamp: Date.now(),
      };
      metrics.push(metric);

      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(`[Render Time] ${componentName}`, {
          duration: renderDuration,
        });
      }
    };
  }, [componentName]);
}

import { useEffect } from "react";

/**
 * React hook to track async operation time
 */
export function useAsyncOperation<T>(
  operation: () => Promise<T>,
  name: string,
  attributes?: Record<string, string | number | boolean>,
): () => Promise<T> {
  return async () => {
    const startTime = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      const metric: TelemetryMetric = {
        name,
        duration,
        attributes: {
          ...attributes,
          success: true,
        },
        timestamp: Date.now(),
      };
      metrics.push(metric);

      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(`[Async Operation] ${name}`, {
          duration,
          attributes,
          success: true,
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const metric: TelemetryMetric = {
        name,
        duration,
        attributes: {
          ...attributes,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: Date.now(),
      };
      metrics.push(metric);

      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(`[Async Operation] ${name}`, {
          duration,
          attributes,
          success: false,
          error,
        });
      }

      throw error;
    }
  };
}
