'use client';

import { Activity } from 'lucide-react';
import type { Panel } from './hero-types';
import { ARCH_LOGO_PATH, ARCH_LOGO_VIEWBOX } from './Logo';

export interface GlobeDepartmentMetricsProps {
  readonly activePanel?: Panel;
}

interface ChartCoordinate {
  readonly x: number;
  readonly y: number;
  readonly recordedValue: number;
}

const CHART_WIDTH = 440;
const CHART_HEIGHT = 112;
const CHART_PAD_X = 12;
const CHART_PAD_TOP = 14;
const CHART_PAD_BOTTOM = 16;
const MIN_TREND_POINTS = 2;
const SPLINE_TENSION = 0.2;
const MIN_DISPLAY_RANGE_PAD = 0.08;

function buildSmoothPath(coordinates: readonly ChartCoordinate[]): string {
  const firstCoordinate = coordinates[0];
  if (!firstCoordinate) return '';
  if (coordinates.length === 1) {
    return `M ${firstCoordinate.x.toFixed(1)} ${firstCoordinate.y.toFixed(1)}`;
  }

  const segments: string[] = [`M ${firstCoordinate.x.toFixed(1)} ${firstCoordinate.y.toFixed(1)}`];

  for (let index = 1; index < coordinates.length; index += 1) {
    const current = coordinates[index];
    if (!current) continue;
    const beforePrevious = coordinates[Math.max(0, index - 2)] ?? current;
    const previous = coordinates[index - 1] ?? current;
    const next = coordinates[Math.min(coordinates.length - 1, index + 1)] ?? current;

    const control1X = previous.x + (current.x - beforePrevious.x) * SPLINE_TENSION;
    const control1Y = previous.y + (current.y - beforePrevious.y) * SPLINE_TENSION;
    const control2X = current.x - (next.x - previous.x) * SPLINE_TENSION;
    const control2Y = current.y - (next.y - previous.y) * SPLINE_TENSION;

    segments.push(
      `C ${control1X.toFixed(1)} ${control1Y.toFixed(1)}, ${control2X.toFixed(1)} ${control2Y.toFixed(1)}, ${current.x.toFixed(1)} ${current.y.toFixed(1)}`
    );
  }

  return segments.join(' ');
}

