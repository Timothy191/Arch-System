'use client';

import { Activity, AlertTriangle, Power, Wrench } from 'lucide-react';
import Link from 'next/link';
import { memo, useId, useMemo } from 'react';
import { cn } from '../lib/utils';
import type { Panel } from './hero-types';
import { ARCH_LOGO_VIEWBOX, ArchLogoBadge } from './Logo';

const TELEMETRY_MIN_POINTS = 2;
const GRAPH_VIEWBOX_WIDTH = 420;
const GRAPH_VIEWBOX_HEIGHT = 116;
const GRAPH_PAD_LEFT = 42;
const GRAPH_PAD_RIGHT = 14;
const GRAPH_PAD_TOP = 14;
const GRAPH_PAD_BOTTOM = 26;
const GRAPH_NODE_SIZE = 8;
const GRAPH_LAST_NODE_SIZE = 11;
const GRAPH_GRID_STEPS = 4;
const GRAPH_MAX_POINT_NODES = 16;
const GRAPH_MAX_VERTICAL_MARKERS = 10;
const ARCH_GRAPH_NODE_VIEWBOX_SIZE = 172.61;
const ARCH_GRAPH_NODE_PATH =
  'M86.31 0 55.25 31.05 0 86.31l55.25 55.25L86.31 172.61l31.05-31.05L172.61 86.31 117.36 31.05 86.31 0Zm0 31.05 25.19 25.2-25.19 25.19L61.12 56.25 86.31 31.05ZM31.05 86.31l25.2-25.19 25.19 25.19-25.19 25.2-25.2-25.2Zm55.26 55.26-25.19-25.2 25.19-25.19 25.19 25.19-25.19 25.2Z';

export const SystemGoldenSeparator = memo(function SystemGoldenSeparator({
  testId,
  className,
}: {
  testId?: string;
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      aria-hidden="true"
      className={cn('flex w-full items-center justify-center gap-2', className)}
    >
      <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-r from-transparent via-accent-gold/55 to-accent-gold motion-safe:animate-pulse" />
      <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] border border-accent-gold/80 bg-accent-gold/35" />
      <span className="gold-steel-border gold-steel-border-slim flex h-5 w-5 items-center justify-center rounded-full border border-accent-gold/45 bg-white/90 text-accent-gold shadow-2xs">
        <svg viewBox={ARCH_LOGO_VIEWBOX} className="h-3 w-3 fill-current motion-safe:animate-pulse">
          <path d={ARCH_GRAPH_NODE_PATH} />
        </svg>
      </span>
      <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] border border-accent-gold/80 bg-accent-gold/35" />
      <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-l from-transparent via-accent-gold/55 to-accent-gold motion-safe:animate-pulse" />
    </div>
  );
});

