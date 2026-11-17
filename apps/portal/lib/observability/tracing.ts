/**
 * OpenTelemetry tracing utilities for manual instrumentation
 *
 * This file provides helper functions to create spans and add events
 * for custom business operations that need explicit tracing.
 */

import { type Span, SpanStatusCode, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('arch-portal', '1.0.0');

const INVALID_OTEL_TRACE_ID = '00000000000000000000000000000000';
const W3C_TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRACEPARENT_PARTS_MIN = 2;

/**
 * Extracts a valid 32-char W3C trace ID from a `traceparent` header (`00-<traceId>-<spanId>-<flags>`).
 */
export function parseTraceparentTraceId(
  headerValue: string | null | undefined
): string | undefined {
  if (!headerValue) return undefined;
  const parts = headerValue.trim().split('-');
  if (parts.length < TRACEPARENT_PARTS_MIN) return undefined;
  const candidate = parts[1]?.toLowerCase();
  if (!candidate || candidate === INVALID_OTEL_TRACE_ID || !W3C_TRACE_ID_PATTERN.test(candidate)) {
    return undefined;
  }
  return candidate;
}

/**
 * Normalizes a candidate trace ID (W3C 32-hex or UUID), returning undefined if invalid.
 */
export function normalizeTraceId(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string') return undefined;
  const trimmed = candidate.trim().toLowerCase();
  if (trimmed === '' || trimmed === INVALID_OTEL_TRACE_ID) return undefined;
  if (W3C_TRACE_ID_PATTERN.test(trimmed) || UUID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

/**
 * Returns the active OpenTelemetry span's W3C 32-hex trace ID when recording/valid.
 */
export function getActiveTraceId(): string | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext?.traceId || spanContext.traceId === INVALID_OTEL_TRACE_ID) {
    return undefined;
  }
  return normalizeTraceId(spanContext.traceId);
}

/**
 * Resolves traceId and requestId from request headers and active OpenTelemetry context.
 */
export function extractRequestTraceMetadata(headers?: { get(name: string): string | null }): {
  traceId?: string;
  requestId?: string;
} {
  const activeTraceId = getActiveTraceId();
  const headerTraceId =
    parseTraceparentTraceId(headers?.get('traceparent')) ??
    normalizeTraceId(headers?.get('x-trace-id'));
  const rawRequestId =
    headers?.get('x-request-id')?.trim() || headers?.get('x-vercel-id')?.trim() || undefined;

  return {
    traceId: activeTraceId ?? headerTraceId,
    requestId: rawRequestId && rawRequestId.length <= 128 ? rawRequestId : undefined,
  };
}

/**
 * Create a span for an asynchronous operation
 */
export async function withAsyncSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (_span: Span) => Promise<T>
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
  attributes?: Record<string, string | number | boolean>
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
