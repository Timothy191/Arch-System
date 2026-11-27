/**
 * Pure formatting helpers for the department card 24H telemetry panel.
 *
 * AGENT-TRACE: Replaces the raw `((last - first) / first) * 100` label that produced
 * misleading values such as "+3400.0%" when the baseline was tiny (e.g. 18 -> 630).
 * Large ratios are expressed as multipliers ("35×"), a zero baseline falls back to an
 * absolute delta ("+42"), and series too short to be a real time series are flagged as
 * snapshots so the card never draws a fabricated trend line from unrelated counters.
 */

/** Live overlays emit 3–4 heterogeneous counters; genuine hourly/shift series have 8+. */
export const MIN_TREND_POINTS = 5;

/** Percentage changes at or above this magnitude switch to a multiplier label. */
const MULTIPLIER_THRESHOLD_PCT = 1000;
/** Changes below this magnitude are considered flat (noise). */
const FLAT_THRESHOLD_PCT = 0.5;
const ONE_DECIMAL_BELOW_PCT = 10;

export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendSummary {
  readonly direction: TrendDirection;
  /** Visible badge text, e.g. "▲ 4.2%", "▲ 35×", "▼ 12%", "+42", "Flat". */
  readonly deltaLabel: string;
  /** Screen-reader phrasing of the delta, e.g. "up 35 times". */
  readonly deltaSpoken: string;
  readonly lowLabel: string;
  readonly highLabel: string;
  readonly latestLabel: string;
  readonly ariaLabel: string;
}

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return compactFormatter.format(value);
}

export function isTimeSeriesTrend(points: readonly number[] | undefined): points is number[] {
  return (
    Array.isArray(points) &&
    points.length >= MIN_TREND_POINTS &&
    points.every((point) => Number.isFinite(point))
  );
}

function formatPercent(absPct: number): string {
  return absPct < ONE_DECIMAL_BELOW_PCT ? `${absPct.toFixed(1)}%` : `${Math.round(absPct)}%`;
}

function formatMultiplier(ratio: number): string {
  const rounded = ratio >= 100 ? Math.round(ratio) : Math.round(ratio * 10) / 10;
  return `${rounded.toLocaleString('en-US')}×`;
}

export function formatTrendDelta(
  first: number,
  last: number
): Pick<TrendSummary, 'direction' | 'deltaLabel' | 'deltaSpoken'> {
  const diff = last - first;
  if (diff === 0) return { direction: 'flat', deltaLabel: 'Flat', deltaSpoken: 'flat' };

  const direction: TrendDirection = diff > 0 ? 'up' : 'down';
  const arrow = direction === 'up' ? '▲' : '▼';
  const word = direction === 'up' ? 'up' : 'down';

  if (first === 0) {
    const absolute = `${diff > 0 ? '+' : '−'}${formatCompactNumber(Math.abs(diff))}`;
    return { direction, deltaLabel: absolute, deltaSpoken: `${word} ${absolute.slice(1)}` };
  }

  const absPct = (Math.abs(diff) / Math.abs(first)) * 100;
  if (absPct < FLAT_THRESHOLD_PCT) {
    return { direction: 'flat', deltaLabel: 'Flat', deltaSpoken: 'flat' };
  }
  if (direction === 'up' && absPct >= MULTIPLIER_THRESHOLD_PCT && first > 0) {
    const multiplier = formatMultiplier(last / first);
    return {
      direction,
      deltaLabel: `${arrow} ${multiplier}`,
      deltaSpoken: `up ${multiplier.replace('×', '')} times`,
    };
  }
  const pct = absPct >= MULTIPLIER_THRESHOLD_PCT ? '>999%' : formatPercent(absPct);
  return { direction, deltaLabel: `${arrow} ${pct}`, deltaSpoken: `${word} ${pct}` };
}

export function buildTrendSummary(points: readonly number[], subject: string): TrendSummary {
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const delta = formatTrendDelta(first, last);
  const lowLabel = formatCompactNumber(Math.min(...points));
  const highLabel = formatCompactNumber(Math.max(...points));
  const latestLabel = formatCompactNumber(last);
  return {
    ...delta,
    lowLabel,
    highLabel,
    latestLabel,
    ariaLabel: `${subject} 24-hour trend: ${delta.deltaSpoken}, now ${latestLabel}, low ${lowLabel}, high ${highLabel}`,
  };
}
