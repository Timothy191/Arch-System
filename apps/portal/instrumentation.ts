import { moduleRegistry } from '@/lib/modules/registry';
import { metadataRegistry } from '@/lib/observability/metadata';
import { performanceMonitor } from '@/lib/performance/monitor';
import { performanceRegressionDetector } from '@/lib/performance/regression';

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/** High-resolution start marker captured when the instrumentation module loads. */
const processStartTimeMs = nowMs();

function resolveSentryDsn(): string | undefined {
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

async function initializeSentry(): Promise<void> {
  if (!resolveSentryDsn()) {
    return;
  }
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

async function loadBaselinesFromConfig(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  try {
    const baselinesConfig = (await import('@/lib/performance/performance-baselines.json'))
      .default as {
      readonly baselines?: ReadonlyArray<{
        readonly metricId: string;
        readonly baselineValue: number;
        readonly context?: Readonly<Record<string, unknown>>;
      }>;
    };
    for (const baseline of baselinesConfig.baselines ?? []) {
      performanceRegressionDetector.recordBaseline(baseline.metricId, baseline.baselineValue, {
        context: baseline.context,
      });
    }
  } catch {
    // Baselines config is optional; regression detection falls back to
    // runtime-recorded baselines.
  }
}

export async function register(): Promise<void> {
  // Resolve Docker Swarm / Kubernetes *_FILE secrets into process.env before initialization
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const fs = await import('node:fs');
      const { loadSecretFiles } = await import('@repo/shared/utils');
      if (typeof loadSecretFiles === 'function') {
        loadSecretFiles({
          env: process.env,
          readFile: (filePath: string) => fs.readFileSync(filePath, 'utf8'),
        });
      }
    } catch (error) {
      console.error('[Instrumentation] Error loading secret files:', error);
      throw error;
    }
  }

  // Attach Sentry before anything else so startup failures are reported.
  await initializeSentry();

  // Record server startup time as the first performance measurement.
  performanceMonitor.recordStartupTime(nowMs() - processStartTimeMs, {
    layer: 'application',
    kind: 'startup',
    runtime: process.env.NEXT_RUNTIME ?? 'unknown',
  });

  // Load committed performance baselines so regressions are detectable.
  await loadBaselinesFromConfig();

  // Register the performance module as a core module and record its metadata.
  moduleRegistry.registerModule({
    id: 'performance-monitor',
    kind: 'core',
    version: '1.0.0',
    dependencies: [],
    metadata: {
      purpose:
        'Startup time, module execution time, API response time, resource consumption, error frequency, cache effectiveness',
    },
  });
  metadataRegistry.registerMetadata({
    entityType: 'module',
    id: 'performance-monitor',
    metadata: {
      layer: 'intelligent-execution',
      capabilities: [
        'startup-time',
        'module-execution',
        'api-response-time',
        'resource-consumption',
        'error-frequency',
        'cache-effectiveness',
      ],
    },
  });

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

export const onRequestError = async (
  err: unknown,
  request: {
    method?: string;
    path?: string;
    url?: string;
    headers?: Record<string, string | string[] | undefined>;
  },
  context: { routerKind?: string; routePath?: string; [key: string]: unknown }
) => {
  performanceMonitor.recordError({
    error: err instanceof Error ? err : new Error(String(err)),
    context: { source: 'server', category: 'request' },
  });

  if (resolveSentryDsn()) {
    const SentryModule = await import('@sentry/nextjs');
    SentryModule.captureRequestError(
      err,
      {
        path: request?.path ?? request?.url ?? 'unknown',
        method: request?.method ?? 'GET',
        headers: request?.headers ?? {},
      },
      {
        routerKind: String(context?.routerKind ?? 'unknown'),
        routePath: String(context?.routePath ?? 'unknown'),
        routeType: String(context?.routeType ?? 'unknown'),
      }
    );
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { serverLogger } = await import('@repo/logger');
    const { getActiveTraceId, normalizeTraceId, parseTraceparentTraceId } = await import(
      '@/lib/observability/tracing'
    );
    const readReqHeader = (name: string): string | undefined => {
      const val = request?.headers?.[name] ?? request?.headers?.[name.toLowerCase()];
      return Array.isArray(val) ? val[0] : val;
    };
    const resolvedTraceId =
      normalizeTraceId(context?.traceId) ??
      getActiveTraceId() ??
      parseTraceparentTraceId(readReqHeader('traceparent')) ??
      normalizeTraceId(readReqHeader('x-trace-id'));
    const resolvedRequestId =
      (typeof context?.requestId === 'string' ? context.requestId : undefined) ??
      readReqHeader('x-request-id') ??
      readReqHeader('x-vercel-id');

    serverLogger.error(
      {
        err,
        request: { method: request.method },
        context,
        traceId: resolvedTraceId,
        requestId: resolvedRequestId,
      },
      'Global request error'
    );

    // Persist to public.system_logs for the Administration "System Logs" console.
    const { recordSystemLog } = await import('@/lib/logging/system-logs');
    await recordSystemLog({
      source: 'server',
      category: 'request',
      level: 'error',
      message: 'Global edge request error',
      stack: err instanceof Error ? err.stack : undefined,
      url: request?.path ?? request?.url,
      method: request?.method,
      context: { routerKind: context?.routerKind, routePath: context?.routePath },
      traceId: resolvedTraceId,
      requestId: resolvedRequestId,
    });
  } else {
    console.error('Global edge request error:', err);
  }
};
