'use client';

import { cn } from '../lib/utils';
import { GlassCard } from './GlassCard';

export type UptimeTickStatus = 'UP' | 'DEGRADED' | 'DOWN';

export interface UptimeTickItem {
  status: UptimeTickStatus;
  latencyMs: number;
  checkedAt: string;
}

export interface UptimeHeartbeatStripProps {
  label: string;
  currentStatus: UptimeTickStatus;
  slaPct: number;
  p95LatencyMs: number;
  ticks: readonly UptimeTickItem[];
  maxTicks?: number;
  className?: string;
}

const DEFAULT_MAX_TICKS = 45;
const SLA_DECIMAL_PLACES = 2;

const STATUS_BADGE_CLASSES: Record<UptimeTickStatus, string> = {
  UP: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  DEGRADED: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  DOWN: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
};

const TICK_PILL_CLASSES: Record<UptimeTickStatus, string> = {
  UP: 'bg-emerald-500',
  DEGRADED: 'bg-amber-500',
  DOWN: 'bg-rose-500',
};

interface NormalizedTickSlot {
  slotKey: string;
  pillClassName: string;
  tooltipTitle: string;
}

function buildNormalizedTickSlots(
  ticks: readonly UptimeTickItem[],
  resolvedMaxTicks: number
): readonly NormalizedTickSlot[] {
  const visibleTicks = ticks.slice(-resolvedMaxTicks);
  const missingTickCount = Math.max(0, resolvedMaxTicks - visibleTicks.length);

  const placeholderSlots: NormalizedTickSlot[] = Array.from(
    { length: missingTickCount },
    (_, slotIndex) => ({
      slotKey: `placeholder-${slotIndex}`,
      pillClassName: 'bg-zinc-200/80',
      tooltipTitle: 'NO DATA • --ms • Pending sample',
    })
  );

  const recordedSlots: NormalizedTickSlot[] = visibleTicks.map((tick, tickIndex) => ({
    slotKey: `${tick.checkedAt}-${tickIndex}`,
    pillClassName: TICK_PILL_CLASSES[tick.status],
    tooltipTitle: `${tick.status} • ${tick.latencyMs}ms • ${tick.checkedAt}`,
  }));

  return [...placeholderSlots, ...recordedSlots];
}

export function UptimeHeartbeatStrip({
  label,
  currentStatus,
  slaPct,
  p95LatencyMs,
  ticks,
  maxTicks = DEFAULT_MAX_TICKS,
  className,
}: Readonly<UptimeHeartbeatStripProps>) {
  const resolvedMaxTicks = Math.max(1, maxTicks);
  const tickSlots = buildNormalizedTickSlots(ticks, resolvedMaxTicks);
  const formattedSlaPct = `${slaPct.toFixed(SLA_DECIMAL_PLACES)}% SLA`;

  return (
    <GlassCard
      variant="default"
      padding={false}
      data-testid="uptime-heartbeat-strip"
      className={cn('p-4', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-zinc-900">{label}</span>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 font-mono font-semibold text-xs',
              STATUS_BADGE_CLASSES[currentStatus]
            )}
          >
            {currentStatus}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-zinc-600">
          <span>p95 {p95LatencyMs}ms</span>
          <span className="font-semibold text-zinc-900">{formattedSlaPct}</span>
        </div>
      </div>

      <div
        className="mt-3 flex items-center gap-1"
        role="img"
        aria-label={`${label} heartbeat status ${currentStatus}, ${formattedSlaPct}, p95 ${p95LatencyMs} milliseconds`}
      >
        {tickSlots.map((slot) => (
          <span
            key={slot.slotKey}
            title={slot.tooltipTitle}
            className={cn(
              'h-5 flex-1 rounded-xs transition-opacity hover:opacity-80',
              slot.pillClassName
            )}
          />
        ))}
      </div>
    </GlassCard>
  );
}