function formatGraphValue(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (absolute >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

// Keeps marker/node counts bounded so very long windows stay cheap and legible.
function sampleIndexes(length: number, maxCount: number): number[] {
  if (length <= maxCount) return Array.from({ length }, (_, index) => index);
  const step = Math.ceil(length / maxCount);
  const indexes: number[] = [];
  for (let index = 0; index < length; index += step) indexes.push(index);
  const lastIndex = length - 1;
  if (indexes[indexes.length - 1] !== lastIndex) indexes.push(lastIndex);
  return indexes;
}

const HeroTelemetryGraph = memo(function HeroTelemetryGraph({ panel }: { panel: Panel }) {
  const nodeSymbolId = useId();
  const areaGradientId = useId();
  const plotLeft = GRAPH_PAD_LEFT;
  const plotRight = GRAPH_VIEWBOX_WIDTH - GRAPH_PAD_RIGHT;
  const plotTop = GRAPH_PAD_TOP;
  const plotBottom = GRAPH_VIEWBOX_HEIGHT - GRAPH_PAD_BOTTOM;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const trend = useMemo(
    () => panel.trend?.filter((value) => Number.isFinite(value)) ?? [],
    [panel.trend]
  );

  // Single-pass extents plus downsampled marker indexes keep long windows cheap to draw.
  const graph = useMemo(() => {
    if (trend.length < TELEMETRY_MIN_POINTS) return null;
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;
    for (const value of trend) {
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    }
    const range = Math.max(maxValue - minValue, 1);
    const coordinates = trend.map((value, index) => ({
      x: plotLeft + (index / Math.max(trend.length - 1, 1)) * plotWidth,
      y: plotBottom - ((value - minValue) / range) * plotHeight,
      value,
    }));
    return {
      maxValue,
      range,
      coordinates,
      nodeIndices: sampleIndexes(coordinates.length, GRAPH_MAX_POINT_NODES),
      markerIndices: sampleIndexes(coordinates.length, GRAPH_MAX_VERTICAL_MARKERS),
    };
  }, [trend, plotLeft, plotWidth, plotBottom, plotHeight]);

  const hasTrend = graph !== null;
  const coordinates = graph?.coordinates ?? [];
  const maxValue = graph?.maxValue ?? 0;
  const range = graph?.range ?? 1;
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${plotRight.toFixed(1)} ${plotBottom.toFixed(1)} L ${plotLeft.toFixed(1)} ${plotBottom.toFixed(1)} Z`
      : '';
  const firstValue = trend[0] ?? 0;
  const lastValue = trend[trend.length - 1] ?? 0;
  const deltaPct =
    hasTrend && firstValue !== 0 ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100 : 0;
  const deltaDirection = deltaPct > 0.5 ? 'up' : deltaPct < -0.5 ? 'down' : 'flat';
  const deltaTone =
    deltaDirection === 'up'
      ? 'text-accent-green'
      : deltaDirection === 'down'
        ? 'text-accent-red'
        : 'text-[var(--text-muted)]';
  const deltaArrow = deltaDirection === 'up' ? '▲' : deltaDirection === 'down' ? '▼' : '■';
  const gridLines = Array.from(
    { length: GRAPH_GRID_STEPS + 1 },
    (_, index) => index / GRAPH_GRID_STEPS
  );
  const gridTicks = Array.from(
    { length: GRAPH_GRID_STEPS + 1 },
    (_, index) => maxValue - (index / GRAPH_GRID_STEPS) * range
  );
  const latestPoint = coordinates[coordinates.length - 1];
  const nodeIndices = graph?.nodeIndices ?? [];
  const markerIndices = graph?.markerIndices ?? [];

  return (
    <div
      className="mt-auto border-slate-200/70 border-t pt-2.5"
      data-testid={`hero-telemetry-graph-${panel.name}`}
    >
      <div
        className="gold-steel-border gold-steel-border-slim relative overflow-hidden rounded-xl border border-accent-amber/40 bg-white/95 px-3 py-2 shadow-2xs backdrop-blur-md transition-shadow duration-300 hover:shadow-diffusion-sm"
        data-testid={`hero-telemetry-box-${panel.name}`}
      >
        <div className="mb-1 flex items-center justify-between gap-2 pb-0.5">
          <h3 className="truncate font-anurati font-bold text-[var(--text-heading)] text-xs leading-snug tracking-wider sm:text-sm">
            {panel.stats?.label ?? panel.title} Trend
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {panel.stats && (
              <span className="font-bold font-mono text-[11px] text-[var(--text-heading)] tabular-nums">
                {panel.stats.value}
              </span>
            )}
            {hasTrend && (
              <span
                data-testid={`hero-graph-delta-${panel.name}`}
                className={cn(
                  'rounded-full border border-black/[0.06] bg-black/[0.03] px-1.5 py-px font-bold font-mono text-[9.5px] tabular-nums',
                  deltaTone
                )}
                aria-label={`Change over window ${deltaPct >= 0 ? 'up' : 'down'} ${Math.abs(deltaPct).toFixed(1)} percent`}
              >
                {deltaArrow} {Math.abs(deltaPct).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {hasTrend ? (
          <svg
            viewBox={`0 0 ${GRAPH_VIEWBOX_WIDTH} ${GRAPH_VIEWBOX_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-[92px] w-full sm:h-[100px] lg:h-[108px]"
            role="img"
            aria-label={`${panel.stats?.label ?? panel.title} recorded trend, latest ${formatGraphValue(lastValue)}, ${deltaDirection} ${Math.abs(deltaPct).toFixed(1)} percent`}
          >
            <title>{`${panel.stats?.label ?? panel.title} recorded trend, latest ${formatGraphValue(lastValue)}, ${deltaDirection} ${Math.abs(deltaPct).toFixed(1)} percent`}</title>
            <defs>
              <path
                id={nodeSymbolId}
                d={ARCH_GRAPH_NODE_PATH}
                fill="var(--accent-gold)"
                fillRule="evenodd"
              />
              <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            <g
              data-testid="hero-graph-grid"
              stroke="var(--border-default)"
              strokeWidth="1"
              strokeOpacity="0.5"
            >
              {gridLines.map((ratio, index) => {
                const y = plotTop + ratio * plotHeight;
                return (
                  <g key={`grid-${ratio}`}>
                    <line
                      x1={plotLeft}
                      y1={y.toFixed(1)}
                      x2={plotRight}
                      y2={y.toFixed(1)}
                      strokeDasharray={index === GRAPH_GRID_STEPS ? undefined : '2 4'}
                      strokeOpacity={index === GRAPH_GRID_STEPS ? 0.7 : 0.4}
                    />
                    <text
                      x={plotLeft - 6}
                      y={y + 2.5}
                      textAnchor="end"
                      fontSize="7"
                      fill="var(--text-secondary)"
                      stroke="none"
                      className="font-mono tabular-nums"
                    >
                      {formatGraphValue(gridTicks[index] ?? 0)}
                    </text>
                  </g>
                );
              })}
            </g>

            <g
              data-testid="hero-graph-vertical-markers"
              stroke="var(--border-default)"
              strokeWidth="1"
              strokeOpacity="0.6"
            >
              {markerIndices.map((index) => {
                const point = coordinates[index];
                if (!point) return null;
                const isLatest = index === coordinates.length - 1;
                return (
                  <line
                    key={`v-${index}-${point.x.toFixed(1)}`}
                    x1={point.x.toFixed(1)}
                    y1={plotTop}
                    x2={point.x.toFixed(1)}
                    y2={plotBottom}
                    stroke={isLatest ? 'var(--accent-gold)' : undefined}
                    strokeDasharray={isLatest ? undefined : '2 4'}
                    strokeOpacity={isLatest ? 0.9 : 0.55}
                  />
                );
              })}
            </g>

            <g data-testid="hero-graph-y-axis">
              <line
                x1={plotLeft}
                y1={plotTop}
                x2={plotLeft}
                y2={plotBottom}
                stroke="var(--text-secondary)"
                strokeWidth="1.2"
              />
            </g>

            <g data-testid="hero-graph-x-axis">
              <line
                x1={plotLeft}
                y1={plotBottom}
                x2={plotRight}
                y2={plotBottom}
                stroke="var(--text-secondary)"
                strokeWidth="1.2"
              />
              <text
                x={plotLeft}
                y={GRAPH_VIEWBOX_HEIGHT - 8}
                fontSize="7"
                fill="var(--text-secondary)"
                stroke="none"
                className="font-mono"
              >
                START
              </text>
              <text
                x={plotRight}
                y={GRAPH_VIEWBOX_HEIGHT - 8}
                textAnchor="end"
                fontSize="7"
                fill="var(--text-secondary)"
                stroke="none"
                className="font-mono"
              >
                NOW
              </text>
            </g>

            <path d={areaPath} fill={`url(#${areaGradientId})`} data-testid="hero-graph-area" />

            <path
              d={linePath}
              fill="none"
              stroke="var(--accent-gold)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {latestPoint && (
              <text
                x={latestPoint.x - 4}
                y={Math.max(latestPoint.y - 9, 11)}
                textAnchor="end"
                fontSize="8"
                fontWeight="700"
                fill="var(--text-heading)"
                stroke="none"
                className="font-mono tabular-nums"
                data-testid="hero-graph-annotation"
              >
                Now {formatGraphValue(lastValue)}
              </text>
            )}

            {nodeIndices.map((index) => {
              const point = coordinates[index];
              if (!point) return null;
              const isLatest = index === coordinates.length - 1;
              const size = isLatest ? GRAPH_LAST_NODE_SIZE : GRAPH_NODE_SIZE;
              const scale = size / ARCH_GRAPH_NODE_VIEWBOX_SIZE;
              const tx = point.x - size / 2;
              const ty = point.y - size / 2;
              return (
                <g
                  key={`${index}-${point.x.toFixed(1)}`}
                  transform={`translate(${tx.toFixed(1)}, ${ty.toFixed(1)}) scale(${scale.toFixed(4)})`}
                  data-testid="hero-graph-arch-node"
                  className={isLatest ? 'motion-safe:animate-pulse' : undefined}
                >
                  <title>{`${panel.stats?.label ?? panel.title}: ${formatGraphValue(point.value)}`}</title>
                  <use href={`#${nodeSymbolId}`} />
                </g>
              );
            })}
          </svg>
        ) : (
          <p
            className="flex h-[92px] items-center justify-center font-mono text-[10px] text-[var(--text-muted)] sm:h-[100px] lg:h-[108px]"
            data-testid="hero-telemetry-unavailable"
          >
            Trend data unavailable
          </p>
        )}
      </div>
    </div>
  );
});

