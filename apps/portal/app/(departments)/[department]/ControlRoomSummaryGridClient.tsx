'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { memo, useId, useMemo } from 'react';
import { useControlRoomSummary } from '@/hooks/useDashboardQueries';

interface ControlRoomSummaryGridClientProps {
  deptId: string;
  today: string;
}

const SUMMARY_SKELETON_CARD_KEYS = [
  'hours-today',
  'total-loads',
  'delay-hours',
  'machines',
  'delay-entries',
] as const;

function ControlRoomSummaryGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
      aria-busy="true"
      aria-label="Loading control room summary metrics"
    >
      {SUMMARY_SKELETON_CARD_KEYS.map((cardKey) => (
        <GlassCard key={cardKey} className="flex min-h-[172px] flex-col justify-between">
          <div>
            <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200/80" />
            <div className="mt-2 h-7 w-16 animate-pulse rounded bg-slate-200/80" />
            <div className="mt-2 h-px w-full bg-gradient-to-r from-accent-amber/40 via-slate-200 to-transparent" />
          </div>
          <div className="mt-auto pt-2">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200/70" />
              <div className="h-3.5 w-12 animate-pulse rounded-full bg-slate-200/70" />
            </div>
            <div className="h-[74px] w-full animate-pulse rounded-xl border border-accent-amber/25 bg-white/70" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

interface ShiftAreaGraphProps {
  readonly series: readonly number[];
  readonly metricId: string;
  readonly strokeColor: string;
  readonly fillColor: string;
}

function ShiftAreaGraph({ series, metricId, strokeColor, fillColor }: ShiftAreaGraphProps) {
  const gradientId = useId();
  const width = 180;
  const height = 36;
  const paddingY = 4;

  const points = useMemo(() => {
    const validSeries = series && series.length > 0 ? series : Array(12).fill(0);
    const maxVal = Math.max(...validSeries, 1);
    const minVal = Math.min(...validSeries, 0);
    const range = maxVal - minVal || 1;

    return validSeries.map((val, idx) => {
      const x = (idx / (validSeries.length - 1)) * width;
      const y = height - paddingY - ((val - minVal) / range) * (height - paddingY * 2);
      return { x, y };
    });
  }, [series]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`),
      ''
    );
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    return `${pathD} L ${width},${height} L 0,${height} Z`;
  }, [pathD, points]);

  return (
    <div
      data-testid={`summary-shift-graph-${metricId}`}
      className="relative mt-2 h-9 w-full overflow-hidden"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-[pulse_3s_ease-in-out_infinite]"
        />
      </svg>
    </div>
  );
}

// AGENT-TRACE: Memoized to prevent re-renders when parent Dashboard re-renders.
// Props (deptId, today) are stable strings — re-renders only from React Query data updates.
function ControlRoomSummaryGridClientBase({ deptId, today }: ControlRoomSummaryGridClientProps) {
  const { data } = useControlRoomSummary(deptId, today);

  if (!data) {
    return <ControlRoomSummaryGridSkeleton />;
  }

  const shiftLabel = data.shiftType === 'night' ? 'Night Shift' : 'Day Shift';
  const shiftTimeRange = data.shiftType === 'night' ? '18:00 – 05:00' : '06:00 – 17:00';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Hours Today Card */}
      <GlassCard hover accent="charcoal" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Hours Today</p>
            {data.activeOperations > 0 && (
              <span className="rounded bg-[var(--accent-blue)]/10 px-2 py-0.5 font-semibold text-[13px] text-[var(--accent-blue)] leading-[18px]">
                {data.activeOperations} active
              </span>
            )}
          </div>
          <p className="mt-1 font-bold text-2xl text-accent-charcoal">
            {data.totalHours.toFixed(1)}h
          </p>
          <div
            data-testid="summary-kpi-separator-hours-today"
            aria-hidden="true"
            className="mt-2 h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent"
          />
        </div>
        <div className="mt-2">
          <ShiftAreaGraph
            series={data.hoursSeries ?? []}
            metricId="hours-today"
            strokeColor="oklch(0.40 0.05 250)"
            fillColor="oklch(0.40 0.05 250)"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wider">{shiftLabel}</span>
            <span className="font-medium font-mono">{shiftTimeRange}</span>
          </div>
        </div>
      </GlassCard>

      {/* Total Loads Card */}
      <GlassCard hover accent="none" className="flex flex-col justify-between">
        <div>
          <p className="system-label">Total Loads</p>
          <p className="mt-1 font-bold text-2xl text-text-heading">
            {data.totalLoads.toLocaleString('en-US')}
          </p>
          <div
            data-testid="summary-kpi-separator-total-loads"
            aria-hidden="true"
            className="mt-2 h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent"
          />
        </div>
        <div className="mt-2">
          <ShiftAreaGraph
            series={data.loadsSeries ?? []}
            metricId="total-loads"
            strokeColor="oklch(0.60 0.18 240)"
            fillColor="oklch(0.60 0.18 240)"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wider">{shiftLabel}</span>
            <span className="font-medium font-mono">{shiftTimeRange}</span>
          </div>
        </div>
      </GlassCard>

      {/* Delay Hours Card */}
      <GlassCard hover accent="red" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Delay Hours</p>
            {data.draftDelayHours > 0 && (
              <span className="font-medium text-[13px] text-accent-charcoal leading-[18px]">
                {data.draftDelayHours.toFixed(1)}h draft
              </span>
            )}
          </div>
          <p className="mt-1 font-bold text-2xl text-accent-red">
            {data.totalDelayHours.toFixed(1)}h
          </p>
          <div
            data-testid="summary-kpi-separator-delay-hours"
            aria-hidden="true"
            className="mt-2 h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent"
          />
        </div>
        <div className="mt-2">
          <ShiftAreaGraph
            series={data.delayHoursSeries ?? []}
            metricId="delay-hours"
            strokeColor="oklch(0.62 0.22 25)"
            fillColor="oklch(0.62 0.22 25)"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wider">{shiftLabel}</span>
            <span className="font-medium font-mono">{shiftTimeRange}</span>
          </div>
        </div>
      </GlassCard>

      {/* Machines Card */}
      <GlassCard hover accent="green" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Machines</p>
            <span className="rounded bg-accent-green/10 px-2 py-0.5 font-semibold text-[13px] text-accent-green leading-[18px]">
              Active Fleet
            </span>
          </div>
          <p className="mt-1 font-bold text-2xl text-accent-green">{data.machineCount}</p>
          <div
            data-testid="summary-kpi-separator-machines"
            aria-hidden="true"
            className="mt-2 h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent"
          />
        </div>
        <div className="mt-2">
          <ShiftAreaGraph
            series={data.machinesSeries ?? []}
            metricId="machines"
            strokeColor="oklch(0.65 0.18 145)"
            fillColor="oklch(0.65 0.18 145)"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wider">{shiftLabel}</span>
            <span className="font-medium font-mono">{shiftTimeRange}</span>
          </div>
        </div>
      </GlassCard>

      {/* Delay Entries Card */}
      <GlassCard hover accent="charcoal" className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="system-label">Delay Entries</p>
            {data.committedDelayHours > 0 && (
              <span className="font-medium text-[13px] text-accent-green leading-[18px]">
                {data.committedDelayHours.toFixed(1)}h committed
              </span>
            )}
          </div>
          <p className="mt-1 font-bold text-2xl text-accent-charcoal">{data.delayEntriesCount}</p>
          <div
            data-testid="summary-kpi-separator-delay-entries"
            aria-hidden="true"
            className="mt-2 h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent"
          />
        </div>
        <div className="mt-2">
          <ShiftAreaGraph
            series={data.delayEntriesSeries ?? []}
            metricId="delay-entries"
            strokeColor="oklch(0.40 0.05 250)"
            fillColor="oklch(0.40 0.05 250)"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wider">{shiftLabel}</span>
            <span className="font-medium font-mono">{shiftTimeRange}</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

export const ControlRoomSummaryGridClient = memo(ControlRoomSummaryGridClientBase);
