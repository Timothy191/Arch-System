'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { memo } from 'react';
import {
  buildSparklinePoints,
  GoldenTelemetrySparkline,
} from '@/components/telemetry/GoldenTelemetrySparkline';
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

// AGENT-TRACE: Memoized to prevent re-renders when parent Dashboard re-renders.
// Props (deptId, today) are stable strings — re-renders only from React Query data updates.
function ControlRoomSummaryGridClientBase({ deptId, today }: ControlRoomSummaryGridClientProps) {
  const { data } = useControlRoomSummary(deptId, today);

  if (!data) {
    return <ControlRoomSummaryGridSkeleton />;
  }

  const hoursVal = Math.max(data.totalHours, 0);
  const loadsVal = Math.max(data.totalLoads, 0);
  const delayHoursVal = Math.max(data.totalDelayHours, 0);
  const machinesVal = Math.max(data.machineCount, 0);
  const delayEntriesVal = Math.max(data.delayEntriesCount, 0);

  const shiftCapacityHours = Math.max(machinesVal * 12, 12);
  const hoursAttainmentPct = Math.min(100, Math.round((hoursVal / shiftCapacityHours) * 100));
  const loadsPerHour = hoursVal > 0 ? Math.round(loadsVal / hoursVal) : Math.round(loadsVal / 12);
  const availabilityPct =
    hoursVal + delayHoursVal > 0
      ? Math.round((hoursVal / (hoursVal + delayHoursVal)) * 1000) / 10
      : machinesVal > 0
        ? 100
        : 0;
  const committedRatioPct =
    delayHoursVal > 0
      ? Math.round((Math.max(data.committedDelayHours, 0) / delayHoursVal) * 1000) / 10
      : 100;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <GoldenTelemetrySparkline
          id="hours-today"
          title="SMR Run Curve"
          badgeLabel={`${hoursAttainmentPct}% cap`}
          currentValue={`${hoursVal.toFixed(1)}h`}
          avgValue={`${(hoursVal / Math.max(machinesVal, 1)).toFixed(1)}h/u`}
          peakValue={`${shiftCapacityHours}h cap`}
          points={buildSparklinePoints(Math.max(hoursAttainmentPct, 35))}
        />
      </GlassCard>

      <GlassCard hover accent="none" className="flex flex-col justify-between">
        <div>
          <p className="system-label">Total Loads</p>
          <p className="mt-1 font-bold text-2xl text-text-heading">
            {data.totalLoads.toLocaleString()}
          </p>
          <div
            data-testid="summary-kpi-separator-total-loads"
            aria-hidden="true"
            className="mt-2 h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent"
          />
        </div>
        <GoldenTelemetrySparkline
          id="total-loads"
          title="Haulage Velocity"
          badgeLabel={`${loadsPerHour}/h`}
          currentValue={`${loadsVal.toLocaleString()} ld`}
          avgValue={`${loadsPerHour}/h`}
          peakValue={`${Math.round(loadsVal * 25).toLocaleString()} BCM`}
          points={buildSparklinePoints(
            Math.min(96, Math.max(35, Math.round((loadsVal / 180) * 100)))
          )}
        />
      </GlassCard>

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
        <GoldenTelemetrySparkline
          id="delay-hours"
          title="Downtime Variance"
          badgeLabel={`${data.committedDelayHours.toFixed(1)}h lock`}
          currentValue={`${delayHoursVal.toFixed(1)}h`}
          avgValue={`${(delayHoursVal / Math.max(delayEntriesVal, 1)).toFixed(1)}h/ev`}
          peakValue={`${data.draftDelayHours.toFixed(1)}h open`}
          points={buildSparklinePoints(Math.max(30, 90 - Math.round(delayHoursVal * 5)), {
            isInverted: true,
          })}
        />
      </GlassCard>

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
        <GoldenTelemetrySparkline
          id="machines"
          title="Fleet Availability"
          badgeLabel={`${availabilityPct.toFixed(1)}%`}
          currentValue={`${machinesVal} units`}
          avgValue={`${data.activeOperations} open`}
          peakValue={`${machinesVal} reg`}
          points={buildSparklinePoints(availabilityPct)}
        />
      </GlassCard>

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
        <GoldenTelemetrySparkline
          id="delay-entries"
          title="Event Resolution"
          badgeLabel={`${committedRatioPct.toFixed(0)}%`}
          currentValue={`${delayEntriesVal} logs`}
          avgValue={`${data.committedDelayHours.toFixed(1)}h com`}
          peakValue={`${data.draftDelayHours.toFixed(1)}h drf`}
          points={buildSparklinePoints(committedRatioPct)}
        />
      </GlassCard>
    </div>
  );
}

export const ControlRoomSummaryGridClient = memo(ControlRoomSummaryGridClientBase);