export interface HeroCardContentProps {
  panel: Panel;
  idx: number;
  isActive: boolean;
  isNext?: boolean;
  failedImages: Set<string>;
  onImageError: (src: string) => void;
  incidentCount: number;
  breakdownCount: number;
  offlineMachineCount: number;
}

const HERO_CTA_BASE_CLASS = cn(
  'gold-steel-border gold-steel-border-slim inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs',
  'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-diffusion-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-1',
  'active:translate-y-0 active:scale-95'
);

const HERO_LEFT_COLUMN_CLASS = cn(
  'liquid-glass-light relative z-20 order-2 flex min-h-0 w-full flex-1 flex-col justify-between gap-2.5',
  'rounded-b-2xl border border-white/20 p-4 shadow-window sm:p-5',
  'md:order-1 md:h-full md:w-[45%] md:rounded-r-none md:rounded-l-2xl lg:w-[42%] lg:p-6'
);

const HERO_MEDIA_COLUMN_CLASS = cn(
  'group/img relative z-10 order-1 aspect-video max-h-[210px] w-full shrink-0 overflow-hidden rounded-t-2xl',
  'sm:max-h-[235px] md:order-2 md:aspect-auto md:h-full md:max-h-none md:w-[55%]',
  'md:rounded-t-none md:rounded-r-2xl lg:w-[58%]'
);

