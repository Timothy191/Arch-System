/**
 * Performance regression detection.
 *
 * Compares live measurements against committed baselines so performance
 * regressions are detectable through automated measurement, per the
 * "continuous optimization" principle of the performance architecture.
 */

interface BaselineEntry {
  readonly metricId: string;
  readonly baselineValue: number;
  readonly context?: Readonly<Record<string, unknown>>;
}

interface RegressionResult {
  readonly metricId: string;
  readonly isRegression: boolean;
  readonly baselineValue: number;
  readonly currentValue: number;
  readonly changePercent: number;
  readonly severity: 'none' | 'minor' | 'major' | 'critical';
}

const REGRESSION_WARN_THRESHOLD_PERCENT = 5;
const REGRESSION_ERROR_THRESHOLD_PERCENT = 10;
const REGRESSION_CRITICAL_THRESHOLD_PERCENT = 25;
const PERCENT_DENOMINATOR = 100;

function classifySeverity(changePercent: number): 'none' | 'minor' | 'major' | 'critical' {
  const absChange = Math.abs(changePercent);
  if (absChange >= REGRESSION_CRITICAL_THRESHOLD_PERCENT) {
    return 'critical';
  }
  if (absChange >= REGRESSION_ERROR_THRESHOLD_PERCENT) {
    return 'major';
  }
  if (absChange >= REGRESSION_WARN_THRESHOLD_PERCENT) {
    return 'minor';
  }
  return 'none';
}

/**
 * Detects performance regressions by comparing live measurements against
 * recorded baselines. A positive changePercent means the current value is
 * worse than the baseline (for example, a slower response time).
 */
export class PerformanceRegressionDetector {
  private readonly baselines: Map<string, BaselineEntry> = new Map();

  /**
   * Registers or updates a baseline for a metric.
   */
  public recordBaseline(
    metricId: string,
    baselineValue: number,
    options?: {
      readonly context?: Readonly<Record<string, unknown>>;
    }
  ): void {
    if (!Number.isFinite(baselineValue)) {
      return;
    }
    this.baselines.set(metricId, {
      metricId,
      baselineValue,
      context: options?.context ?? {},
    });
  }

  /**
   * Registers multiple baselines at once, for example loaded from a config file.
   */
  public loadBaselinesFromConfig(entries: ReadonlyArray<BaselineEntry>): void {
    for (const entry of entries) {
      this.recordBaseline(entry.metricId, entry.baselineValue, { context: entry.context });
    }
  }

  /**
   * Returns the baseline for a metric, if one exists.
   */
  public getBaseline(metricId: string): BaselineEntry | null {
    return this.baselines.get(metricId) ?? null;
  }

  /**
   * Compares a live measurement against its baseline and returns a
   * regression result, or null when no baseline exists for the metric.
   */
  public checkRegression(metricId: string, currentValue: number): RegressionResult | null {
    const baseline = this.getBaseline(metricId);
    if (baseline === null || !Number.isFinite(currentValue)) {
      return null;
    }
    const baselineValue = baseline.baselineValue;
    if (baselineValue === 0) {
      return {
        metricId,
        isRegression: currentValue > baselineValue,
        baselineValue,
        currentValue,
        changePercent: currentValue > baselineValue ? Number.POSITIVE_INFINITY : 0,
        severity: currentValue > baselineValue ? 'critical' : 'none',
      };
    }
    const changePercent = ((currentValue - baselineValue) / baselineValue) * PERCENT_DENOMINATOR;
    const isRegression = changePercent > 0;
    const severity = isRegression ? classifySeverity(changePercent) : 'none';
    return {
      metricId,
      isRegression,
      baselineValue,
      currentValue,
      changePercent,
      severity,
    };
  }

  /**
   * Returns all registered baseline metric IDs.
   */
  public getBaselineIds(): ReadonlyArray<string> {
    return [...this.baselines.keys()];
  }

  /**
   * Clears all baselines. Intended for testing.
   */
  public reset(): void {
    this.baselines.clear();
  }
}

/**
 * Shared regression detector instance used across the portal.
 */
export const performanceRegressionDetector = new PerformanceRegressionDetector();
