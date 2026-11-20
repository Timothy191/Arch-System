'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  AlertTriangle,
  CircleDot,
  Clock,
  Download,
  Gauge,
  Search,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { type EngineeringHubMetrics, escapeEngineeringCsvCell } from './engineering-hub-metrics';

interface EngineeringHubDashboardClientProps {
  readonly metrics: EngineeringHubMetrics;
}

const CHART_HEIGHT = 240;
const DONUT_HEIGHT = 210;
const AXIS_FONT_SIZE = 11;
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  fontSize: 12,
} as const;
const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: AXIS_FONT_SIZE } as const;

const KPI_LABEL_CLASS = 'font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider';
const KPI_VALUE_CLASS = 'mt-1.5 font-bold text-2xl text-[var(--text-heading)] tabular-nums';
const TH_CLASS =
  'px-4 py-2.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';
const TD_CLASS = 'px-4 py-3 text-[var(--text-secondary)] text-xs';
const TD_HEADING_CLASS = 'px-4 py-3 font-medium text-[var(--text-heading)] text-xs';
const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] py-1.5 pr-3 pl-8 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none sm:w-64';
const SELECT_CLASS =
  'rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none';
const EMPTY_BOX_CLASS =
  'flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] text-center text-[var(--text-muted)] text-xs';

type BreakdownStatusFilter = 'all' | 'active' | 'completed';

