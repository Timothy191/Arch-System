'use client';

import { ARCH_LOGO_PATH, ARCH_LOGO_VIEWBOX } from '@repo/ui/Logo';
import { TrendingUp } from 'lucide-react';

export interface SparklinePointOptions {
  readonly isInverted?: boolean;
  readonly hasSineWave?: boolean;
}

const SPARKLINE_POINTS_COUNT = 8;
const SPARKLINE_LAST_IDX = 7;
const DEFAULT_MIN_CLAMP = 25;
const DEFAULT_MAX_CLAMP = 98;
const WAVE_MIN_CLAMP = 10;
const WAVE_MAX_CLAMP = 100;
const INVERTED_MAX_START = 92;
const DEFAULT_INVERT_OFFSET = 22;
const DEFAULT_NORMAL_OFFSET = 28;
const WAVE_INVERT_OFFSET = 18;
const WAVE_NORMAL_OFFSET = 24;
const WAVE_MIN_START = 15;
const SINE_AMPLITUDE = 6;

const DEFAULT_STROKE_COLOR = '#d4af37';
const SUMMARY_CHART_WIDTH = 260;
const SUMMARY_CHART_HEIGHT = 56;
const KPI_CHART_WIDTH = 240;
const KPI_CHART_HEIGHT = 48;
const CHART_PAD_X = 6;
const SUMMARY_PAD_Y = 7;
const KPI_PAD_Y = 6;
const MIN_VAL_OFFSET = 6;
const MAX_VAL_OFFSET = 4;
const MIN_BAR_HEIGHT = 4;
const BAR_HALF_WIDTH = 3.5;
const BAR_WIDTH = 7;
const BAR_RADIUS = 1.5;
const LAST_BAR_OPACITY = 0.26;
const DEFAULT_BAR_OPACITY = 0.1;
const SUMMARY_UPPER_LINE_RATIO = 0.28;
const SUMMARY_LOWER_LINE_RATIO = 0.65;
const KPI_UPPER_LINE_RATIO = 0.35;
const KPI_LOWER_LINE_RATIO = 0.72;
const SUMMARY_LAST_ICON_SIZE = 10;
const SUMMARY_NODE_ICON_SIZE = 7;
const KPI_LAST_ICON_SIZE = 9;
const KPI_NODE_ICON_SIZE = 6;
const NODE_DEFAULT_OPACITY = 0.9;

export function buildSparklinePoints(
  targetValue: number,
  options?: SparklinePointOptions
): number[] {
  const isInverted = options?.isInverted ?? false;
  const hasSineWave = options?.hasSineWave ?? false;

  const minClamp = hasSineWave ? WAVE_MIN_CLAMP : DEFAULT_MIN_CLAMP;
  const maxClamp = hasSineWave ? WAVE_MAX_CLAMP : DEFAULT_MAX_CLAMP;
  const clamped = Math.max(minClamp, Math.min(maxClamp, Math.round(targetValue)));

  const invertOffset = hasSineWave ? WAVE_INVERT_OFFSET : DEFAULT_INVERT_OFFSET;
  const normalOffset = hasSineWave ? WAVE_NORMAL_OFFSET : DEFAULT_NORMAL_OFFSET;
  const normalFloor = hasSineWave ? WAVE_MIN_START : DEFAULT_MIN_CLAMP;

  const start = isInverted
    ? Math.min(INVERTED_MAX_START, clamped + invertOffset)
    : Math.max(normalFloor, clamped - normalOffset);

  return Array.from({ length: SPARKLINE_POINTS_COUNT }, (_, idx) => {
    const progress = idx / SPARKLINE_LAST_IDX;
    const wave =
      hasSineWave && idx > 0 && idx < SPARKLINE_LAST_IDX
        ? Math.sin(progress * Math.PI) * SINE_AMPLITUDE
        : 0;
    return Math.round(start + (clamped - start) * progress + wave);
  });
}

export type GoldenSparklineVariant = 'summary' | 'excavator' | 'kpi';

export interface GoldenTelemetrySparklineProps {
  readonly id: string;
  readonly points: readonly number[];
  readonly avgValue: string;
  readonly peakValue: string;
  readonly currentValue: string;
  readonly title?: string;
  readonly badgeLabel?: string;
  readonly strokeColor?: string;
  readonly variant?: GoldenSparklineVariant;
}