export const HeroCardContent = memo(function HeroCardContent({
  panel,
  idx,
  isActive,
  isNext = false,
  failedImages,
  onImageError,
  incidentCount,
  breakdownCount,
  offlineMachineCount,
}: HeroCardContentProps) {
  const hasUrgentTelemetry = incidentCount > 0 || breakdownCount > 0 || offlineMachineCount > 0;
  const isViewLogs = panel.primary.label.toLowerCase().includes('log');
  const primaryBtnClass = isViewLogs
    ? 'border-amber-500/30 bg-amber-400 font-semibold text-stone-950 shadow-xs hover:bg-amber-300'
    : 'border-black/[0.08] bg-[var(--accent-gold)] font-semibold text-stone-950 shadow-xs hover:bg-[var(--accent-gold-hover)]';

  return (
    <div className="relative z-10 flex h-full w-full flex-col md:flex-row">
      <div className={HERO_LEFT_COLUMN_CLASS}>
        <div>
          {hasUrgentTelemetry && (
            <div
              role="status"
              aria-label="Operational alerts"
              className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[11px] tabular-nums"
            >
              {incidentCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-accent-red/20 bg-accent-red/10 px-2 py-0.5 font-semibold text-accent-red">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {incidentCount} Open
                </span>
              )}
              {breakdownCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-accent-amber/30 bg-accent-amber/15 px-2 py-0.5 font-semibold text-amber-900">
                  <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {breakdownCount} Breakdown
                </span>
              )}
              {offlineMachineCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-black/[0.04] px-2 py-0.5 font-semibold text-[var(--text-secondary)]">
                  <Power className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {offlineMachineCount} Offline
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <ArchLogoBadge
                size="sm"
                testId={`hero-dept-icon-${panel.name}`}
                className="border-accent-gold/40 bg-accent-gold/10 shadow-2xs"
              />
              <h2 className="pr-4 font-anurati font-bold text-[var(--text-heading)] text-lg leading-tight tracking-[0.04em] sm:text-xl lg:text-2xl">
                {panel.title}
              </h2>
            </div>
            <div className="relative space-y-2">
              <p
                className="line-clamp-2 min-h-[2.5rem] max-w-[95%] font-medium text-[var(--text-body)] text-xs leading-relaxed tracking-[0.01em] sm:text-sm"
                data-testid={`hero-subtitle-${panel.name}`}
              >
                {panel.description}
              </p>
              <SystemGoldenSeparator
                testId={`hero-header-separator-${panel.name}`}
                className="relative z-10"
              />
            </div>
          </div>

          <div
            className={cn(
              'mt-4 flex flex-wrap items-center gap-2',
              !isActive && 'pointer-events-none opacity-60'
            )}
          >
            <Link
              href={panel.primary.href}
              data-cta="primary-hero"
              className={cn(HERO_CTA_BASE_CLASS, primaryBtnClass)}
              tabIndex={isActive ? 0 : -1}
              aria-disabled={!isActive || undefined}
            >
              {panel.primary.icon}
              {panel.primary.label}
            </Link>
            {panel.secondary && (
              <Link
                href={panel.secondary.href}
                data-cta="secondary-hero"
                className={cn(
                  HERO_CTA_BASE_CLASS,
                  'border-black/10 bg-white/80 font-medium text-[var(--text-heading)] hover:border-accent-gold/45 hover:bg-white'
                )}
                tabIndex={isActive ? 0 : -1}
                aria-disabled={!isActive || undefined}
              >
                {panel.secondary.icon}
                {panel.secondary.label}
              </Link>
            )}
          </div>
        </div>

        <HeroTelemetryGraph panel={panel} />
      </div>

      <div className={HERO_MEDIA_COLUMN_CLASS}>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-16 bg-gradient-to-r from-white/20 to-transparent md:block" />
        {(() => {
          const posterSrc = failedImages.has(panel.image)
            ? '/images/departments/overview.webp'
            : panel.image || '/images/departments/overview.webp';
          const rawVideoSrc =
            panel.video ||
            (panel.image
              ? panel.image.replace(/\.(jpg|jpeg|png|webp)$/i, '.mp4')
              : '/images/departments/overview.mp4');
          const resolvedVideoSrc = failedImages.has(rawVideoSrc)
            ? '/images/departments/overview.mp4'
            : rawVideoSrc;

          return (
            <>
              {isActive && <link rel="preload" as="image" href={posterSrc} fetchPriority="high" />}
              {!isActive && isNext && (
                <link rel="preload" as="image" href={posterSrc} fetchPriority="low" />
              )}
              {isActive ? (
                <video
                  key={resolvedVideoSrc}
                  src={resolvedVideoSrc}
                  poster={posterSrc}
                  aria-label={`${panel.title} visual`}
                  data-testid={`hero-video-${panel.name}`}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover/img:scale-105"
                  onError={() => {
                    if (!failedImages.has(rawVideoSrc)) {
                      onImageError(rawVideoSrc);
                    }
                  }}
                />
              ) : (
                <img
                  src={posterSrc}
                  alt={`${panel.title} visual`}
                  data-testid={`hero-poster-${panel.name}`}
                  width={640}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  fetchPriority={isNext ? 'low' : 'auto'}
                  className="h-full w-full object-cover object-center"
                  onError={() => {
                    if (panel.image && !failedImages.has(panel.image)) {
                      onImageError(panel.image);
                    }
                  }}
                />
              )}
            </>
          );
        })()}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 z-20 rounded-xl border border-white/20 ring-1 ring-white/10 ring-inset"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1/3 -translate-x-[220%] skew-x-[-12deg] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover/img:translate-x-[360%]"
        />

        {isActive && (
          <div className="pointer-events-none absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-[10px] text-white shadow-sm backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-bold tracking-wider">LIVE FEED</span>
          </div>
        )}

        <div className="pointer-events-none absolute top-4 right-4 z-20 flex flex-col items-end gap-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-xs shadow-sm backdrop-blur-md">
            <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="font-medium font-mono text-[10px] text-white/70 uppercase tracking-wider">
              {panel.stats?.label ?? 'Metric'}:
            </span>
            <span className="font-bold font-mono text-white tabular-nums">
              {panel.stats?.value ?? 'Unavailable'}
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute right-4 bottom-4 z-20 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-black/60 px-2.5 py-1 font-mono font-semibold text-[10px] text-white/95 shadow-sm backdrop-blur-md">
            {panel.name.toUpperCase()}
          </span>
          <span className="rounded border border-white/10 bg-black/50 px-1.5 py-0.5 font-mono text-[9px] text-white/70 tabular-nums backdrop-blur-sm">
            SLIDE {String(idx + 1).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
});
