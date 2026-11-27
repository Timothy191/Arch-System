'use client';

/* cspell:ignore mttr */

import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { Activity, AlertTriangle, CheckCircle2, Clock, Gauge } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EngineeringReportsNav } from './EngineeringReportsNav';
import type { EngineeringReportsPayload } from './engineering-reports-model';

interface EngineeringDashboardReportClientProps {
  readonly payload: EngineeringReportsPayload;
}

const KPI_CARD_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-white/80 p-4 shadow-2xs';
const TH_CLASS =
  'px-4 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';
const CHART_HEIGHT = 240;
const AXIS_TICK_STYLE = { fill: 'var(--text-muted)', fontSize: 11 };
const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  fontSize: 12,
};

export function EngineeringDashboardReportClient({
  payload,
}: EngineeringDashboardReportClientProps) {
  const { summary } = payload;

  return (
    <div className="space-y-6">
      <EngineeringReportsNav payload={payload} activeRoute="dashboard" />

      <div className="space-y-6" data-testid="engineering-dashboard-view">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className={KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                Fleet Availability
              </span>
              <Activity className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            </div>
            <p className="mt-2 font-bold text-2xl text-emerald-700">
              {summary.fleetAvailabilityPct.toFixed(1)}%
            </p>
            <span className="text-[var(--text-muted)] text-xs">
              {summary.activeMachinesCount} active machines
            </span>
          </div>

          <div className={KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                Active Breakdowns
              </span>
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
            </div>
            <p className="mt-2 font-bold text-2xl text-red-700">{summary.activeBreakdowns}</p>
            <span className="text-[var(--text-muted)] text-xs">
              {summary.totalBreakdowns} total in window
            </span>
          </div>

          <div className={KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                Resolved
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            </div>
            <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
              {summary.resolvedBreakdowns}
            </p>
            <span className="text-[var(--text-muted)] text-xs">Returned to service</span>
          </div>

          <div className={KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                Downtime / MTTR
              </span>
              <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
            </div>
            <p className="mt-2 font-bold text-2xl text-amber-700">
              {summary.totalDowntimeHours.toFixed(1)}h
            </p>
            <span className="text-[var(--text-muted)] text-xs">
              MTTR: {summary.mttrHours.toFixed(1)}h
            </span>
          </div>

          <div className={KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                Hours Worked
              </span>
              <Gauge className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
              {summary.totalHoursWorked.toLocaleString('en-US')}h
            </p>
            <span className="text-[var(--text-muted)] text-xs">Fleet SMU output</span>
          </div>

          <div className={KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                Critical Tires
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            </div>
            <p className="mt-2 font-bold text-2xl text-amber-700">{summary.criticalTires}</p>
            <span className="text-[var(--text-muted)] text-xs">
              {summary.installedTires} active · {summary.spareTires} spares
            </span>
          </div>
        </div>

        {/* Recharts Analytics Row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <GlassCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Breakdown Trend &amp; Downtime Hours
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Active vs. resolved breakdown events across the reporting window
                </p>
              </div>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {payload.breakdownTrend.length} days
              </span>
            </div>
            {payload.breakdownTrend.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-[var(--text-muted)] text-xs">
                No breakdown trend data in selected window.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={[...payload.breakdownTrend]}>
                  <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={AXIS_TICK_STYLE} stroke="var(--border-default)" />
                  <YAxis
                    allowDecimals={false}
                    tick={AXIS_TICK_STYLE}
                    stroke="var(--border-default)"
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar
                    dataKey="activeCount"
                    name="Active"
                    fill="var(--accent-red)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="resolvedCount"
                    name="Resolved"
                    fill="var(--accent-green)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Tire Condition Distribution
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Good vs. Warning vs. Critical tire condition across fleet ({summary.totalTires}{' '}
                  tires)
                </p>
              </div>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                Removals: {summary.tireRemovalsCount} · Mounts: {summary.tireReplacementsCount}
              </span>
            </div>
            {summary.totalTires === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-[var(--text-muted)] text-xs">
                No tire fleet telemetry registered.
              </div>
            ) : (
              <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <PieChart>
                    <Pie
                      data={[...payload.tireConditionBreakdown]}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {payload.tireConditionBreakdown.map((entry) => (
                        <Cell key={entry.label} fill={entry.colorVar} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2.5">
                  {payload.tireConditionBreakdown.map((slice) => (
                    <div
                      key={slice.label}
                      className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-[var(--text-heading)]">{slice.label}</span>
                      <span className="font-bold font-mono text-[var(--text-heading)]">
                        {slice.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Breakdowns Table & Top Machines */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <GlassCard className="overflow-hidden p-0 lg:col-span-2">
            <div className="border-[var(--border-default)] border-b px-5 py-3.5">
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                Active &amp; Resolved Breakdowns
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                    <th scope="col" className={TH_CLASS}>
                      Machine
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Reason
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Status
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Date
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Downtime
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {payload.breakdowns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                        No breakdown records found in this window.
                      </td>
                    </tr>
                  ) : (
                    payload.breakdowns.slice(0, 12).map((bd) => (
                      <tr key={bd.id}>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-[var(--text-heading)]">
                            {bd.machineName}
                          </span>
                          <span className="block text-[11px] text-[var(--text-muted)]">
                            {bd.machineType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{bd.reason}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 font-semibold text-[11px]',
                              bd.status === 'active'
                                ? 'bg-red-500/10 text-red-700'
                                : 'bg-emerald-500/10 text-emerald-700'
                            )}
                          >
                            {bd.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                          {bd.dateIn}
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--text-heading)]">
                          {bd.durationHours > 0 ? `${bd.durationHours.toFixed(1)}h` : 'Ongoing'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden p-0">
            <div className="border-[var(--border-default)] border-b px-5 py-3.5">
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                Top Machines by Hours
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-default)]">
              {payload.topMachinesByHours.length === 0 ? (
                <p className="px-5 py-8 text-center text-[var(--text-muted)] text-xs">
                  No machine hours logged.
                </p>
              ) : (
                payload.topMachinesByHours.map((m) => (
                  <div
                    key={m.machineId}
                    className="flex items-center justify-between px-5 py-3 text-xs"
                  >
                    <div>
                      <span className="block font-semibold text-[var(--text-heading)]">
                        {m.machineName}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {m.machineType} · {m.breakdownCount} breakdowns
                      </span>
                    </div>
                    <span className="font-bold font-mono text-[var(--text-heading)]">
                      {m.hoursWorked.toFixed(1)}h
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Recent Tire Activity Table */}
        <GlassCard className="overflow-hidden p-0">
          <div className="border-[var(--border-default)] border-b px-5 py-3.5">
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Recent Tire Removals, Replacements &amp; Inspections
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                  <th scope="col" className={TH_CLASS}>
                    Date
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Activity
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Serial / Brand
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Machine / Position
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Tread / PSI
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {payload.recentTireActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                      No tire activity records in this window.
                    </td>
                  </tr>
                ) : (
                  payload.recentTireActivities.slice(0, 10).map((act) => (
                    <tr key={act.id}>
                      <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                        {act.inspectionDate}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-heading)] uppercase">
                        {act.activityKind}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-[var(--text-heading)]">
                          {act.serialNumber}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {act.brand}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-[var(--text-heading)]">
                          {act.machineName}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {act.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--text-heading)]">
                        {act.treadDepthMm}mm · {act.pressurePsi} PSI
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-[var(--text-muted)]">
                        {act.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
