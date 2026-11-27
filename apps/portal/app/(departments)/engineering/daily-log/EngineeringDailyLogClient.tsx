'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { GoldenPanel, type GoldenPanelHeaderItem } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { m, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Gauge,
  Printer,
  Search,
  SlidersHorizontal,
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
const KPI_CARD_CLASS =
  'gold-steel-border gold-steel-border-slim transition-transform duration-200 hover:-translate-y-0.5';
const KPI_BADGE_BASE =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs';
const TH_CLASS =
  'px-3.5 py-2.5 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider';
const SORT_BTN_CLASS =
  'inline-flex items-center gap-1 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider hover:text-[var(--text-heading)]';
const TD_CLASS = 'px-3.5 py-3 text-[var(--text-secondary)] text-xs';
const TD_HEADING_CLASS = 'px-3.5 py-3 font-medium text-[var(--text-heading)] text-xs';
const ACTION_BUTTON_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white/85 px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:border-[var(--accent-gold)]/60 hover:bg-white';
const FILTER_CONTROL_CLASS =
  'rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs focus:border-[var(--accent-gold)] focus:outline-none';
const PRESET_BTN_BASE = 'rounded-md border px-2.5 py-1 font-medium text-xs transition-colors';

type StatusFilter = 'all' | 'active' | 'completed';
type ShiftFilter = 'all' | 'day' | 'night';
type DailyLogSortKey = 'machineName' | 'shiftType' | 'dateIn' | 'durationHours' | 'status';

