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

interface ReportsShiftViewTabProps {
  shiftComparison: ShiftComparisonMetrics;
  siteBreakdown: SiteBreakdownItem[];
  filteredShiftRows: ShiftReportRow[];
  filteredMachineOps: MachineOperationLogItem[];
  filteredEngineeringLogs: EngineeringLogItem[];
}

export function ReportsShiftViewTab({
  shiftComparison,
  siteBreakdown,
  filteredShiftRows,
  filteredMachineOps,
  filteredEngineeringLogs,
}: ReportsShiftViewTabProps) {
  return (
    <div className="space-y-6">
      {/* Visual Indicators Row: Day vs Night Shift Split & Site Performance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Day vs Night Shift Visual Indicator Card */}
        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-heading)] text-base">
                Shift Performance Split (Day vs Night)
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Visual comparison of volume moved, haul loads, and operating hours by shift
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

        {/* Site Production Visual Indicators Card */}
        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-heading)] text-base">
                Site Volume &amp; Productivity Indicators
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Live production distribution across active pit &amp; stockpile sites
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

      {/* Shift Production Logs Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-base">
              Shift Production &amp; Roll-over Logs
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Per-shift breakdown of operating hours, haul loads, excavator BCM, Dozer roll-over
              (Hours &times; 250), and delays
            </p>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            {filteredShiftRows.length} shift record{filteredShiftRows.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60">
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Date
                </th>
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Shift
                </th>
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Site
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Hours
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Loads
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Haul BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Roll-over BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Total BCM
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Delay (min)
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filteredShiftRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--bg-tertiary)]/60">
                  <td className="px-5 py-3.5 font-mono text-[var(--text-heading)] text-sm">
                    {row.date}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium text-xs ${
                        row.shift === 'day'
                          ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                          : 'bg-indigo-500/10 text-indigo-500'
                      }`}
                    >
                      {row.shift === 'day' ? (
                        <Sun className="h-3 w-3" />
                      ) : (
                        <Moon className="h-3 w-3" />
                      )}
                      {row.shift.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    {row.site && row.site !== '—' ? (
                      <span className="inline-flex rounded border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                        {row.site}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs">All Sites</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--text-heading)] text-sm">
                    {row.hours.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium font-mono text-[var(--accent-blue)] text-sm">
                    {row.loads.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-sm">
                    {Number(row.haulBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--accent-blue)] text-sm">
                    {Number(row.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-accent-green text-sm">
                    {Number(row.totalBcm.toFixed(1)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-sm">
                    {row.delayMin}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${
                        row.delayMin > 120
                          ? 'bg-accent-red/10 text-accent-red'
                          : 'bg-accent-green/10 text-accent-green'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          row.delayMin > 120 ? 'bg-accent-red' : 'bg-accent-green'
                        }`}
                      />
                      {row.delayMin > 120 ? 'High Delay' : 'Optimal'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredShiftRows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-10 text-center text-[var(--text-muted)] text-sm"
                  >
                    No shift production logs match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Machine Operations & SMR Log Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-base">
              Machine Operations &amp; SMR Shift Log
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Individual machine SMR readings, operator assignments, and calculated output
            </p>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            {filteredMachineOps.length} operation{filteredMachineOps.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60">
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Date &amp; Shift
                </th>
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Machine
                </th>
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Operator
                </th>
                <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Site
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Start SMR
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Stop SMR
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Hours Worked
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Volume / Roll-over
                </th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filteredMachineOps.slice(0, 50).map((op) => (
                <tr key={op.id} className="transition-colors hover:bg-[var(--bg-tertiary)]/60">
                  <td className="px-5 py-3 font-mono text-[var(--text-heading)] text-xs">
                    {op.date} · <span className="uppercase">{op.shift}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-heading)] text-sm">
                        {op.machineName}
                      </span>
                      <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[var(--text-muted)] text-xs">
                        {op.machineType}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[var(--text-secondary)] text-sm">
                    {op.operatorName}
                  </td>
                  <td className="px-5 py-3 text-[var(--text-secondary)] text-sm">{op.siteName}</td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--text-secondary)] text-sm">
                    {op.startSmu != null ? op.startSmu.toFixed(1) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--text-secondary)] text-sm">
                    {op.endSmu != null ? op.endSmu.toFixed(1) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium font-mono text-accent-green text-sm">
                    {op.hoursWorked.toFixed(2)}h
                  </td>
                  <td className="px-5 py-3 text-right font-medium font-mono text-[var(--accent-blue)] text-sm">
                    {op.isDozer
                      ? `${Number(op.bcmMoved.toFixed(1)).toLocaleString()} BCM (Roll-over)`
                      : op.bcmMoved > 0
                        ? `${Number(op.bcmMoved.toFixed(1)).toLocaleString()} BCM`
                        : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${
                        op.status === 'completed'
                          ? 'bg-accent-green/10 text-accent-green'
                          : 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                      }`}
                    >
                      {op.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredMachineOps.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-[var(--text-muted)] text-sm"
                  >
                    No machine operation logs found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Engineering Breakdowns & Activity Logs */}
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
