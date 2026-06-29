/**
 * OpenTelemetry tracing utilities for manual instrumentation
 *
 * This file provides helper functions to create spans and add events
 * for custom business operations that need explicit tracing.
 */

import { trace, Span, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("arch-portal", "1.0.0");

/**
 * Create a span for an asynchronous operation
 */
export async function withAsyncSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (_span: Span) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name, {
    attributes,
  });

  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add an event to the current active span
 */
export function addEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current active span
 */
export function setAttributes(attributes: Record<string, string | number | boolean>): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setAttributes(attributes);
  }
}
