/* cspell:words ewma flatline flatlined cusum */
import type { AnomalySeverity, TelemetryAnomalyAlert, TelemetryMetricName } from '@repo/contract';

const MIN_SAMPLES_FOR_STATS = 4;
const FLATLINE_WINDOW_SIZE = 5;
const FLATLINE_EPSILON = 1e-6;
const MAD_CONSISTENCY_CONSTANT = 0.6745;
const DEFAULT_EWMA_ALPHA = 0.3;
const WARNING_Z_THRESHOLD = 2.5;
const CRITICAL_Z_THRESHOLD = 3.5;
const CUSUM_DRIFT_SLACK_PCT = 2.0;
const CUSUM_ALARM_THRESHOLD_PCT = 12.0;

export interface TelemetryReadingInput {
  readonly machineId: string;
  readonly recordedAt: string;
  readonly engineTempC?: number | null;
  readonly hydraulicPressureBar?: number | null;
  readonly vibrationLevelMmS?: number | null;
  readonly engineRpm?: number | null;
  readonly fuelLevelPct?: number | null;
}

export interface EvaluateTelemetryOptions {
  readonly machineId: string;
  readonly readings: readonly TelemetryReadingInput[];
  readonly ewmaAlpha?: number;
}

export interface CusumDriftResult {
  readonly positiveCusumPct: number;
  readonly negativeCusumPct: number;
  readonly isDrifting: boolean;
  readonly direction: 'OVER_REPORTED' | 'UNDER_REPORTED' | 'STABLE';
}

interface MetricExtractor {
  readonly metric: TelemetryMetricName;
  readonly label: string;
  readonly unit: string;
  readonly extract: (reading: TelemetryReadingInput) => number | null | undefined;
}

const METRIC_EXTRACTORS: readonly MetricExtractor[] = [
  { metric: 'engine_temp', label: 'Engine Temperature', unit: '°C', extract: (r) => r.engineTempC },
  {
    metric: 'hydraulic_pressure',
    label: 'Hydraulic Pressure',
    unit: 'bar',
    extract: (r) => r.hydraulicPressureBar,
  },
  {
    metric: 'vibration_level',
    label: 'Vibration Level',
    unit: 'mm/s',
    extract: (r) => r.vibrationLevelMmS,
  },
  { metric: 'engine_rpm', label: 'Engine RPM', unit: 'rpm', extract: (r) => r.engineRpm },
  { metric: 'fuel_level', label: 'Fuel Level', unit: '%', extract: (r) => r.fuelLevelPct },
];

function computeMedian(sortedNumbers: readonly number[]): number {
  const count = sortedNumbers.length;
  if (count === 0) return 0;
  const midpoint = Math.floor(count / 2);
  if (count % 2 === 1) return sortedNumbers[midpoint] ?? 0;
  const left = sortedNumbers[midpoint - 1] ?? 0;
  const right = sortedNumbers[midpoint] ?? 0;
  return (left + right) / 2;
}

function computeEwma(series: readonly number[], alpha: number): number {
  if (series.length === 0) return 0;
  let smoothed = series[0] ?? 0;
  for (let idx = 1; idx < series.length; idx += 1) {
    const sample = series[idx] ?? smoothed;
    smoothed = alpha * sample + (1 - alpha) * smoothed;
  }
  return smoothed;
}

/**
 * Detects whether the trailing telemetry window is stuck on an identical reading (sensor fault).
 */
export function detectSensorFlatline(
  series: readonly number[],
  windowSize = FLATLINE_WINDOW_SIZE
): boolean {
  if (series.length < windowSize) return false;
  const trailing = series.slice(series.length - windowSize);
  const anchor = trailing[0] ?? 0;
  return trailing.every((reading) => Math.abs(reading - anchor) <= FLATLINE_EPSILON);
}

function classifyZScoreSeverity(absZScore: number): AnomalySeverity {
  if (absZScore >= CRITICAL_Z_THRESHOLD) return 'CRITICAL';
  if (absZScore >= WARNING_Z_THRESHOLD) return 'WARNING';
  return 'NORMAL';
}

