'use client';

import { cn } from '../lib/utils';
import { GlassCard } from './GlassCard';

export type GoldenSignalAlertState = 'NORMAL' | 'PENDING' | 'FIRING' | 'RESOLVED';

export interface GoldenSignalPanelProps {
  title: string;
  subtitle?: string;
  primaryValue: string;
  unit?: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  alertState?: GoldenSignalAlertState;
  thresholdLabel?: string;
  seriesValues?: readonly number[];
  className?: string;
}

const MIN_SPARKLINE_HEIGHT_PCT = 12;
const MAX_SPARKLINE_HEIGHT_PCT = 100;
const PERCENT_SCALE = 100;

const ALERT_BADGE_CLASSES: Record<GoldenSignalAlertState, string> = {
  NORMAL: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  PENDING: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  FIRING: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
  RESOLVED: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
};

const SPARKLINE_BAR_CLASSES: Record<GoldenSignalAlertState, string> = {
  NORMAL: 'bg-emerald-500/75',
  PENDING: 'bg-amber-500/80',
  FIRING: 'bg-rose-500/85',
  RESOLVED: 'bg-sky-500/75',
};

interface SparklineBarPoint {
  barKey: string;
  heightPct: number;
  rawReading: number;
}

function computeSparklineBars(seriesValues: readonly number[]): readonly SparklineBarPoint[] {
  if (seriesValues.length === 0) {
    return [];
  }

  const peakReading = Math.max(...seriesValues, 1);

  return seriesValues.map((reading, sampleIndex) => {
    const normalizedRatio = Math.max(0, reading) / peakReading;
    const scaledHeightPct = Math.round(normalizedRatio * PERCENT_SCALE);
    const clampedHeightPct = Math.min(
      MAX_SPARKLINE_HEIGHT_PCT,
      Math.max(MIN_SPARKLINE_HEIGHT_PCT, scaledHeightPct)
    );

    return {
      barKey: `sample-${sampleIndex}-${reading}`,
      heightPct: clampedHeightPct,
      rawReading: reading,
    };
  });
}

export function GoldenSignalPanel({
  title,
  subtitle,
  primaryValue,
  unit,
  secondaryLabel,
  secondaryValue,
  alertState = 'NORMAL',
  thresholdLabel,
  seriesValues,
  className,
}: Readonly<GoldenSignalPanelProps>) {
  const sparklineBars = seriesValues ? computeSparklineBars(seriesValues) : [];
  const hasSecondaryMetric = Boolean(secondaryLabel && secondaryValue);

  return (
    <GlassCard
      variant="default"
      padding={false}
      data-testid="golden-signal-panel"
      className={cn('flex flex-col justify-between gap-3 p-4', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-zinc-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 font-mono font-semibold text-xs',
            ALERT_BADGE_CLASSES[alertState]
          )}
        >
          {alertState}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-bold font-mono text-2xl text-zinc-900 tracking-tight">
          {primaryValue}
        </span>
        {unit && <span className="font-mono text-xs text-zinc-500">{unit}</span>}
      </div>

      {(hasSecondaryMetric || thresholdLabel) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-zinc-200/70 border-t pt-2 text-xs text-zinc-600">
          {hasSecondaryMetric && (
            <span>
              {secondaryLabel}:{' '}
              <strong className="font-mono text-zinc-800">{secondaryValue}</strong>
            </span>
          )}
          {thresholdLabel && <span className="font-mono text-zinc-500">{thresholdLabel}</span>}
        </div>
      )}

      {sparklineBars.length > 0 && (
        <div
          className="flex h-10 items-end gap-1 pt-1"
          role="img"
          aria-label={`${title} trend sparkline`}
        >
          {sparklineBars.map((barPoint) => (
            <span
              key={barPoint.barKey}
              title={`${barPoint.rawReading}${unit ? ` ${unit}` : ''}`}
              style={{ height: `${barPoint.heightPct}%` }}
              className={cn('flex-1 rounded-xs transition-all', SPARKLINE_BAR_CLASSES[alertState])}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}
