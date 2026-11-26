'use client';

import { Activity, AlertTriangle, Power, Wrench } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../lib/utils';
import type { Panel } from './hero-types';
import { ARCH_LOGO_VIEWBOX, Logo } from './Logo';

const TELEMETRY_MIN_POINTS = 2;
const GRAPH_VIEWBOX_WIDTH = 420;
const GRAPH_VIEWBOX_HEIGHT = 104;
const GRAPH_PAD_LEFT = 46;
const GRAPH_PAD_RIGHT = 14;
const GRAPH_PAD_TOP = 12;
const GRAPH_PAD_BOTTOM = 24;
const GRAPH_NODE_SIZE = 8;
const GRAPH_LAST_NODE_SIZE = 11;

export function SystemGoldenSeparator({
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
          <path d="M86.31 0 55.25 31.05 0 86.31l55.25 55.25L86.31 172.61l31.05-31.05L172.61 86.31 117.36 31.05 86.31 0Zm0 31.05 25.19 25.2-25.19 25.19L61.12 56.25 86.31 31.05ZM31.05 86.31l25.2-25.19 25.19 25.19-25.19 25.2-25.2-25.2Zm55.26 55.26-25.19-25.2 25.19-25.19 25.19 25.19-25.19 25.2Z" />
        </svg>
      </span>
      <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] border border-accent-gold/80 bg-accent-gold/35" />
      <span className="h-[1.5px] flex-1 rounded-full bg-gradient-to-l from-transparent via-accent-gold/55 to-accent-gold motion-safe:animate-pulse" />
    </div>
  );
}

