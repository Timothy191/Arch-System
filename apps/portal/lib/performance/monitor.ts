/**
 * Central performance intelligence layer for Arch-System.
 *
 * Measures startup time, module execution time, API response time,
 * resource consumption, memory utilization, error frequency and cache
 * effectiveness. Built into the architecture so the system measures its
 * own performance instead of relying on assumptions.
 *
 * The monitor is environment-agnostic (Node, Edge, browser) and keeps
 * fixed-size rolling buffers so memory usage stays bounded.
 */

interface TimedMeasurement {
  readonly name: string;
  readonly durationMs: number;
  readonly timestamp: number;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

interface ApiCallMeasurement {
  readonly endpoint: string;
  readonly method: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly timestamp: number;
}

interface ResourceSample {
  readonly type: string;
  readonly metrics: Readonly<Record<string, number>>;
  readonly timestamp: number;
}

interface ErrorSample {
  readonly errorName: string;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly timestamp: number;
}

interface CacheSample {
  readonly tier: string;
  readonly hit: boolean;
  readonly latencyMs: number;
  readonly timestamp: number;
}

interface PerformanceSummary {
  readonly averageExecutionDurationMs: number | null;
  readonly averageApiResponseDurationMs: number | null;
  readonly errorCount: number;
  readonly cacheHitRate: number | null;
  readonly resourceTypesTracked: number;
}

interface PerformanceSnapshot {
  readonly startupTimeMs: number | null;
  readonly executionMeasurements: ReadonlyArray<TimedMeasurement>;
  readonly apiMeasurements: ReadonlyArray<ApiCallMeasurement>;
  readonly resourceSamples: ReadonlyArray<ResourceSample>;
  readonly errorSamples: ReadonlyArray<ErrorSample>;
  readonly cacheSamples: ReadonlyArray<CacheSample>;
  readonly summary: PerformanceSummary;
}

const MAX_EXECUTION_MEASUREMENTS = 500;
const MAX_API_MEASUREMENTS = 500;
const MAX_ERROR_SAMPLES = 200;
const MAX_CACHE_SAMPLES = 500;
const MAX_RESOURCE_SAMPLES = 500;
const PERCENT_DENOMINATOR = 100;

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function pushMeasurement<T extends { readonly timestamp: number }>(
  buffer: Array<T>,
  measurement: T,
  maxSize: number
): void {
  buffer.push(measurement);
  if (buffer.length > maxSize) {
    buffer.splice(0, buffer.length - maxSize);
  }
}

function averageDuration(
  measurements: ReadonlyArray<{ readonly durationMs: number }>
): number | null {
  if (measurements.length === 0) {
    return null;
  }
  const total = measurements.reduce((sum, entry) => sum + entry.durationMs, 0);
  return total / measurements.length;
}

function cacheHitRate(samples: ReadonlyArray<CacheSample>): number | null {
  if (samples.length === 0) {
    return null;
  }
  const hits = samples.filter((sample) => sample.hit).length;
  return (hits / samples.length) * PERCENT_DENOMINATOR;
}

/**
 * Singleton performance monitor. All measurements are retained in fixed-size
 * rolling buffers so the monitor can run continuously without unbounded growth.
 */
export class PerformanceMonitor {
  private startupTimeMs: number | null = null;

  private readonly executionMeasurements: Array<TimedMeasurement> = [];
  private readonly apiMeasurements: Array<ApiCallMeasurement> = [];
  private readonly resourceSamples: Array<ResourceSample> = [];
  private readonly errorSamples: Array<ErrorSample> = [];
  private readonly cacheSamples: Array<CacheSample> = [];

  private static instance: PerformanceMonitor | null = null;

  private constructor() {
    // Intentionally empty. Use getInstance().
  }

  /**
   * Returns the shared monitor instance.
   */
  public static getInstance(): PerformanceMonitor {
    if (PerformanceMonitor.instance === null) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Records the application startup time in milliseconds.
   */
  public recordStartupTime(
    durationMs: number,
    attributes?: Readonly<Record<string, string | number | boolean>>
  ): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }
    this.startupTimeMs = durationMs;
    this.executionMeasurements.push({
      name: 'app.startup',
      durationMs,
      timestamp: nowMs(),
      attributes: attributes ?? {},
    });
    if (this.executionMeasurements.length > MAX_EXECUTION_MEASUREMENTS) {
      this.executionMeasurements.splice(
        0,
        this.executionMeasurements.length - MAX_EXECUTION_MEASUREMENTS
      );
    }
  }

