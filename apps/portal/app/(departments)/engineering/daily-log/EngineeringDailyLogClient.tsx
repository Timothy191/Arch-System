'use client';

import { EngineeringReliabilityPulseIcon } from '@repo/ui/engineering-icons';
import { GlassCard } from '@repo/ui/GlassCard';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Gauge,
  Printer,
  Search,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  type EngineeringDailyLogReport,
  escapeEngineeringCsvCell,
} from './engineering-daily-log-helpers';

interface EngineeringDailyLogClientProps {
  readonly report: EngineeringDailyLogReport;
}

const CHART_HEIGHT = 230;
const AXIS_FONT_SIZE = 11;
const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: AXIS_FONT_SIZE } as const;
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  fontSize: 12,
} as const;

const KPI_LABEL_CLASS = 'font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider';
const KPI_VALUE_CLASS = 'mt-1.5 font-bold text-2xl text-[var(--text-heading)] tabular-nums';
const TH_CLASS =
  'px-3.5 py-2.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';
const TD_CLASS = 'px-3.5 py-3 text-[var(--text-secondary)] text-xs';
const TD_HEADING_CLASS = 'px-3.5 py-3 font-medium text-[var(--text-heading)] text-xs';
const ACTION_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:border-[var(--border-emphasis)]';
const FILTER_CONTROL_CLASS =
  'rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none';

type StatusFilter = 'all' | 'active' | 'completed';
type ShiftFilter = 'all' | 'day' | 'night';

