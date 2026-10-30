'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { ArrowUpRight, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import type { ArchivedMachineMonthSnapshot } from './reports-types';

interface MachineMultiMonthTrendChartProps {
  archivedSnapshots: readonly ArchivedMachineMonthSnapshot[];
  currentMonth: string;
  onSelectMonth: (monthPrefix: string) => void;
}

const AVAILABILITY_TARGET_PERCENT = 85;
const MAX_BAR_HEIGHT_PX = 80;

export function MachineMultiMonthTrendChart({
  archivedSnapshots,
  currentMonth,
  onSelectMonth,
}: MachineMultiMonthTrendChartProps) {
  // Sort chronological for left-to-right trend
  const chronologicalSnapshots = [...archivedSnapshots].sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const maxSmr = Math.max(1, ...chronologicalSnapshots.map((s) => s.totalSmrWorked));

  if (chronologicalSnapshots.length === 0) {
    return null;
  }

  const latest = chronologicalSnapshots[chronologicalSnapshots.length - 1];
  const previous =
    chronologicalSnapshots.length > 1
      ? chronologicalSnapshots[chronologicalSnapshots.length - 2]
      : null;

  const availDiff =
    previous && latest
      ? Number((latest.fleetAvailabilityPercent - previous.fleetAvailabilityPercent).toFixed(1))
      : 0;

  return (
    <GlassCard className="space-y-4 p-5" data-testid="multi-month-trend-chart">
      <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-b pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--accent-blue)]" />
          <h4 className="font-bold text-[var(--text-heading)] text-sm uppercase tracking-wider">
            Executive Multi-Month Comparative Fleet Trend ({chronologicalSnapshots.length} Months
            Tracked)
          </h4>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs">
          <span className="flex items-center gap-1.5 text-accent-green">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent-green" />
            Availability % (Target: {AVAILABILITY_TARGET_PERCENT}%)
          </span>
          <span className="flex items-center gap-1.5 text-[var(--accent-blue)]">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent-blue)]" />
            SMR Worked
          </span>
          {previous && latest && (
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-bold ${
                availDiff >= 0
                  ? 'bg-accent-green/10 text-accent-green'
                  : 'bg-rose-500/10 text-rose-700'
              }`}
            >
              {availDiff >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {availDiff >= 0 ? `+${availDiff}%` : `${availDiff}%`} MoM
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6">
        {chronologicalSnapshots.map((snap) => {
          const isSelected = snap.month === currentMonth;
          const barHeightRatio = Math.max(0.08, snap.totalSmrWorked / maxSmr);
          const barHeightPx = Math.round(barHeightRatio * MAX_BAR_HEIGHT_PX);
          const isMeetingTarget = snap.fleetAvailabilityPercent >= AVAILABILITY_TARGET_PERCENT;

          return (
            <div
              key={`trend-col-${snap.month}`}
              onClick={() => onSelectMonth(snap.month)}
              data-testid={`trend-month-bar-${snap.month}`}
              className={`group flex cursor-pointer flex-col justify-between rounded-xl border p-3 transition-all ${
                isSelected
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 shadow-sm'
                  : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--accent-blue)]/50 hover:bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-[var(--text-heading)] text-xs">
                    {snap.month}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-1 flex items-baseline justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">Avail:</span>
                  <span
                    className={`font-bold font-mono ${
                      isMeetingTarget ? 'text-accent-green' : 'text-amber-700'
                    }`}
                  >
                    {snap.fleetAvailabilityPercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Visual Relative Height SMR Worked Bar */}
              <div className="my-2 flex h-20 items-end justify-center rounded-lg bg-[var(--bg-tertiary)] p-1">
                <div
                  style={{ height: `${barHeightPx}px` }}
                  className={`w-full rounded-md transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-blue)]'
                      : 'bg-[var(--accent-blue)]/75 group-hover:bg-[var(--accent-blue)]'
                  }`}
                  title={`${snap.month}: ${snap.totalSmrWorked.toFixed(1)}h SMR Worked`}
                />
              </div>

              <div className="border-[var(--border-subtle)] border-t pt-1.5 text-center font-mono text-[10px] text-[var(--text-secondary)]">
                <div>
                  <strong className="text-[var(--text-heading)]">
                    {snap.totalSmrWorked.toFixed(0)}h
                  </strong>{' '}
                  worked
                </div>
                <div className="text-[9px] text-[var(--text-muted)]">
                  {snap.machineCount} machines
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
