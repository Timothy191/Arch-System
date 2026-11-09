/**
 * Free Alternative to Vercel Fluid Compute Monitoring
 */

export interface FluidComputeMetrics {
  activeConcurrency: number;
  totalActiveMs: number;
  totalDurationMs: number;
  invocationCount: number;
  coldStartCount: number;
  lastReset: number;
  errors: number;
}

interface FluidSpanTracer {
  startSpan: (name: string, options?: Record<string, unknown>) => unknown;
}

const fluidMetrics: FluidComputeMetrics = {
  activeConcurrency: 0,
  totalActiveMs: 0,
  totalDurationMs: 0,
  invocationCount: 0,
  coldStartCount: 0,
  lastReset: Date.now(),
  errors: 0,
};

const functionMetrics = new Map<string, FluidComputeMetrics>();
const activeSpans = new Map<string, { start: number; span: unknown }>();

const COLD_START_THRESHOLD_MS = 2000;
const RECENT_INVOCATIONS_COUNT = 5;
const recentDurations: number[] = [];

const traceModule = globalThis as {
  trace?: { getTracer: (name: string) => FluidSpanTracer };
};
const tracer = traceModule.trace?.getTracer('arch-portal');

export function startFluidComputeSpan(functionName: string): {
  span: unknown;
  startTime: number;
} {
  const startTime = Date.now();
  const span = tracer?.startSpan(`fluid_compute.${functionName}`, {
    attributes: {
      'function.name': functionName,
      'fluent.compute.start_time': startTime,
    },
  });

  fluidMetrics.activeConcurrency++;
  functionMetrics.set(functionName, { ...fluidMetrics });
  activeSpans.set(functionName, { start: startTime, span });

  fluidMetrics.invocationCount++;
  functionMetrics.set(functionName, { ...fluidMetrics });

  recentDurations.push(startTime);
  if (recentDurations.length > RECENT_INVOCATIONS_COUNT) {
    recentDurations.shift();
  }

  return { span, startTime };
}

export interface EndFluidComputeSpanOptions {
  readonly functionName: string;
  readonly durationMs: number;
  readonly isSuccess: boolean;
}

export function endFluidComputeSpan(options: EndFluidComputeSpanOptions): void {
  const { functionName, durationMs, isSuccess } = options;
  const activeTimeMs = durationMs;

  fluidMetrics.totalActiveMs += activeTimeMs;
  fluidMetrics.totalDurationMs += durationMs;
  fluidMetrics.invocationCount++;
  if (!isSuccess) {
    fluidMetrics.errors++;
  }
  functionMetrics.set(functionName, { ...fluidMetrics });

  const funcMetrics = functionMetrics.get(functionName) ?? {
    activeConcurrency: 0,
    totalActiveMs: 0,
    totalDurationMs: 0,
    invocationCount: 0,
    coldStartCount: 0,
    lastReset: Date.now(),
    errors: 0,
  };

  const sortedDurations = [...recentDurations].sort((a, b) => a - b);
  const medianDuration =
    sortedDurations.length > 0 ? (sortedDurations[Math.floor(sortedDurations.length / 2)] ?? 0) : 0;

  if (
    durationMs > COLD_START_THRESHOLD_MS &&
    medianDuration > 0 &&
    durationMs > medianDuration * 2
  ) {
    funcMetrics.coldStartCount++;
  }
  functionMetrics.set(functionName, funcMetrics);

  fluidMetrics.activeConcurrency = Math.max(0, fluidMetrics.activeConcurrency - 1);
  functionMetrics.set(functionName, { ...fluidMetrics });
}

export function resetFluidComputeMetrics(): void {
  fluidMetrics.activeConcurrency = 0;
  fluidMetrics.totalActiveMs = 0;
  fluidMetrics.totalDurationMs = 0;
  fluidMetrics.invocationCount = 0;
  fluidMetrics.coldStartCount = 0;
  fluidMetrics.lastReset = Date.now();
  fluidMetrics.errors = 0;
  functionMetrics.clear();
  recentDurations.length = 0;
  activeSpans.clear();
}

export function trackWaitUntilDuration(durationMs: number, functionName: string): void {
  const funcMetrics = functionMetrics.get(functionName);
  if (funcMetrics) {
    funcMetrics.totalActiveMs = Math.max(0, funcMetrics.totalActiveMs - durationMs);
    functionMetrics.set(functionName, funcMetrics);
  }
}
