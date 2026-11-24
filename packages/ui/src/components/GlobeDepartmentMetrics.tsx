'use client';

import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { getHeroKpiTiles, getHeroTelemetrySeries } from './HeroCardContent';
import type { Panel } from './hero-types';
import { ARCH_LOGO_PATH, ARCH_LOGO_VIEWBOX } from './Logo';

export interface GlobeDepartmentMetricsProps {
  readonly activePanel: Panel;
}

interface ChartCoordinate {
  readonly x: number;
  readonly y: number;
  readonly value: number;
}

const CHART_WIDTH = 440;
const CHART_HEIGHT = 112;
const CHART_PAD_X = 12;
const CHART_PAD_TOP = 14;
const CHART_PAD_BOTTOM = 16;
const SPLINE_TENSION = 0.2;
const MIN_DISPLAY_PERCENT_PAD = 0.08;
const TREND_UP_THRESHOLD = 0;

function computeSmoothBezierPath(coords: readonly ChartCoordinate[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) {
    const first = coords[0];
    return first ? `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}` : '';
  }

  const segments: string[] = [];
  for (let idx = 0; idx < coords.length; idx += 1) {
    const curr = coords[idx];
    if (!curr) continue;
    if (idx === 0) {
      segments.push(`M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`);
      continue;
    }

    const prevPrev = coords[Math.max(0, idx - 2)] ?? curr;
    const prev = coords[idx - 1] ?? curr;
    const next = coords[Math.min(coords.length - 1, idx + 1)] ?? curr;

    const cp1x = prev.x + (curr.x - prevPrev.x) * SPLINE_TENSION;
    const cp1y = prev.y + (curr.y - prevPrev.y) * SPLINE_TENSION;
    const cp2x = curr.x - (next.x - prev.x) * SPLINE_TENSION;
    const cp2y = curr.y - (next.y - prev.y) * SPLINE_TENSION;

    segments.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
    );
  }
  return segments.join(' ');
}