interface VariantStyleConfig {
  readonly gradPrefix: string;
  readonly outerTestIdPrefix: string;
  readonly boxTestIdPrefix?: string;
  readonly nodeTestId?: string;
  readonly peakLabel: string;
  readonly hasBars: boolean;
  readonly width: number;
  readonly height: number;
  readonly padY: number;
  readonly upperRatio: number;
  readonly lowerRatio: number;
  readonly lastIconSize: number;
  readonly nodeIconSize: number;
}

const VARIANT_CONFIG_MAP: Record<GoldenSparklineVariant, VariantStyleConfig> = {
  summary: {
    gradPrefix: 'cr-gold-grad',
    outerTestIdPrefix: 'summary-golden-graph',
    boxTestIdPrefix: 'summary-golden-box',
    nodeTestId: 'summary-graph-arch-node',
    peakLabel: 'PEAK',
    hasBars: true,
    width: SUMMARY_CHART_WIDTH,
    height: SUMMARY_CHART_HEIGHT,
    padY: SUMMARY_PAD_Y,
    upperRatio: SUMMARY_UPPER_LINE_RATIO,
    lowerRatio: SUMMARY_LOWER_LINE_RATIO,
    lastIconSize: SUMMARY_LAST_ICON_SIZE,
    nodeIconSize: SUMMARY_NODE_ICON_SIZE,
  },
  excavator: {
    gradPrefix: 'exc-gold-grad',
    outerTestIdPrefix: 'excavator-golden-graph',
    boxTestIdPrefix: 'excavator-golden-box',
    nodeTestId: 'excavator-graph-arch-node',
    peakLabel: 'TARGET',
    hasBars: true,
    width: SUMMARY_CHART_WIDTH,
    height: SUMMARY_CHART_HEIGHT,
    padY: SUMMARY_PAD_Y,
    upperRatio: SUMMARY_UPPER_LINE_RATIO,
    lowerRatio: SUMMARY_LOWER_LINE_RATIO,
    lastIconSize: SUMMARY_LAST_ICON_SIZE,
    nodeIconSize: SUMMARY_NODE_ICON_SIZE,
  },
  kpi: {
    gradPrefix: 'kpi-grad',
    outerTestIdPrefix: 'kpi-sparkline',
    peakLabel: 'PEAK',
    hasBars: false,
    width: KPI_CHART_WIDTH,
    height: KPI_CHART_HEIGHT,
    padY: KPI_PAD_Y,
    upperRatio: KPI_UPPER_LINE_RATIO,
    lowerRatio: KPI_LOWER_LINE_RATIO,
    lastIconSize: KPI_LAST_ICON_SIZE,
    nodeIconSize: KPI_NODE_ICON_SIZE,
  },
};