function HeroTelemetryGraph({ panel }: { panel: Panel }) {
  const trend = panel.trend?.filter((value) => Number.isFinite(value)) ?? [];
  const hasTrend = trend.length >= TELEMETRY_MIN_POINTS;
  const plotLeft = GRAPH_PAD_LEFT;
  const plotRight = GRAPH_VIEWBOX_WIDTH - GRAPH_PAD_RIGHT;
  const plotTop = GRAPH_PAD_TOP;
  const plotBottom = GRAPH_VIEWBOX_HEIGHT - GRAPH_PAD_BOTTOM;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const minValue = hasTrend ? Math.min(...trend) : 0;
  const maxValue = hasTrend ? Math.max(...trend) : 0;
  const range = Math.max(maxValue - minValue, 1);
  const coordinates = hasTrend
    ? trend.map((value, index) => ({
        x: plotLeft + (index / Math.max(trend.length - 1, 1)) * plotWidth,
        y: plotBottom - ((value - minValue) / range) * plotHeight,
        value,
      }))
    : [];
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');

  return (
    <div
      className="mt-auto border-slate-200/70 border-t pt-2.5"
      data-testid={`hero-telemetry-graph-${panel.name}`}
    >
      <div
        className="gold-steel-border gold-steel-border-slim relative rounded-xl border border-accent-amber/40 bg-white/95 px-3 py-2 shadow-2xs backdrop-blur-md"
        data-testid={`hero-telemetry-box-${panel.name}`}
      >
        <div className="mb-1 flex items-center justify-between gap-2 pb-0.5">
          <h3 className="truncate font-anurati font-bold text-[var(--text-heading)] text-xs leading-snug tracking-wider sm:text-sm">
            {panel.stats?.label ?? panel.title} Trend
          </h3>
          {panel.stats && (
            <span className="font-bold font-mono text-[11px] text-[var(--text-heading)] tabular-nums">
              {panel.stats.value}
            </span>
          )}
        </div>

        {hasTrend ? (
          <svg
            viewBox={`0 0 ${GRAPH_VIEWBOX_WIDTH} ${GRAPH_VIEWBOX_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-[84px] w-full sm:h-[92px] lg:h-[100px]"
            role="img"
            aria-label={`${panel.stats?.label ?? panel.title} recorded trend`}
          >
            <g data-testid="hero-graph-y-axis">
              <line
                x1={plotLeft}
                y1={plotTop}
                x2={plotLeft}
                y2={plotBottom}
                stroke="var(--text-muted)"
                strokeWidth="1"
              />
            </g>

            <g data-testid="hero-graph-x-axis">
              <line
                x1={plotLeft}
                y1={plotBottom}
                x2={plotRight}
                y2={plotBottom}
                stroke="var(--text-muted)"
                strokeWidth="1"
              />
            </g>

            <path
              d={linePath}
              fill="none"
              stroke="var(--accent-gold)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {coordinates.map((point, index) => {
              const size =
                index === coordinates.length - 1 ? GRAPH_LAST_NODE_SIZE : GRAPH_NODE_SIZE;
              return (
                <svg
                  key={`${point.x}-${point.y}`}
                  x={point.x - size / 2}
                  y={point.y - size / 2}
                  width={size}
                  height={size}
                  viewBox={ARCH_LOGO_VIEWBOX}
                  aria-hidden="true"
                  data-testid="hero-graph-arch-node"
                >
                  <path
                    d="M86.31 0 55.25 31.05 0 86.31l55.25 55.25L86.31 172.61l31.05-31.05L172.61 86.31 117.36 31.05 86.31 0Zm0 31.05 25.19 25.2-25.19 25.19L61.12 56.25 86.31 31.05ZM31.05 86.31l25.2-25.19 25.19 25.19-25.19 25.2-25.2-25.2Zm55.26 55.26-25.19-25.2 25.19-25.19 25.19 25.19-25.19 25.2Z"
                    fill="var(--accent-gold)"
                    fillRule="evenodd"
                  />
                </svg>
              );
            })}
          </svg>
        ) : (
          <p
            className="flex h-[84px] items-center justify-center font-mono text-[10px] text-[var(--text-muted)] sm:h-[92px] lg:h-[100px]"
            data-testid="hero-telemetry-unavailable"
          >
            Trend data unavailable
          </p>
        )}
      </div>
    </div>
  );
}

export interface HeroCardContentProps {
  panel: Panel;
  idx: number;
  isActive: boolean;
  failedImages: Set<string>;
  onImageError: (src: string) => void;
  incidentCount: number;
  breakdownCount: number;
  offlineMachineCount: number;
}

const HERO_LEFT_COLUMN_CLASS = cn(
  'liquid-glass-light relative z-20 order-2 flex min-h-0 w-full flex-1 flex-col justify-between gap-2.5',
  'rounded-b-2xl border border-white/20 p-4 shadow-window sm:p-5',
  'md:order-1 md:h-full md:w-[48%] md:rounded-r-none md:rounded-l-2xl lg:w-[46%] lg:p-6'
);

const HERO_MEDIA_COLUMN_CLASS = cn(
  'group/img relative z-10 order-1 aspect-video max-h-[210px] w-full shrink-0 overflow-hidden rounded-t-2xl',
  'sm:max-h-[235px] md:order-2 md:aspect-auto md:h-full md:max-h-none md:w-[52%]',
  'md:rounded-t-none md:rounded-r-2xl lg:w-[54%]'
);

export function HeroCardContent({
  panel,
  idx,
  isActive,
  failedImages,
  onImageError,
  incidentCount,
  breakdownCount,
  offlineMachineCount,
}: HeroCardContentProps) {
  const hasUrgentTelemetry = incidentCount > 0 || breakdownCount > 0 || offlineMachineCount > 0;
  const isViewLogs = panel.primary.label.toLowerCase().includes('log');
  const primaryBtnClass = isViewLogs
    ? 'bg-amber-400 text-stone-950 hover:bg-amber-300 font-semibold shadow-xs'
    : 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 font-medium shadow-xs';

  return (
    <div className="relative z-10 flex h-full w-full flex-col md:flex-row">
      <div className={HERO_LEFT_COLUMN_CLASS}>
        <div>
          {hasUrgentTelemetry && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[10px] tabular-nums">
              {incidentCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent-red/10 px-2 py-0.5 font-medium text-accent-red">
                  <AlertTriangle className="h-3 w-3" />
                  {incidentCount} Open
                </span>
              )}
              {breakdownCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent-amber/10 px-2 py-0.5 font-medium text-accent-amber">
                  <Wrench className="h-3 w-3" />
                  {breakdownCount} Breakdown
                </span>
              )}
              {offlineMachineCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.04] px-2 py-0.5 font-medium text-[var(--text-secondary)]">
                  <Power className="h-3 w-3" />
                  {offlineMachineCount} Offline
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className="gold-steel-border gold-steel-border-slim inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-gold/40 bg-accent-gold/10 text-accent-gold shadow-2xs"
                aria-hidden="true"
                data-testid={`hero-dept-icon-${panel.name}`}
              >
                <Logo variant="gold" className="h-4 w-4 text-accent-gold" />
              </span>
              <h2 className="pr-4 font-anurati font-bold text-[var(--text-heading)] text-xl leading-snug tracking-[0.04em] sm:text-2xl">
                {panel.title}
              </h2>
            </div>
            <div className="relative space-y-2">
              <p
                className="line-clamp-2 min-h-[2.5rem] max-w-[95%] font-medium text-slate-800 text-xs leading-relaxed tracking-[0.01em] sm:text-sm"
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
              className={cn(
                'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3.5 py-1.5 text-xs transition-all duration-300 active:scale-95',
                primaryBtnClass
              )}
              tabIndex={isActive ? 0 : -1}
            >
              {panel.primary.icon}
              {panel.primary.label}
            </Link>
            {panel.secondary && (
              <Link
                href={panel.secondary.href}
                data-cta="secondary-hero"
                className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-black/[0.04] px-3.5 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-all duration-300 hover:bg-black/[0.08] active:scale-95"
                tabIndex={isActive ? 0 : -1}
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
              <video
                key={resolvedVideoSrc}
                src={resolvedVideoSrc}
                poster={posterSrc}
                aria-label={`${panel.title} visual`}
                data-testid={`hero-video-${panel.name}`}
                autoPlay={isActive}
                loop
                muted
                playsInline
                preload={isActive ? 'metadata' : 'none'}
                className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover/img:scale-105"
                onError={() => {
                  if (!failedImages.has(rawVideoSrc)) {
                    onImageError(rawVideoSrc);
                  }
                }}
              />
            </>
          );
        })()}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {isActive && (
          <div className="pointer-events-none absolute top-4 left-4 z-20 inline-flex items-center rounded-full border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-[10px] text-white shadow-sm backdrop-blur-md">
            <span className="font-bold tracking-wider">DEPARTMENT VISUAL</span>
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
}