/** Synchronized telemetry chart and KPI tiles mirroring the active HeroRotator department slide. */
export function GlobeDepartmentMetrics({ activePanel }: GlobeDepartmentMetricsProps) {
  const series = getHeroTelemetrySeries(activePanel.name, activePanel.stats);
  const kpiTiles = getHeroKpiTiles(activePanel.name);
  const rawPoints =
    activePanel.trend && activePanel.trend.length >= 2 ? activePanel.trend : series.points;

  const minVal = Math.min(...rawPoints);
  const maxVal = Math.max(...rawPoints);
  const rawRange = Math.max(maxVal - minVal, 1);
  const paddedMin = minVal - rawRange * MIN_DISPLAY_PERCENT_PAD;
  const paddedRange = Math.max(maxVal + rawRange * MIN_DISPLAY_PERCENT_PAD - paddedMin, 1);

  const plotWidth = CHART_WIDTH - CHART_PAD_X * 2;
  const plotBottom = CHART_HEIGHT - CHART_PAD_BOTTOM;
  const plotHeight = plotBottom - CHART_PAD_TOP;

  const coords: ChartCoordinate[] = rawPoints.map((value, index) => {
    const x = CHART_PAD_X + (index / Math.max(rawPoints.length - 1, 1)) * plotWidth;
    const y = plotBottom - ((value - paddedMin) / paddedRange) * plotHeight;
    return { x, y, value };
  });

  const smoothLinePath = computeSmoothBezierPath(coords);
  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];
  const areaPath =
    smoothLinePath && firstCoord && lastCoord
      ? `${smoothLinePath} L ${lastCoord.x.toFixed(1)} ${plotBottom} L ${firstCoord.x.toFixed(1)} ${plotBottom} Z`
      : '';

  const avgNumeric = rawPoints.reduce((acc, pt) => acc + pt, 0) / Math.max(rawPoints.length, 1);
  const avgY = plotBottom - ((avgNumeric - paddedMin) / paddedRange) * plotHeight;
  const firstVal = rawPoints[0] ?? 0;
  const lastVal = rawPoints[rawPoints.length - 1] ?? 0;
  const deltaPct = firstVal !== 0 ? ((lastVal - firstVal) / Math.abs(firstVal)) * 100 : 0;
  const isPositiveTrend = deltaPct >= TREND_UP_THRESHOLD;
  const gradSuffix = `globe-${activePanel.name}`;

  return (
    <div
      className="flex min-w-0 flex-col justify-between gap-3"
      data-testid={`globe-dept-metrics-${activePanel.name}`}
    >
      {/* Active department telemetry header */}
      <div className="rounded-xl border border-white/75 bg-white/80 p-3 shadow-xs backdrop-blur-md">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent-green" aria-hidden="true" />
              <span className="truncate font-bold font-mono text-[10px] text-slate-600 uppercase tracking-wider">
                {activePanel.assetOverline ?? `${activePanel.title} // LIVE`}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <div className="truncate font-anurati font-bold text-slate-950 text-sm tracking-[0.04em]">
                {activePanel.title} Telemetry
              </div>
              <span className="font-medium text-[11px] text-slate-600">· {series.title}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold font-mono text-[10px]',
                isPositiveTrend
                  ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-900'
                  : 'border-rose-500/30 bg-rose-500/12 text-rose-900'
              )}
            >
              {isPositiveTrend ? (
                <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />
              )}
              {series.deltaBadge}
            </span>
            {activePanel.stats && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-gold/45 bg-accent-gold/12 px-2 py-0.5 font-bold font-mono text-[10px] text-slate-950 tabular-nums">
                <Activity className="h-2.5 w-2.5 text-accent-gold" aria-hidden="true" />
                {activePanel.stats.value}
              </span>
            )}
          </div>
        </div>

        {/* Synchronized smooth area + grid line SVG graph */}
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-24 w-full overflow-visible"
          role="img"
          aria-label={`${activePanel.title} live telemetry graph`}
        >
          <defs>
            <linearGradient id={`area-${gradSuffix}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series.strokeColor} stopOpacity="0.34" />
              <stop offset="100%" stopColor={series.strokeColor} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={`line-${gradSuffix}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={series.strokeColor} stopOpacity="0.65" />
              <stop offset="100%" stopColor={series.strokeColor} stopOpacity="1" />
            </linearGradient>
          </defs>

          {[0.25, 0.55, 0.85].map((ratio) => {
            const lineY = CHART_PAD_TOP + plotHeight * ratio;
            return (
              <line
                key={ratio}
                x1={CHART_PAD_X}
                y1={lineY}
                x2={CHART_WIDTH - CHART_PAD_X}
                y2={lineY}
                stroke="rgba(148, 163, 184, 0.28)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            );
          })}

          <line
            x1={CHART_PAD_X}
            y1={avgY}
            x2={CHART_WIDTH - CHART_PAD_X}
            y2={avgY}
            stroke="rgba(212, 175, 55, 0.48)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {areaPath && <path d={areaPath} fill={`url(#area-${gradSuffix})`} />}
          {smoothLinePath && (
            <path
              d={smoothLinePath}
              fill="none"
              stroke={`url(#line-${gradSuffix})`}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {coords.map((coord, idx) => (
            <circle
              key={`${coord.x}-${coord.y}`}
              cx={coord.x}
              cy={coord.y}
              r={idx === coords.length - 1 ? 3.5 : 2}
              fill={idx === coords.length - 1 ? series.strokeColor : '#ffffff'}
              stroke={series.strokeColor}
              strokeWidth={idx === coords.length - 1 ? 2 : 1.5}
            />
          ))}

          {lastCoord && (
            <svg
              x={lastCoord.x - 6}
              y={lastCoord.y - 6}
              width={12}
              height={12}
              viewBox={ARCH_LOGO_VIEWBOX}
              aria-hidden="true"
            >
              <path d={ARCH_LOGO_PATH} fill={series.strokeColor} fillRule="evenodd" />
            </svg>
          )}
        </svg>

        <div className="mt-1 flex items-center justify-between border-slate-200/80 border-t pt-1.5 font-bold font-mono text-[10px] text-slate-700 tabular-nums">
          <span>AVG {series.avgValue}</span>
          <span>PEAK {series.peakValue}</span>
          <span>
            DELTA {isPositiveTrend ? '+' : ''}
            {deltaPct.toFixed(1)}%
          </span>
          <span className="text-emerald-800">SYNCED LIVE</span>
        </div>
      </div>

      {/* Synchronized 2x2 KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        {kpiTiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col justify-between gap-1.5 rounded-xl border border-white/75 bg-white/80 px-3 py-2 shadow-xs"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate font-semibold text-[11px] text-slate-700">
                {tile.label}
              </span>
              <span className="shrink-0 rounded-full bg-emerald-500/12 px-1.5 py-0.5 font-bold font-mono text-[9.5px] text-emerald-900">
                {tile.delta}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold font-mono text-slate-950 text-sm tabular-nums">
                {tile.value}
              </span>
              <span className="truncate text-[10px] text-slate-600">{tile.subtext}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200/90">
              <div
                className="h-full rounded-full bg-accent-gold transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, tile.progressPct))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
