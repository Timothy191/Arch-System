export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-base');
    const { registerOTel } = await import('@vercel/otel');

    const exporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

    registerOTel({
      serviceName: 'portal-ui',
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
  }
}

import type { Instrumentation } from 'next';

export const onRequestError = async (err: any, request: any, context: any) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { serverLogger } = await import('@repo/logger');
    serverLogger.error(
      { err, request: { method: request.method }, context },
      'Global request error'
    );

    // Persist to public.system_logs for the Administration "System Logs" console.
    const { recordCaughtError } = await import('@/lib/logging/system-logs');
    await recordCaughtError(err, {
      source: 'server',
      category: 'request',
      method: request?.method,
      url: request?.path ?? request?.url,
      context: { routerKind: context?.routerKind, routePath: context?.routePath },
    });
  } else {
    console.error('Global edge request error:', err);
  }
};
