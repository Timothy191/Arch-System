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

const BASELINES_CONFIG_PATH = `${process.cwd()}/lib/performance/performance-baselines.json`;

async function loadBaselinesFromConfig(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  try {
    const { readFileSync } = await import('node:fs');
    const baselinesConfig = JSON.parse(readFileSync(BASELINES_CONFIG_PATH, 'utf8')) as {
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
  request: { method?: string; path?: string; url?: string },
  context: { routerKind?: string; routePath?: string; [key: string]: unknown }
) => {
  performanceMonitor.recordError({
    error: err instanceof Error ? err : new Error(String(err)),
    context: { source: 'server', category: 'request' },
  });

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