export function GoldenTelemetrySparkline({
  id,
  points,
  avgValue,
  peakValue,
  currentValue,
  title,
  badgeLabel,
  strokeColor = DEFAULT_STROKE_COLOR,
  variant = 'summary',
}: GoldenTelemetrySparklineProps) {
  const cfg = VARIANT_CONFIG_MAP[variant];
  const fillId = `${cfg.gradPrefix}-${id}`;
  const minVal = Math.min(...points) - MIN_VAL_OFFSET;
  const maxVal = Math.max(...points) + MAX_VAL_OFFSET;
  const range = Math.max(maxVal - minVal, 1);

  const coords = points.map((pt, idx) => {
    const x = CHART_PAD_X + (idx / Math.max(points.length - 1, 1)) * (cfg.width - CHART_PAD_X * 2);
    const y = cfg.height - cfg.padY - ((pt - minVal) / range) * (cfg.height - cfg.padY * 2);
    return { x, y };
  });

  const linePath = coords
    .map((coord, idx) => `${idx === 0 ? 'M' : 'L'} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(' ');
  const firstX = (coords[0]?.x ?? CHART_PAD_X).toFixed(1);
  const lastX = (coords[coords.length - 1]?.x ?? cfg.width - CHART_PAD_X).toFixed(1);
  const areaPath = `${linePath} L ${lastX} ${cfg.height} L ${firstX} ${cfg.height} Z`;

  return (
    <div
      className={variant === 'kpi' ? 'mt-2.5' : 'mt-auto pt-2'}
      data-testid={`${cfg.outerTestIdPrefix}-${id}`}
    >
      {title && badgeLabel && (
        <div className="mb-1.5 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green"
              aria-hidden="true"
            />
            <span
              className={
                variant === 'excavator'
                  ? 'truncate font-bold text-[10px] text-[var(--text-heading)] uppercase tracking-wider'
                  : 'truncate font-semibold text-[13px] text-[var(--text-heading)] leading-[18px]'
              }
            >
              {title}
            </span>
          </div>
          <span
            className={
              variant === 'excavator'
                ? 'inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-[var(--text-heading)]'
                : 'inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 px-2 py-0.5 font-mono font-semibold text-[13px] text-[var(--text-heading)] leading-[18px]'
            }
          >
            <TrendingUp className="h-3 w-3 text-[var(--accent-blue)]" aria-hidden="true" />
            {badgeLabel}
          </span>
        </div>
      )}

      <div
        className="gold-steel-border gold-steel-border-slim relative overflow-hidden rounded-xl border border-accent-amber/40 bg-white/90 px-2.5 py-1.5 shadow-2xs"
        data-testid={cfg.boxTestIdPrefix ? `${cfg.boxTestIdPrefix}-${id}` : undefined}
      >
        <svg
          viewBox={`0 0 ${cfg.width} ${cfg.height}`}
          className={
            variant === 'kpi'
              ? 'relative z-10 h-10 w-full overflow-visible'
              : 'relative z-10 h-12 w-full overflow-visible'
          }
          role="img"
          aria-label={title ? `${title} golden telemetry trend graph` : `${id} telemetry sparkline`}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.34" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.03" />
            </linearGradient>
            <filter id={`glow-${fillId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <symbol id={`arch-node-${fillId}`} viewBox={ARCH_LOGO_VIEWBOX}>
              <path
                d={ARCH_LOGO_PATH}
                fill={strokeColor}
                stroke="#ffffff"
                strokeWidth="6"
                paintOrder="stroke"
                fillRule="evenodd"
              />
            </symbol>
          </defs>

          <line
            x1={CHART_PAD_X}
            y1={cfg.height * cfg.upperRatio}
            x2={cfg.width - CHART_PAD_X}
            y2={cfg.height * cfg.upperRatio}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="3 3"
            strokeWidth="0.75"
          />
          <line
            x1={CHART_PAD_X}
            y1={cfg.height * cfg.lowerRatio}
            x2={cfg.width - CHART_PAD_X}
            y2={cfg.height * cfg.lowerRatio}
            stroke="currentColor"
            className="text-slate-200/80"
            strokeDasharray="3 3"
            strokeWidth="0.75"
          />

          {cfg.hasBars &&
            coords.map((coord, idx) => {
              const barHeight = Math.max(cfg.height - cfg.padY - coord.y, MIN_BAR_HEIGHT);
              return (
                <rect
                  key={`bar-${coord.x.toFixed(1)}`}
                  x={coord.x - BAR_HALF_WIDTH}
                  y={coord.y}
                  width={BAR_WIDTH}
                  height={barHeight}
                  rx={BAR_RADIUS}
                  fill={strokeColor}
                  fillOpacity={idx === coords.length - 1 ? LAST_BAR_OPACITY : DEFAULT_BAR_OPACITY}
                />
              );
            })}

          <path d={areaPath} fill={`url(#${fillId})`} />

          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#glow-${fillId})`}
          />

          {coords.map((coord, idx) => {
            const isLast = idx === coords.length - 1;
            const iconSize = isLast ? cfg.lastIconSize : cfg.nodeIconSize;
            return (
              <svg
                key={`node-${coord.x.toFixed(1)}`}
                x={coord.x - iconSize / 2}
                y={coord.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                viewBox={ARCH_LOGO_VIEWBOX}
                aria-hidden="true"
                data-testid={cfg.nodeTestId}
              >
                <use href={`#arch-node-${fillId}`} opacity={isLast ? 1 : NODE_DEFAULT_OPACITY} />
              </svg>
            );
          })}
        </svg>

        <div className="relative z-10 flex items-center justify-between border-slate-100 border-t pt-1 font-mono text-[13px] text-[var(--text-secondary)] tabular-nums leading-[18px]">
          <span>AVG {avgValue}</span>
          <span>
            {cfg.peakLabel} {peakValue}
          </span>
          <span className="font-bold text-[var(--accent-blue)]">{currentValue}</span>
        </div>
      </div>
    </div>
  );
}
