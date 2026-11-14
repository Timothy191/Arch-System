import type { ForecastPoint, ProductionForecastResult } from '@repo/contract';

const MIN_HOLT_POINTS = 3;
const DEFAULT_LEVEL_ALPHA = 0.35;
const DEFAULT_TREND_BETA = 0.15;
const DEFAULT_DAMPING_PHI = 0.85;
const Z_SCORE_95 = 1.96;
const DEFAULT_CAPACITY_FACTOR = 1.0;
const ROUNDING_PRECISION = 100;

export interface ForecastProductionOptions {
  readonly history: readonly number[];
  readonly periods: number;
  readonly fleetAvailabilityRatio?: number;
  readonly alpha?: number;
  readonly beta?: number;
  readonly phi?: number;
}

function roundToTwoDecimals(numericValue: number): number {
  return Math.round(numericValue * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function clampCapacityFactor(availability: number | undefined): number {
  if (typeof availability !== 'number' || !Number.isFinite(availability)) {
    return DEFAULT_CAPACITY_FACTOR;
  }
  return Math.max(0, Math.min(1, availability));
}

function computeResidualStdDev(residuals: readonly number[]): number {
  if (residuals.length < 2) return 0;
  const mean = residuals.reduce((sum, residual) => sum + residual, 0) / residuals.length;
  const variance =
    residuals.reduce((sum, residual) => sum + (residual - mean) ** 2, 0) / (residuals.length - 1);
  return Math.sqrt(variance);
}

/**
 * Forecasts future production periods using Holt's Damped Trend Exponential Smoothing
 * scaled by active fleet availability, returning 95% confidence bounds.
 */
export function forecastProductionSeries(
  options: ForecastProductionOptions
): ProductionForecastResult {
  const periods = Math.max(0, Math.floor(options.periods));
  const capacityFactor = clampCapacityFactor(options.fleetAvailabilityRatio);
  const cleanHistory = options.history.filter((entry) => Number.isFinite(entry));

  if (periods === 0) {
    return { method: 'holts_damped', capacityFactor, points: [] };
  }

  if (cleanHistory.length < MIN_HOLT_POINTS) {
    const anchor = cleanHistory[cleanHistory.length - 1] ?? 0;
    const adjusted = roundToTwoDecimals(anchor * capacityFactor);
    const points: ForecastPoint[] = Array.from({ length: periods }, (_, index) => ({
      periodIndex: index + 1,
      pointForecast: adjusted,
      lowerBound95: adjusted,
      upperBound95: adjusted,
    }));
    return { method: 'fallback_constant', capacityFactor, points };
  }

  const alpha = options.alpha ?? DEFAULT_LEVEL_ALPHA;
  const beta = options.beta ?? DEFAULT_TREND_BETA;
  const phi = options.phi ?? DEFAULT_DAMPING_PHI;

  let level = cleanHistory[0] ?? 0;
  let trend = (cleanHistory[1] ?? level) - level;
  const residuals: number[] = [];

  for (let idx = 1; idx < cleanHistory.length; idx += 1) {
    const actual = cleanHistory[idx] ?? level;
    const oneStepPrediction = level + phi * trend;
    residuals.push(actual - oneStepPrediction);

    const nextLevel = alpha * actual + (1 - alpha) * oneStepPrediction;
    const nextTrend = beta * (nextLevel - level) + (1 - beta) * phi * trend;
    level = nextLevel;
    trend = nextTrend;
  }

  const residualStdDev = computeResidualStdDev(residuals);
  const points: ForecastPoint[] = [];
  let cumulativePhi = 0;

  for (let step = 1; step <= periods; step += 1) {
    cumulativePhi += phi ** step;
    const rawForecast = Math.max(0, (level + cumulativePhi * trend) * capacityFactor);
    const intervalHalfWidth = Z_SCORE_95 * residualStdDev * Math.sqrt(step) * capacityFactor;

    points.push({
      periodIndex: step,
      pointForecast: roundToTwoDecimals(rawForecast),
      lowerBound95: roundToTwoDecimals(Math.max(0, rawForecast - intervalHalfWidth)),
      upperBound95: roundToTwoDecimals(rawForecast + intervalHalfWidth),
    });
  }

  return { method: 'holts_damped', capacityFactor, points };
}

/**
 * Simple least-squares linear regression forecast (retained for backwards compatibility).
 */
export function linearForecast(history: readonly number[], periods: number): number[] {
  const count = history.length;
  if (count < 2) return Array(periods).fill(history[0] ?? 0) as number[];

  const xMean = (count - 1) / 2;
  const yMean = history.reduce((acc, num) => acc + num, 0) / count;
  const ssXX = history.reduce((acc, _, idx) => acc + (idx - xMean) ** 2, 0);
  const ssXY = history.reduce((acc, num, idx) => acc + (idx - xMean) * (num - yMean), 0);
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;

  return Array.from({ length: periods }, (_, idx) => yMean + slope * (count + idx - xMean));
}