/** Renders only telemetry already attached to the active department panel. */
export function GlobeDepartmentMetrics({ activePanel }: GlobeDepartmentMetricsProps) {
  if (!activePanel) {
    return (
      <div
        className="flex min-w-0 flex-col justify-center rounded-xl border border-white/75 bg-white/80 p-3 shadow-xs backdrop-blur-md"
        data-testid="globe-dept-metrics-unavailable"
      >
        <p className="text-center font-mono text-[11px] text-slate-600">
          Department telemetry unavailable
        </p>
      </div>
    );
  }

  const recordedTrend = (activePanel.trend ?? []).filter((rawNumber) => Number.isFinite(rawNumber));
  const hasTrend = recordedTrend.length >= MIN_TREND_POINTS;
  const lowest = hasTrend ? Math.min(...recordedTrend) : 0;
  const highest = hasTrend ? Math.max(...recordedTrend) : 0;
  const recordedRange = Math.max(highest - lowest, 1);
  const paddedMinimum = lowest - recordedRange * MIN_DISPLAY_RANGE_PAD;
  const paddedRange = Math.max(highest + recordedRange * MIN_DISPLAY_RANGE_PAD - paddedMinimum, 1);
  const plotWidth = CHART_WIDTH - CHART_PAD_X * 2;
  const plotBottom = CHART_HEIGHT - CHART_PAD_BOTTOM;
  const plotHeight = plotBottom - CHART_PAD_TOP;

  const coordinates: ChartCoordinate[] = hasTrend
    ? recordedTrend.map((recordedValue, index) => ({
        x: CHART_PAD_X + (index / Math.max(recordedTrend.length - 1, 1)) * plotWidth,
        y: plotBottom - ((recordedValue - paddedMinimum) / paddedRange) * plotHeight,
        recordedValue,
      }))
    : [];

  const linePath = buildSmoothPath(coordinates);
  const firstCoordinate = coordinates[0];
  const lastCoordinate = coordinates[coordinates.length - 1];
  const areaPath =
    linePath && firstCoordinate && lastCoordinate
      ? `${linePath} L ${lastCoordinate.x.toFixed(1)} ${plotBottom} L ${firstCoordinate.x.toFixed(1)} ${plotBottom} Z`
      : '';
  const statLabel = activePanel.stats?.label ?? 'Metric';
  const statValue = activePanel.stats?.value ?? 'Unavailable';
  const gradientSuffix = `globe-${activePanel.name}`;

  return (
    <div
      className="flex min-w-0 flex-col justify-between gap-3"
      data-testid={`globe-dept-metrics-${activePanel.name}`}
    >
      <div className="rounded-xl border border-white/75 bg-white/80 p-3 shadow-xs backdrop-blur-md">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent-gold" aria-hidden="true" />
              <span className="truncate font-bold font-mono text-[10px] text-slate-600 uppercase tracking-wider">
                {activePanel.title} Telemetry
              </span>
            </div>
            <p className="mt-0.5 truncate font-medium text-[11px] text-slate-600">
              {activePanel.description}
            </p>
          </div>

          {activePanel.stats && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-gold/45 bg-accent-gold/12 px-2 py-0.5 font-bold font-mono text-[10px] text-slate-950 tabular-nums">
              <Activity className="h-2.5 w-2.5 text-accent-gold" aria-hidden="true" />
              {statLabel}: {statValue}
            </span>
          )}
        </div>

        {hasTrend ? (
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-24 w-full overflow-visible"
            role="img"
            aria-label={`${activePanel.title} recorded trend`}
          >
            <defs>
              <linearGradient id={`area-${gradientSuffix}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {[0.25, 0.55, 0.85].map((ratio) => (
              <line
                key={ratio}
                x1={CHART_PAD_X}
                y1={CHART_PAD_TOP + plotHeight * ratio}
                x2={CHART_WIDTH - CHART_PAD_X}
                y2={CHART_PAD_TOP + plotHeight * ratio}
                stroke="rgba(148, 163, 184, 0.28)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            ))}

            {areaPath && <path d={areaPath} fill={`url(#area-${gradientSuffix})`} />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="var(--accent-gold)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {coordinates.map((coordinate, index) => (
              <circle
                key={`${coordinate.x}-${coordinate.y}`}
                cx={coordinate.x}
                cy={coordinate.y}
                r={index === coordinates.length - 1 ? 3.5 : 2}
                fill={index === coordinates.length - 1 ? 'var(--accent-gold)' : '#ffffff'}
                stroke="var(--accent-gold)"
                strokeWidth={index === coordinates.length - 1 ? 2 : 1.5}
              />
            ))}

            {lastCoordinate && (
              <svg
                x={lastCoordinate.x - 6}
                y={lastCoordinate.y - 6}
                width={12}
                height={12}
                viewBox={ARCH_LOGO_VIEWBOX}
                aria-hidden="true"
              >
                <path d={ARCH_LOGO_PATH} fill="var(--accent-gold)" fillRule="evenodd" />
              </svg>
            )}
          </svg>
        ) : (
          <p
            className="flex h-24 items-center justify-center font-mono text-[11px] text-slate-600"
            data-testid="globe-telemetry-unavailable"
          >
            Trend data unavailable
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-white/75 bg-white/80 px-3 py-2 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-[11px] text-slate-700">Recorded metric</span>
          <span className="truncate font-bold font-mono text-[11px] text-slate-950">
            {statLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-[11px] text-slate-700">Current value</span>
          <span className="truncate font-bold font-mono text-slate-950 tabular-nums">
            {statValue}
          </span>
        </div>
      </div>
    </div>
  );
}
