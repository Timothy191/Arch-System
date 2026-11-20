import { GlassCard } from '@repo/ui/GlassCard';
import { Gauge } from 'lucide-react';
import { EM_DASH, formatNumber } from './executive-format';
import type { GaugeSpec, GaugeTone } from './executive-gauges';

const ARC_PATH = 'M 12 64 A 52 52 0 0 1 116 64';
const VIEW_BOX = '0 0 128 72';
const ARC_STROKE_WIDTH = 10;
const ARC_PATH_LENGTH = 100;

const TONE_STROKE: Readonly<Record<GaugeTone, string>> = {
  good: 'var(--accent-green)',
  warn: 'var(--accent-amber)',
  bad: 'var(--accent-red)',
  neutral: 'var(--accent-blue)',
};

function clampFraction(spec: GaugeSpec, reading: number): number {
  const span = spec.max - spec.min;
  const fraction = span > 0 ? (reading - spec.min) / span : 0;
  return Math.min(Math.max(fraction, 0), 1);
}

function meterAttributes(spec: GaugeSpec, display: string) {
  if (spec.value === null) return { role: 'img' as const };
  return {
    role: 'meter' as const,
    'aria-valuenow': spec.value,
    'aria-valuemin': spec.min,
    'aria-valuemax': spec.max,
    'aria-valuetext': display,
  };
}

/** Semicircle SVG gauge (server-renderable, no chart library). */
export function ExecutiveGauge({ spec }: { spec: GaugeSpec }) {
  const reading = spec.value;
  const display =
    reading === null ? EM_DASH : `${formatNumber(reading, spec.decimals)}${spec.unit}`;
  const dash = reading === null ? 0 : clampFraction(spec, reading) * ARC_PATH_LENGTH;
  return (
    <div
      {...meterAttributes(spec, display)}
      aria-label={`${spec.label}: ${display}. ${spec.caption}`}
      data-tone={spec.tone}
      className="flex flex-col items-center text-center"
    >
      <svg viewBox={VIEW_BOX} aria-hidden="true" className="h-auto w-full max-w-40">
        <path
          d={ARC_PATH}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={ARC_STROKE_WIDTH}
          strokeLinecap="round"
        />
        {reading === null ? null : (
          <path
            d={ARC_PATH}
            fill="none"
            stroke={TONE_STROKE[spec.tone]}
            strokeWidth={ARC_STROKE_WIDTH}
            strokeLinecap="round"
            pathLength={ARC_PATH_LENGTH}
            strokeDasharray={`${dash} ${ARC_PATH_LENGTH}`}
          />
        )}
      </svg>
      <p className="-mt-7 font-semibold text-[var(--text-heading)] text-xl tabular-nums">
        {display}
      </p>
      <p className="mt-2 font-medium text-[var(--text-body)] text-sm">{spec.label}</p>
      <p className="text-[var(--text-muted)] text-xs">{spec.caption}</p>
    </div>
  );
}

export function ExecutiveGaugePanel({ specs }: { specs: readonly GaugeSpec[] }) {
  return (
    <section aria-labelledby="executive-gauges-heading" className="space-y-3">
      <h2
        id="executive-gauges-heading"
        className="flex items-center gap-1.5 font-semibold text-[var(--text-muted)] text-xs"
      >
        <Gauge className="h-3.5 w-3.5" /> Operational Health Gauges
      </h2>
      <GlassCard>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-5">
          {specs.map((spec) => (
            <ExecutiveGauge key={spec.id} spec={spec} />
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