  /**
   * Returns the recorded startup time, if any.
   */
  public getStartupTime(): number | null {
    return this.startupTimeMs;
  }

  /**
   * Measures the execution time of an operation, recording it for later
   * analysis and regression detection. Works for synchronous and asynchronous
   * operations.
   */
  public async measureExecution<T>(
    name: string,
    fn: () => T | Promise<T>,
    options?: {
      readonly attributes?: Readonly<Record<string, string | number | boolean>>;
    }
  ): Promise<T> {
    const startTime = nowMs();
    try {
      return await fn();
    } finally {
      const durationMs = nowMs() - startTime;
      this.executionMeasurements.push({
        name,
        durationMs,
        timestamp: nowMs(),
        attributes: options?.attributes ?? {},
      });
      if (this.executionMeasurements.length > MAX_EXECUTION_MEASUREMENTS) {
        this.executionMeasurements.splice(
          0,
          this.executionMeasurements.length - MAX_EXECUTION_MEASUREMENTS
        );
      }
    }
  }

  /**
   * Records an API response time measurement.
   */
  public recordApiResponse(options: {
    readonly endpoint: string;
    readonly method: string;
    readonly statusCode: number;
    readonly durationMs: number;
  }): void {
    const { endpoint, method, statusCode, durationMs } = options;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }
    const measurement: ApiCallMeasurement = {
      endpoint,
      method,
      statusCode,
      durationMs,
      timestamp: nowMs(),
    };
    pushMeasurement(this.apiMeasurements, measurement, MAX_API_MEASUREMENTS);
  }

  /**
   * Records a resource consumption sample (for example memory utilization).
   */
  public recordResourceConsumption(options: {
    readonly type: string;
    readonly metrics: Readonly<Record<string, number>>;
  }): void {
    pushMeasurement(
      this.resourceSamples,
      {
        type: options.type,
        metrics: options.metrics,
        timestamp: nowMs(),
      },
      MAX_RESOURCE_SAMPLES
    );
  }

  /**
   * Records an error occurrence for error-frequency tracking.
   */
  public recordError(options: {
    readonly error: Error;
    readonly context?: Readonly<Record<string, unknown>>;
  }): void {
    pushMeasurement(
      this.errorSamples,
      {
        errorName: options.error.name,
        message: options.error.message,
        context: options.context ?? {},
        timestamp: nowMs(),
      },
      MAX_ERROR_SAMPLES
    );
  }

  /**
   * Records a cache effectiveness sample (hit or miss plus latency).
   */
  public recordCacheEffectiveness(options: {
    readonly tier: string;
    readonly hit: boolean;
    readonly latencyMs: number;
  }): void {
    pushMeasurement(
      this.cacheSamples,
      {
        tier: options.tier,
        hit: options.hit,
        latencyMs: options.latencyMs,
        timestamp: nowMs(),
      },
      MAX_CACHE_SAMPLES
    );
  }

  /**
   * Returns a snapshot of all current measurements.
   */
  public getSnapshot(): PerformanceSnapshot {
    return {
      startupTimeMs: this.startupTimeMs,
      executionMeasurements: Object.freeze([...this.executionMeasurements]),
      apiMeasurements: Object.freeze([...this.apiMeasurements]),
      resourceSamples: Object.freeze([...this.resourceSamples]),
      errorSamples: Object.freeze([...this.errorSamples]),
      cacheSamples: Object.freeze([...this.cacheSamples]),
      summary: {
        averageExecutionDurationMs: averageDuration(this.executionMeasurements),
        averageApiResponseDurationMs: averageDuration(this.apiMeasurements),
        errorCount: this.errorSamples.length,
        cacheHitRate: cacheHitRate(this.cacheSamples),
        resourceTypesTracked: new Set(this.resourceSamples.map((sample) => sample.type)).size,
      },
    };
  }

  /**
   * Clears all measurements. Intended for testing.
   */
  public reset(): void {
    this.startupTimeMs = null;
    this.executionMeasurements.length = 0;
    this.apiMeasurements.length = 0;
    this.resourceSamples.length = 0;
    this.errorSamples.length = 0;
    this.cacheSamples.length = 0;
  }
}

/**
 * Shared monitor instance used across the portal.
 */
export const performanceMonitor = PerformanceMonitor.getInstance();