export function EngineeringHubDashboardClient({ metrics }: EngineeringHubDashboardClientProps) {
  const [breakdownSearch, setBreakdownSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BreakdownStatusFilter>('all');
  const [tireSearch, setTireSearch] = useState('');

  const filteredBreakdowns = useMemo(() => {
    const query = breakdownSearch.trim().toLowerCase();
    return metrics.breakdownReports.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!query) return true;
      return (
        row.machineName.toLowerCase().includes(query) ||
        row.machineType.toLowerCase().includes(query) ||
        row.reason.toLowerCase().includes(query) ||
        row.fleetId.toLowerCase().includes(query) ||
        row.siteCode.toLowerCase().includes(query)
      );
    });
  }, [breakdownSearch, metrics.breakdownReports, statusFilter]);

  const filteredTires = useMemo(() => {
    const query = tireSearch.trim().toLowerCase();
    return metrics.tireAlerts.filter((row) => {
      if (!query) return true;
      return (
        row.serialNumber.toLowerCase().includes(query) ||
        row.brand.toLowerCase().includes(query) ||
        row.machineName.toLowerCase().includes(query) ||
        row.position.toLowerCase().includes(query)
      );
    });
  }, [metrics.tireAlerts, tireSearch]);

  const hasTrendActivity = metrics.trend14d.some(
    (point) => point.logged > 0 || point.resolved > 0 || point.downtimeHours > 0
  );

  const handleExportBreakdownsCsv = () => {
    const headers = [
      'Machine',
      'Type',
      'Fleet ID',
      'Site',
      'Shift',
      'Date In',
      'Time In',
      'Duration (hrs)',
      'Status',
      'Reason',
    ];
    const rows = filteredBreakdowns.map((row) => [
      row.machineName,
      row.machineType,
      row.fleetId,
      row.siteCode,
      row.shiftType,
      row.dateIn,
      row.timeIn,
      row.durationHours.toFixed(1),
      row.status,
      row.reason,
    ]);
    const csvLines = [headers, ...rows]
      .map((line) => line.map((cell) => escapeEngineeringCsvCell(String(cell))).join(','))
      .join('\n');

    if (typeof window === 'undefined') return;
    const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `engineering-breakdowns-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Fleet & Reliability KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>Fleet Availability</span>
            <Activity className="h-4 w-4 text-accent-green" aria-hidden="true" />
          </div>
          <p className={KPI_VALUE_CLASS}>{metrics.availabilityPct}%</p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            {metrics.activeMachines} of {metrics.totalMachines} machines active
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>Total Tracked Tires</span>
            <CircleDot className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
          </div>
          <p className={KPI_VALUE_CLASS}>{metrics.totalTires}</p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            {metrics.installedTires} installed · {metrics.inventoryTires} spares
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>30d Hours Worked</span>
            <Gauge className="h-4 w-4 text-[var(--accent-indigo)]" aria-hidden="true" />
          </div>
          <p className={KPI_VALUE_CLASS}>
            {metrics.totalHoursWorked30d.toLocaleString('en-US', { maximumFractionDigits: 1 })} hrs
          </p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            Fleet utilization across last 30 days
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>Avg Repair (MTTR)</span>
            <Clock className="h-4 w-4 text-accent-amber" aria-hidden="true" />
          </div>
          <p className={KPI_VALUE_CLASS}>{metrics.avgMttrHours.toFixed(1)} hrs</p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            Mean time to repair completed faults
          </p>
        </GlassCard>
      </div>

      {/* Recharts Reporting Graphs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                14-Day Breakdowns Logged vs Resolved
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Daily breakdown intake, repair completions, and downtime hours
              </p>
            </div>
            <div className="flex items-center gap-3 text-[var(--text-muted)] text-xs">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-red)]" />
                Logged
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-green)]" />
                Resolved
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-amber)]" />
                Downtime (h)
              </span>
            </div>
          </div>

          {hasTrendActivity ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <ComposedChart data={metrics.trend14d}>
                <CartesianGrid
                  stroke="var(--border-default)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border-default)" />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  stroke="var(--border-default)"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={AXIS_TICK}
                  stroke="var(--border-default)"
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar
                  yAxisId="left"
                  dataKey="logged"
                  name="Breakdowns Logged"
                  fill="var(--accent-red)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="resolved"
                  name="Breakdowns Resolved"
                  fill="var(--accent-green)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="downtimeHours"
                  name="Downtime (hrs)"
                  stroke="var(--accent-amber)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className={EMPTY_BOX_CLASS}>
              No breakdown trend activity recorded in the last 14 days.
            </p>
          )}
        </GlassCard>

        <GlassCard>
          <div className="mb-3">
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Tire Fleet Health Distribution
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Latest tread depth &amp; condition telemetry
            </p>
          </div>

          {metrics.tireHealthDistribution.length > 0 ? (
            <div className="space-y-3">
              <div className="relative">
                <ResponsiveContainer width="100%" height={DONUT_HEIGHT}>
                  <PieChart>
                    <Pie
                      data={metrics.tireHealthDistribution}
                      dataKey="count"
                      nameKey="label"
                      innerRadius="58%"
                      outerRadius="85%"
                      paddingAngle={2}
                      stroke="var(--bg-primary)"
                      isAnimationActive={false}
                    >
                      {metrics.tireHealthDistribution.map((slice) => (
                        <Cell key={slice.label} fill={slice.colorVar} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-bold text-[var(--text-heading)] text-xl tabular-nums">
                    {metrics.totalTires}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">Tracked Tires</span>
                </div>
              </div>
              <ul className="space-y-1 text-xs">
                {metrics.tireHealthDistribution.map((bucket) => (
                  <li key={bucket.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: bucket.colorVar }}
                        aria-hidden="true"
                      />
                      {bucket.label}
                    </span>
                    <span className="font-semibold text-[var(--text-heading)] tabular-nums">
                      {bucket.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={EMPTY_BOX_CLASS}>No tire telemetry records registered yet.</p>
          )}
        </GlassCard>
      </div>

      {/* Breakdowns & Downtime Hours by Machine Type */}
      <GlassCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Breakdowns &amp; Downtime Hours by Machine Type (30d)
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Failure frequency vs accumulated repair downtime across equipment classes
            </p>
          </div>
          <div className="flex items-center gap-3 text-[var(--text-muted)] text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-blue)]" />
              Breakdowns
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-amber)]" />
              Downtime (hrs)
            </span>
          </div>
        </div>

        {metrics.byMachineType.length > 0 ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={metrics.byMachineType}>
              <CartesianGrid
                stroke="var(--border-default)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis dataKey="machineType" tick={AXIS_TICK} stroke="var(--border-default)" />
              <YAxis allowDecimals={false} tick={AXIS_TICK} stroke="var(--border-default)" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar
                dataKey="total"
                name="Total Breakdowns"
                fill="var(--accent-blue)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="downtimeHours"
                name="Downtime Hours"
                fill="var(--accent-amber)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className={EMPTY_BOX_CLASS}>
            No machine type breakdown telemetry for the last 30 days.
          </p>
        )}
      </GlassCard>

      {/* Detailed Reporting Table 1: Breakdowns Report */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-[var(--border-default)] border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
              <Wrench className="h-4 w-4 text-accent-red" aria-hidden="true" />
              Detailed Breakdowns Reporting Ledger
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              30-day breakdown history ({filteredBreakdowns.length} records shown)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={breakdownSearch}
                onChange={(event) => setBreakdownSearch(event.target.value)}
                placeholder="Filter machine, site, fault..."
                aria-label="Filter breakdowns ledger"
                className={INPUT_CLASS}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as BreakdownStatusFilter)}
              aria-label="Filter breakdown status"
              className={SELECT_CLASS}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="completed">Resolved Only</option>
            </select>
            <button
              type="button"
              onClick={handleExportBreakdownsCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:border-[var(--border-emphasis)]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export CSV
            </button>
          </div>
        </div>

        {filteredBreakdowns.length === 0 ? (
          <p className="p-6 text-center text-[var(--text-muted)] text-xs">
            No breakdown records match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-sm"
              aria-label="Detailed breakdowns reporting ledger"
            >
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                  <th scope="col" className={TH_CLASS}>
                    Machine
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Type
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Site / Shift
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Logged
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Fault Reason
                  </th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    Downtime
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    State
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredBreakdowns.slice(0, 25).map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--bg-secondary)]/50">
                    <td className={TD_HEADING_CLASS}>{row.machineName}</td>
                    <td className={TD_CLASS}>{row.machineType}</td>
                    <td className={TD_CLASS}>
                      {row.siteCode} · {row.shiftType}
                    </td>
                    <td className={`${TD_CLASS} font-mono`}>
                      {row.dateIn} {row.timeIn}
                    </td>
                    <td className={`${TD_CLASS} max-w-xs truncate`}>{row.reason}</td>
                    <td className={`${TD_CLASS} text-right font-mono tabular-nums`}>
                      {row.durationHours.toFixed(1)} h
                    </td>
                    <td className={TD_CLASS}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-medium text-[11px] ${
                          row.status === 'active'
                            ? 'bg-accent-red/10 text-accent-red'
                            : 'bg-accent-green/10 text-accent-green'
                        }`}
                      >
                        {row.status === 'active' ? 'Open Fault' : 'Resolved'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Detailed Reporting Tables 2 & 3 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Critical & Low-Tread Tire Alerts Table */}
        <GlassCard className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-b p-4">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                <AlertTriangle className="h-4 w-4 text-accent-amber" aria-hidden="true" />
                Tire Inspection &amp; Low-Tread Alerts
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Prioritized by critical wear (&lt;15mm) and inspection status
              </p>
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={tireSearch}
                onChange={(event) => setTireSearch(event.target.value)}
                placeholder="Search serial or machine..."
                aria-label="Filter tire alerts"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {filteredTires.length === 0 ? (
            <p className="p-6 text-center text-[var(--text-muted)] text-xs">
              No tire alert records available.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-sm"
                aria-label="Tire inspection and low-tread alerts"
              >
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                    <th scope="col" className={TH_CLASS}>
                      Serial / Brand
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Machine / Pos
                    </th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      Tread
                    </th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      Pressure
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Condition
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredTires.slice(0, 12).map((tire) => (
                    <tr key={tire.id} className="hover:bg-[var(--bg-secondary)]/50">
                      <td className={TD_HEADING_CLASS}>
                        <span className="font-mono">{tire.serialNumber}</span>
                        <span className="block font-normal text-[11px] text-[var(--text-muted)]">
                          {tire.brand} · {tire.size}
                        </span>
                      </td>
                      <td className={TD_CLASS}>
                        <span className="font-medium text-[var(--text-heading)]">
                          {tire.machineName}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {tire.position}
                        </span>
                      </td>
                      <td className={`${TD_CLASS} text-right font-mono tabular-nums`}>
                        {tire.treadDepthMm !== null ? `${tire.treadDepthMm} mm` : '—'}
                      </td>
                      <td className={`${TD_CLASS} text-right font-mono tabular-nums`}>
                        {tire.pressurePsi !== null ? `${tire.pressurePsi} PSI` : '—'}
                      </td>
                      <td className={TD_CLASS}>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 font-medium text-[11px] ${
                            tire.isCritical
                              ? 'bg-accent-red/10 text-accent-red'
                              : 'bg-accent-green/10 text-accent-green'
                          }`}
                        >
                          {tire.isCritical ? 'Critical' : tire.conditionStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Top Machine Maintenance & Hours Summary Table */}
        <GlassCard className="overflow-hidden p-0">
          <div className="border-[var(--border-default)] border-b p-4">
            <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
              <Activity className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
              Machine Maintenance &amp; Hours Summary
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              30-day operating hours, breakdowns, downtime, and mounted tires per unit
            </p>
          </div>

          {metrics.machineSummaries.length === 0 ? (
            <p className="p-6 text-center text-[var(--text-muted)] text-xs">
              No fleet machines registered yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-sm"
                aria-label="Machine maintenance and hours summary"
              >
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                    <th scope="col" className={TH_CLASS}>
                      Machine
                    </th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      30d Hours
                    </th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      Breakdowns
                    </th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      Downtime
                    </th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      Tires
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {metrics.machineSummaries.slice(0, 12).map((machine) => (
                    <tr key={machine.id} className="hover:bg-[var(--bg-secondary)]/50">
                      <td className={TD_HEADING_CLASS}>
                        <span>{machine.name}</span>
                        <span className="block font-normal text-[11px] text-[var(--text-muted)]">
                          {machine.machineType} · {machine.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className={`${TD_CLASS} text-right font-mono tabular-nums`}>
                        {machine.hoursWorked30d.toFixed(1)} h
                      </td>
                      <td className={`${TD_CLASS} text-right font-mono tabular-nums`}>
                        {machine.breakdownCount30d}
                        {machine.activeBreakdowns > 0 ? (
                          <span className="ml-1 text-accent-red">
                            ({machine.activeBreakdowns} open)
                          </span>
                        ) : null}
                      </td>
                      <td className={`${TD_CLASS} text-right font-mono tabular-nums`}>
                        {machine.downtimeHours30d.toFixed(1)} h
                      </td>
                      <td className={`${TD_CLASS} text-right font-mono tabular-nums`}>
                        {machine.installedTires}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