export function EngineeringDailyLogClient({ report }: EngineeringDailyLogClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [machineTypeFilter, setMachineTypeFilter] = useState('all');

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return report.records.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (shiftFilter !== 'all' && record.shiftType !== shiftFilter) return false;
      if (machineTypeFilter !== 'all' && record.machineType !== machineTypeFilter) return false;
      if (!query) return true;
      return (
        record.machineName.toLowerCase().includes(query) ||
        record.machineType.toLowerCase().includes(query) ||
        record.fleetId.toLowerCase().includes(query) ||
        record.siteCode.toLowerCase().includes(query) ||
        record.reason.toLowerCase().includes(query) ||
        record.repairNotes.toLowerCase().includes(query)
      );
    });
  }, [machineTypeFilter, report.records, searchTerm, shiftFilter, statusFilter]);

  const handleExportCsv = () => {
    const headers = [
      'Machine',
      'Type',
      'Fleet ID',
      'Site',
      'Shift',
      'Date In',
      'Time In',
      'Date Out',
      'Time Out',
      'Duration (hrs)',
      'Fault Reason',
      'Repair Notes',
      'Status',
    ];
    const csvRows = filteredRecords.map((record) => [
      record.machineName,
      record.machineType,
      record.fleetId,
      record.siteCode,
      record.shiftType,
      record.dateIn,
      record.timeIn,
      record.dateOut,
      record.timeOut,
      record.durationHours.toFixed(1),
      record.reason,
      record.repairNotes,
      record.status,
    ]);
    const csvBody = [headers, ...csvRows]
      .map((row) => row.map((cell) => escapeEngineeringCsvCell(String(cell))).join(','))
      .join('\n');

    if (typeof window === 'undefined') return;
    const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `engineering-24h-breakdowns-${report.today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <GoldenPanel
        variant="elevated"
        showLogo
        headingLevel="h2"
        title="24-Hour Machine Breakdowns Daily Log"
        subtitle={`Rolling 24-hour breakdown activity report & shift log for ${report.today} (${report.kpis.activeMachinesCount} active fleet units monitored)`}
        icon={<EngineeringReliabilityPulseIcon className="h-6 w-6 text-dept-engineering" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/engineering" className={ACTION_BUTTON_CLASS}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Engineering Hub
            </Link>
            <Link href="/engineering/breakdowns" className={ACTION_BUTTON_CLASS}>
              <Wrench className="h-3.5 w-3.5 text-accent-red" aria-hidden="true" />
              Manage Breakdowns
            </Link>
            <button type="button" onClick={handlePrint} className={ACTION_BUTTON_CLASS}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print Report
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-charcoal)] px-3 py-1.5 font-medium text-white text-xs shadow-2xs transition-opacity hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export CSV
            </button>
          </div>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>Logged Last 24h</span>
            <ClipboardList className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
          </div>
          <p className={KPI_VALUE_CLASS}>{report.kpis.loggedLast24h}</p>
          <span className="mt-1 block text-[var(--text-muted)] text-xs">
            Deduplicated 24h incidents
          </span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>Still Active</span>
            <AlertTriangle className="h-4 w-4 text-accent-red" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-bold text-2xl text-accent-red tabular-nums">
            {report.kpis.stillActive}
          </p>
          <span className="mt-1 block text-[var(--text-muted)] text-xs">Open faults on floor</span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>Completed / Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-accent-green" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-bold text-2xl text-accent-green tabular-nums">
            {report.kpis.completedResolved}
          </p>
          <span className="mt-1 block text-[var(--text-muted)] text-xs">
            Booked out within window
          </span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>Total Downtime</span>
            <Clock className="h-4 w-4 text-accent-amber" aria-hidden="true" />
          </div>
          <p className={KPI_VALUE_CLASS}>{report.kpis.totalDowntimeHours.toFixed(1)} hrs</p>
          <span className="mt-1 block text-[var(--text-muted)] text-xs">
            Combined 24h repair outage
          </span>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <span className={KPI_LABEL_CLASS}>MTTR Avg</span>
            <Gauge className="h-4 w-4 text-[var(--accent-indigo)]" aria-hidden="true" />
          </div>
          <p className={KPI_VALUE_CLASS}>{report.kpis.mttrHours.toFixed(1)} hrs</p>
          <span className="mt-1 block text-[var(--text-muted)] text-xs">Mean time to restore</span>
        </GlassCard>
      </div>

      {/* Recharts Hourly & Shift Activity Graphs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                24-Hour Breakdown Activity Timeline
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Active vs resolved breakdowns across 2-hour windows
              </p>
            </div>
            <div className="flex items-center gap-3 text-[var(--text-muted)] text-xs">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-red)]" />
                Active
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-green)]" />
                Resolved
              </span>
            </div>
          </div>

          {report.kpis.loggedLast24h > 0 ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={report.hourlyActivity}>
                <CartesianGrid
                  stroke="var(--border-default)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis dataKey="slot" tick={AXIS_TICK} stroke="var(--border-default)" />
                <YAxis allowDecimals={false} tick={AXIS_TICK} stroke="var(--border-default)" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar
                  dataKey="active"
                  stackId="breakdowns"
                  name="Active"
                  fill="var(--accent-red)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="resolved"
                  stackId="breakdowns"
                  name="Resolved"
                  fill="var(--accent-green)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] border-dashed text-[var(--text-muted)] text-xs">
              No breakdowns logged in the last 24 hours.
            </p>
          )}
        </GlassCard>

        <GlassCard>
          <div className="mb-3">
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Day vs Night Shift Summary
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Shift distribution of active and resolved breakdowns
            </p>
          </div>

          {report.kpis.loggedLast24h > 0 ? (
            <div className="space-y-3">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={report.shiftBreakdown}>
                  <CartesianGrid
                    stroke="var(--border-default)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="shift" tick={AXIS_TICK} stroke="var(--border-default)" />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} stroke="var(--border-default)" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey="active"
                    name="Active"
                    fill="var(--accent-red)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="resolved"
                    name="Resolved"
                    fill="var(--accent-green)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {report.shiftBreakdown.map((bucket) => (
                  <div
                    key={bucket.shift}
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2.5"
                  >
                    <p className="font-medium text-[var(--text-heading)]">{bucket.shift}</p>
                    <p className="mt-0.5 text-[var(--text-muted)]">
                      {bucket.total} total · {bucket.downtimeHours.toFixed(1)} hrs
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] border-dashed text-[var(--text-muted)] text-xs">
              No shift activity recorded in the last 24 hours.
            </p>
          )}
        </GlassCard>
      </div>

      {/* Filterable 24-Hour Breakdowns Report Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-[var(--border-default)] border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              24-Hour Breakdowns Report Table
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Showing {filteredRecords.length} of {report.records.length} logged breakdowns
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
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search machine, reason, notes..."
                aria-label="Search 24h breakdowns"
                className={`${FILTER_CONTROL_CLASS} w-full pl-8 sm:w-56`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              aria-label="Filter by breakdown status"
              className={FILTER_CONTROL_CLASS}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Resolved</option>
            </select>

            <select
              value={shiftFilter}
              onChange={(event) => setShiftFilter(event.target.value as ShiftFilter)}
              aria-label="Filter by shift"
              className={FILTER_CONTROL_CLASS}
            >
              <option value="all">All Shifts</option>
              <option value="day">Day Shift</option>
              <option value="night">Night Shift</option>
            </select>

            <select
              value={machineTypeFilter}
              onChange={(event) => setMachineTypeFilter(event.target.value)}
              aria-label="Filter by machine type"
              className={FILTER_CONTROL_CLASS}
            >
              <option value="all">All Machine Types</option>
              {report.machineTypes.map((machineType) => (
                <option key={machineType} value={machineType}>
                  {machineType}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-[var(--text-heading)] text-sm">
              No breakdowns found for the last 24 hours
            </p>
            <p className="mt-1 text-[var(--text-muted)] text-xs">
              Adjust your search filters or log a new breakdown event from the Breakdowns workspace.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="24-hour machine breakdowns log">
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]">
                  <th scope="col" className={TH_CLASS}>
                    Machine
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Type
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Site
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Shift
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Date / Time In
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Date / Time Out
                  </th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    Duration
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Fault Reason
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Repair Notes
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-[var(--bg-secondary)]/50">
                    <td className={TD_HEADING_CLASS}>
                      <span>{record.machineName}</span>
                      <span className="block font-mono font-normal text-[11px] text-[var(--text-muted)]">
                        {record.fleetId}
                      </span>
                    </td>
                    <td className={TD_CLASS}>{record.machineType}</td>
                    <td className={TD_CLASS}>{record.siteCode}</td>
                    <td className={`${TD_CLASS} capitalize`}>{record.shiftType}</td>
                    <td className={`${TD_CLASS} font-mono`}>
                      {record.dateIn} {record.timeIn}
                    </td>
                    <td className={`${TD_CLASS} font-mono`}>
                      {record.dateOut === '—' ? '—' : `${record.dateOut} ${record.timeOut}`}
                    </td>
                    <td className={`${TD_CLASS} text-right font-mono tabular-nums`}>
                      {record.durationHours.toFixed(1)} h
                    </td>
                    <td className={`${TD_CLASS} max-w-[200px]`}>{record.reason}</td>
                    <td className={`${TD_CLASS} max-w-[200px]`}>{record.repairNotes}</td>
                    <td className={TD_CLASS}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-medium text-[11px] ${
                          record.status === 'active'
                            ? 'bg-accent-red/10 text-accent-red'
                            : 'bg-accent-green/10 text-accent-green'
                        }`}
                      >
                        {record.status === 'active' ? 'Active' : 'Resolved'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
