'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Moon, Sun } from 'lucide-react';
import type {
  EngineeringLogItem,
  MachineOperationLogItem,
  ShiftComparisonMetrics,
  ShiftReportRow,
  SiteBreakdownItem,
} from './reports-types';
import { ShiftReportA4Preview } from './ShiftReportA4Preview';

export interface ReportsShiftViewTabProps {
  readonly shiftComparison: ShiftComparisonMetrics;
  readonly siteBreakdown: readonly SiteBreakdownItem[];
  readonly filteredShiftRows: readonly ShiftReportRow[];
  readonly filteredMachineOps: readonly MachineOperationLogItem[];
  readonly filteredEngineeringLogs: readonly EngineeringLogItem[];
  readonly departmentId?: string;
  readonly departmentName?: string;
  readonly todayStr?: string;
  readonly currentShift?: 'day' | 'night';
  readonly fromDateStr?: string;
  readonly toDateStr?: string;
  readonly shiftFilter?: 'all' | 'day' | 'night';
}

export function ReportsShiftViewTab({
  shiftComparison,
  siteBreakdown,
  filteredMachineOps,
  filteredEngineeringLogs,
  departmentId = 'control-room',
  departmentName = 'Control Room',
  todayStr = new Date().toISOString().slice(0, 10),
  currentShift = 'day',
  fromDateStr = todayStr,
  toDateStr = todayStr,
  shiftFilter = 'all',
}: ReportsShiftViewTabProps) {
  return (
    <div className="space-y-6" data-testid="reports-shift-view-tab">
      {/* Visual Shift Split Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Day vs Night Performance Card */}
        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-heading)] text-base">
                Shift Performance Split (Day vs Night)
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Comparison of volume moved, haul loads, and operating hours by shift
              </p>
            </div>
            <span className="font-mono font-semibold text-[var(--accent-blue)] text-xs">
              {Number(
                (shiftComparison.dayBcm + shiftComparison.nightBcm).toFixed(1)
              ).toLocaleString()}{' '}
              BCM
            </span>
          </div>

          {/* Visual Split Bar */}
          <div className="space-y-2">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full bg-[var(--accent-blue)] transition-all"
                style={{ width: `${shiftComparison.dayPct}%` }}
                title={`Day Shift: ${shiftComparison.dayPct}%`}
              />
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${shiftComparison.nightPct}%` }}
                title={`Night Shift: ${shiftComparison.nightPct}%`}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-[var(--accent-blue)]">
                <Sun className="h-3.5 w-3.5" />
                Day Shift ({shiftComparison.dayPct}%)
              </span>
              <span className="flex items-center gap-1.5 font-medium text-indigo-500">
                <Moon className="h-3.5 w-3.5" />
                Night Shift ({shiftComparison.nightPct}%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-[var(--border-default)] border-t pt-2">
            <div className="space-y-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
              <p className="font-medium text-[var(--accent-blue)] text-xs">Day Shift Totals</p>
              <p className="font-bold font-mono text-[var(--text-heading)] text-lg">
                {Number(shiftComparison.dayBcm.toFixed(1)).toLocaleString()} BCM
              </p>
              <p className="text-[var(--text-muted)] text-xs">
                {shiftComparison.dayLoads.toLocaleString()} loads ·{' '}
                {shiftComparison.dayHours.toFixed(1)}h · {shiftComparison.dayDelays}m delay
              </p>
            </div>
            <div className="space-y-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
              <p className="font-medium text-indigo-500 text-xs">Night Shift Totals</p>
              <p className="font-bold font-mono text-[var(--text-heading)] text-lg">
                {Number(shiftComparison.nightBcm.toFixed(1)).toLocaleString()} BCM
              </p>
              <p className="text-[var(--text-muted)] text-xs">
                {shiftComparison.nightLoads.toLocaleString()} loads ·{' '}
                {shiftComparison.nightHours.toFixed(1)}h · {shiftComparison.nightDelays}m delay
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Site Production Indicators Card */}
        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-heading)] text-base">
                Site Volume &amp; Productivity Indicators
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Active pit &amp; stockpile site distribution
              </p>
            </div>
            <span className="text-[var(--text-muted)] text-xs">
              {siteBreakdown.length} active site{siteBreakdown.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="max-h-52 space-y-3 overflow-y-auto pr-1">
            {siteBreakdown.map((s) => (
              <div key={s.site} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text-heading)]">{s.site}</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    <strong className="text-[var(--accent-blue)]">
                      {Number(s.bcm.toFixed(1)).toLocaleString()} BCM
                    </strong>{' '}
                    · {s.loads.toLocaleString()} loads · {s.hours.toFixed(1)}h (
                    {s.bcmPerHour.toFixed(1)} BCM/h)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-blue)] transition-all"
                    style={{ width: `${Math.max(s.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
            {siteBreakdown.length === 0 && (
              <p className="py-6 text-center text-[var(--text-muted)] text-xs">
                No site shift data for the current filter.
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Live Paginated PDF Page Preview (Replacing Raw Tables) */}
      <ShiftReportA4Preview
        departmentId={departmentId}
        departmentName={departmentName}
        todayStr={todayStr}
        currentShift={currentShift}
        fromDateStr={fromDateStr}
        toDateStr={toDateStr}
        shiftFilter={shiftFilter}
        filteredMachineOps={filteredMachineOps}
      />

      {/* Engineering Breakdowns & Department Activity Logs */}
      {filteredEngineeringLogs.length > 0 && (
        <GlassCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
            <div>
              <h3 className="font-semibold text-[var(--text-heading)] text-base">
                Engineering Breakdowns &amp; Department Activity Logs
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Cross-department engineering faults, repairs, and shift logs
              </p>
            </div>
            <span className="font-mono text-[var(--text-muted)] text-xs">
              {filteredEngineeringLogs.length} item
              {filteredEngineeringLogs.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="divide-y divide-[var(--border-default)]">
            {filteredEngineeringLogs.slice(0, 20).map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-2 px-6 py-3.5 transition-colors hover:bg-[var(--bg-tertiary)]/50 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 font-medium text-xs ${
                        item.source === 'breakdown'
                          ? 'border border-accent-red/20 bg-accent-red/10 text-accent-red'
                          : 'border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                      }`}
                    >
                      {item.source === 'breakdown'
                        ? 'Breakdown'
                        : item.source === 'daily_log'
                          ? 'Engineering Log'
                          : 'Engineering Note'}
                    </span>
                    <span className="font-semibold text-[var(--text-heading)] text-sm">
                      {item.machineName}
                    </span>
                    <span className="font-mono text-[var(--text-muted)] text-xs">
                      {item.date} · {item.shift.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[var(--text-heading)] text-sm">{item.description}</p>
                  {item.actionTaken && (
                    <p className="text-[var(--text-secondary)] text-xs">
                      <strong className="text-[var(--accent-blue)]">Action:</strong>{' '}
                      {item.actionTaken}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 self-start rounded-full px-2.5 py-0.5 font-medium text-xs sm:self-center ${
                    item.status === 'resolved'
                      ? 'bg-accent-green/10 text-accent-green'
                      : 'bg-accent-red/10 text-accent-red'
                  }`}
                >
                  {item.status === 'resolved' ? 'Resolved' : 'Open / Active'}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