function evaluateSingleMetric(options: {
  readonly machineId: string;
  readonly extractor: MetricExtractor;
  readonly readings: readonly TelemetryReadingInput[];
  readonly ewmaAlpha: number;
}): TelemetryAnomalyAlert | null {
  const numericPoints: Array<{ readonly sample: number; readonly recordedAt: string }> = [];
  for (const reading of options.readings) {
    const extracted = options.extractor.extract(reading);
    if (typeof extracted === 'number' && Number.isFinite(extracted)) {
      numericPoints.push({ sample: extracted, recordedAt: reading.recordedAt });
    }
  }

  if (numericPoints.length < MIN_SAMPLES_FOR_STATS) return null;

  const samples = numericPoints.map((point) => point.sample);
  const latestPoint = numericPoints[numericPoints.length - 1];
  if (!latestPoint) return null;

  const isFlatline = detectSensorFlatline(samples);
  const sortedSamples = [...samples].sort((left, right) => left - right);
  const baselineMedian = computeMedian(sortedSamples);
  const absoluteDeviations = sortedSamples.map((sample) => Math.abs(sample - baselineMedian));
  const sortedDeviations = [...absoluteDeviations].sort((left, right) => left - right);
  const mad = computeMedian(sortedDeviations);

  const modifiedZScore =
    mad <= FLATLINE_EPSILON
      ? 0
      : (MAD_CONSISTENCY_CONSTANT * (latestPoint.sample - baselineMedian)) / mad;

  const ewmaValue = computeEwma(samples, options.ewmaAlpha);
  const severity: AnomalySeverity = isFlatline
    ? 'SENSOR_FAULT'
    : classifyZScoreSeverity(Math.abs(modifiedZScore));

  if (severity === 'NORMAL') return null;

  const reason = isFlatline
    ? `${options.extractor.label} flatlined at ${latestPoint.sample.toFixed(1)} ${options.extractor.unit} across ${FLATLINE_WINDOW_SIZE} consecutive readings.`
    : `${options.extractor.label} deviated (${latestPoint.sample.toFixed(1)} vs median ${baselineMedian.toFixed(1)} ${options.extractor.unit}, |Z|=${Math.abs(modifiedZScore).toFixed(2)}).`;

  return {
    machineId: options.machineId,
    metric: options.extractor.metric,
    severity,
    latestValue: Number(latestPoint.sample.toFixed(2)),
    baselineMedian: Number(baselineMedian.toFixed(2)),
    modifiedZScore: Number(modifiedZScore.toFixed(2)),
    ewmaValue: Number(ewmaValue.toFixed(2)),
    isFlatline,
    reason,
    detectedAt: latestPoint.recordedAt,
  };
}

/**
 * Evaluates a chronological telemetry stream for a single machine and returns non-normal anomaly alerts.
 */
export function evaluateTelemetryAnomalies(
  options: EvaluateTelemetryOptions
): readonly TelemetryAnomalyAlert[] {
  if (options.readings.length < MIN_SAMPLES_FOR_STATS) return [];

  const ewmaAlpha = options.ewmaAlpha ?? DEFAULT_EWMA_ALPHA;
  const sortedReadings = [...options.readings].sort((left, right) =>
    left.recordedAt.localeCompare(right.recordedAt)
  );

  const alerts: TelemetryAnomalyAlert[] = [];
  for (const extractor of METRIC_EXTRACTORS) {
    const alert = evaluateSingleMetric({
      machineId: options.machineId,
      extractor,
      readings: sortedReadings,
      ewmaAlpha,
    });
    if (alert) alerts.push(alert);
  }
  return alerts;
}

/**
 * Tracks cumulative sum (CUSUM) of tonnage reconciliation variance percentages to surface sustained drift early.
 */
export function evaluateReconciliationCusum(driftPercentages: readonly number[]): CusumDriftResult {
  let positiveCusum = 0;
  let negativeCusum = 0;

  for (const driftPct of driftPercentages) {
    if (!Number.isFinite(driftPct)) continue;
    positiveCusum = Math.max(0, positiveCusum + driftPct - CUSUM_DRIFT_SLACK_PCT);
    negativeCusum = Math.max(0, negativeCusum - driftPct - CUSUM_DRIFT_SLACK_PCT);
  }

  const isPositiveAlarm = positiveCusum >= CUSUM_ALARM_THRESHOLD_PCT;
  const isNegativeAlarm = negativeCusum >= CUSUM_ALARM_THRESHOLD_PCT;
  const isDrifting = isPositiveAlarm || isNegativeAlarm;

  const direction = isPositiveAlarm
    ? 'OVER_REPORTED'
    : isNegativeAlarm
      ? 'UNDER_REPORTED'
      : 'STABLE';

  return {
    positiveCusumPct: Number(positiveCusum.toFixed(2)),
    negativeCusumPct: Number(negativeCusum.toFixed(2)),
    isDrifting,
    direction,
  };
}