export function EngineeringDailyLogClient({ report }: EngineeringDailyLogClientProps) {
  const prefersReduced = useReducedMotion();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [machineTypeFilter, setMachineTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<DailyLogSortKey>('dateIn');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: DailyLogSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getAriaSort = (key: DailyLogSortKey): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = report.records.filter((record) => {
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

    return [...filtered].sort((left, right) => {
      let cmp = 0;
      if (sortKey === 'durationHours') {
        cmp = left.durationHours - right.durationHours;
      } else if (sortKey === 'dateIn') {
        cmp = `${left.dateIn} ${left.timeIn}`.localeCompare(`${right.dateIn} ${right.timeIn}`);
      } else {
        cmp = String(left[sortKey]).localeCompare(String(right[sortKey]));
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [
    machineTypeFilter,
    report.records,
    searchTerm,
    shiftFilter,
    sortDirection,
    sortKey,
    statusFilter,
  ]);

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

  const totalLogged = Math.max(report.kpis.loggedLast24h, 1);
  const resolvedPct = Math.round((report.kpis.completedResolved / totalLogged) * 100);
  const activePct = Math.round((report.kpis.stillActive / totalLogged) * 100);
  const downtimePct = Math.min(100, Math.round((report.kpis.totalDowntimeHours / 24) * 100));
  const mttrPct = Math.min(100, Math.round((report.kpis.mttrHours / 8) * 100));

  const headerItems: readonly GoldenPanelHeaderItem[] = [
    {
      id: 'quick-filters',
      label: 'Quick Filters',
      icon: <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />,
      badge: `${filteredRecords.length}`,
      panelContent: (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[var(--text-muted)] text-xs uppercase">
              Status:
            </span>
            {(['all', 'active', 'completed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  PRESET_BTN_BASE,
                  statusFilter === status
                    ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--text-heading)]'
                    : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]'
                )}
              >
                {status === 'all' ? 'All' : status === 'active' ? 'Active' : 'Resolved'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[var(--text-muted)] text-xs uppercase">Shift:</span>
            {(['all', 'day', 'night'] as const).map((shift) => (
              <button
                key={shift}
                type="button"
                onClick={() => setShiftFilter(shift)}
                className={cn(
                  PRESET_BTN_BASE,
                  shiftFilter === shift
                    ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--text-heading)]'
                    : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]'
                )}
              >
                {shift === 'all' ? 'All' : shift === 'day' ? 'Day Shift' : 'Night Shift'}
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const motionProps = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <m.div {...motionProps}>
        <GoldenPanel
          variant="elevated"
          showLogo
          headingLevel="h2"
          title="24-Hour Machine Breakdowns Daily Log"
          subtitle={`Rolling 24-hour breakdown activity report & shift log for ${report.today} (${report.kpis.activeMachinesCount} active fleet units monitored)`}
          headerItems={headerItems}
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
                className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-charcoal)] px-3 py-1.5 font-medium text-white text-xs shadow-2xs transition-opacity hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export CSV
              </button>
            </div>
          }
        />
      </m.div>

      {/* KPI Strip with Contextual Icons & Visual Illustrations */}
      <m.div
        {...motionProps}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        data-testid="daily-log-kpi-grid"
      >
        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={KPI_LABEL_CLASS}>Logged Last 24h</span>
              <p className={KPI_VALUE_CLASS}>{report.kpis.loggedLast24h}</p>
            </div>
            <div className={cn(KPI_BADGE_BASE, 'border-sky-500/30 bg-sky-500/10')}>
              <ClipboardList className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
            </div>
          </div>
          <span className="mt-1 block text-[var(--text-muted)] text-xs">
            Deduplicated 24h incidents
          </span>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={KPI_LABEL_CLASS}>Still Active</span>
              <p className="mt-1.5 font-bold text-2xl text-accent-red tabular-nums">
                {report.kpis.stillActive}
              </p>
            </div>
            <div className={cn(KPI_BADGE_BASE, 'border-red-500/30 bg-red-500/10')}>
              <AlertTriangle className="h-4 w-4 text-accent-red" aria-hidden="true" />
            </div>
          </div>
          <div
            aria-hidden="true"
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]"
          >
            <div
              className="h-full rounded-full bg-[var(--accent-red)] transition-all duration-300"
              style={{ width: `${activePct}%` }}
            />
          </div>
          <span className="mt-2 block text-[var(--text-muted)] text-xs">Open faults on floor</span>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={KPI_LABEL_CLASS}>Completed / Resolved</span>
              <p className="mt-1.5 font-bold text-2xl text-accent-green tabular-nums">
                {report.kpis.completedResolved}
              </p>
            </div>
            <div className={cn(KPI_BADGE_BASE, 'border-emerald-500/30 bg-emerald-500/10')}>
              <CheckCircle2 className="h-4 w-4 text-accent-green" aria-hidden="true" />
            </div>
          </div>
          <div
            aria-hidden="true"
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]"
          >
            <div
              className="h-full rounded-full bg-[var(--accent-green)] transition-all duration-300"
              style={{ width: `${resolvedPct}%` }}
            />
          </div>
          <span className="mt-2 block text-[var(--text-muted)] text-xs">
            Booked out within window
          </span>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={KPI_LABEL_CLASS}>Total Downtime</span>
              <p className={KPI_VALUE_CLASS}>{report.kpis.totalDowntimeHours.toFixed(1)} hrs</p>
            </div>
            <div className={cn(KPI_BADGE_BASE, 'border-amber-500/30 bg-amber-500/10')}>
              <Clock className="h-4 w-4 text-accent-amber" aria-hidden="true" />
            </div>
          </div>
          <div
            aria-hidden="true"
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]"
          >
            <div
              className="h-full rounded-full bg-[var(--accent-amber)] transition-all duration-300"
              style={{ width: `${downtimePct}%` }}
            />
          </div>
          <span className="mt-2 block text-[var(--text-muted)] text-xs">
            Combined 24h repair outage
          </span>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={KPI_LABEL_CLASS}>MTTR Avg</span>
              <p className={KPI_VALUE_CLASS}>{report.kpis.mttrHours.toFixed(1)} hrs</p>
            </div>
            <div className={cn(KPI_BADGE_BASE, 'border-indigo-500/30 bg-indigo-500/10')}>
              <Gauge className="h-4 w-4 text-[var(--accent-indigo)]" aria-hidden="true" />
            </div>
          </div>
          <div
            aria-hidden="true"
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]"
          >
            <div
              className="h-full rounded-full bg-[var(--accent-indigo)] transition-all duration-300"
              style={{ width: `${mttrPct}%` }}
            />
          </div>
          <span className="mt-2 block text-[var(--text-muted)] text-xs">Mean time to restore</span>
        </GlassCard>
      </m.div>

      {/* Recharts Hourly & Shift Activity Graphs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GoldenPanel
          showLogo
          headingLevel="h3"
          title="24-Hour Breakdown Activity Timeline"
          subtitle="Active vs resolved breakdowns across 2-hour windows"
          className="lg:col-span-2"
          actions={
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
          }
        >
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
        </GoldenPanel>

        <GoldenPanel
          showLogo
          headingLevel="h3"
          title="Day vs Night Shift Summary"
          subtitle="Shift distribution of active and resolved breakdowns"
        >
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
        </GoldenPanel>
      </div>

      {/* Filterable 24-Hour Breakdowns Report Table */}
      <GoldenPanel
        showLogo
        headingLevel="h3"
        title="24-Hour Breakdowns Report Table"
        subtitle={`Showing ${filteredRecords.length} of ${report.records.length} logged breakdowns`}
        noBodyPadding
        actions={
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
        }
      >
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
                  <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('machineName')}>
                    <button
                      type="button"
                      onClick={() => handleSort('machineName')}
                      className={SORT_BTN_CLASS}
                    >
                      <span>Machine</span>
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Type
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Site
                  </th>
                  <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('shiftType')}>
                    <button
                      type="button"
                      onClick={() => handleSort('shiftType')}
                      className={SORT_BTN_CLASS}
                    >
                      <span>Shift</span>
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('dateIn')}>
                    <button
                      type="button"
                      onClick={() => handleSort('dateIn')}
                      className={SORT_BTN_CLASS}
                    >
                      <span>Date / Time In</span>
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Date / Time Out
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} text-right`}
                    aria-sort={getAriaSort('durationHours')}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('durationHours')}
                      className={SORT_BTN_CLASS}
                    >
                      <span>Duration</span>
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Fault Reason
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Repair Notes
                  </th>
                  <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('status')}>
                    <button
                      type="button"
                      onClick={() => handleSort('status')}
                      className={SORT_BTN_CLASS}
                    >
                      <span>Status</span>
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="transition-colors hover:bg-[var(--bg-secondary)]/50"
                  >
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
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[11px] ${
                          record.status === 'active'
                            ? 'bg-accent-red/10 text-accent-red'
                            : 'bg-accent-green/10 text-accent-green'
                        }`}
                      >
                        {record.status === 'active' && (
                          <span className="badge-pulse-dot bg-red-500" aria-hidden="true" />
                        )}
                        {record.status === 'active' ? 'Active' : 'Resolved'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GoldenPanel>
    </div>
  );
}
