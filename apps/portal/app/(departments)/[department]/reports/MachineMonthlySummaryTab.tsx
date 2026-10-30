'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Calendar,
  Database,
  Download,
  Lock,
  Printer,
  Search,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayGroup,
  type OverviewDelayKey,
} from '@/lib/shift-sheet-buckets';
import { ExecutiveBoardroomPrintView } from './ExecutiveBoardroomPrintView';
import { MachineMultiMonthTrendChart } from './MachineMultiMonthTrendChart';
import { computeMachinePredictiveMetrics } from './predictive-maintenance';
import type {
  ArchivedMachineMonthSnapshot,
  EngineeringLogItem,
  MachineMonthlySummaryRow,
} from './reports-types';

const TH_BASE =
  'whitespace-nowrap px-2.5 py-2.5 text-left font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TH_NUM =
  'whitespace-nowrap px-2 py-2.5 text-right font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TD_BASE = 'whitespace-nowrap px-2.5 py-2.5 align-middle text-xs';
const BTN_PRIMARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs hover:opacity-90';
const BTN_OUTLINE =
  'inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--accent-blue)]/35 bg-[var(--accent-blue)]/10 px-2 py-1 font-semibold text-[11px] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20';
const BTN_SECONDARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-tertiary)]';
const KPI_BOX_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5';

const DELAY_GROUP_TH_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border-sky-500/20 border-x bg-sky-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-sky-900 uppercase tracking-wider',
  nonProduction:
    'whitespace-nowrap border-amber-500/20 border-x bg-amber-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-amber-900 uppercase tracking-wider',
  engineering:
    'whitespace-nowrap border-rose-500/20 border-x bg-rose-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-rose-900 uppercase tracking-wider',
};

const DELAY_GROUP_TD_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border-sky-500/15 border-x bg-sky-500/5 px-2 py-2 text-right font-mono text-sky-950 text-xs',
  nonProduction:
    'whitespace-nowrap border-amber-500/15 border-x bg-amber-500/5 px-2 py-2 text-right font-mono text-amber-950 text-xs',
  engineering:
    'whitespace-nowrap border-rose-500/15 border-x bg-rose-500/5 px-2 py-2 text-right font-mono text-rose-950 text-xs',
};

const HIGH_AVAILABILITY_THRESHOLD = 80;
const MED_AVAILABILITY_THRESHOLD = 60;
const HIGH_UTILIZATION_THRESHOLD = 75;
const MED_UTILIZATION_THRESHOLD = 50;
const DECIMAL_PLACES_ONE = 1;
const TOP_BOTTLENECK_LIMIT = 4;
const EMPTY_ENGINEERING_LOGS: readonly EngineeringLogItem[] = [];

export interface MachineMonthlySummaryTabProps {
  selectedMonth: string;
  onSelectMonth: (monthPrefix: string) => void;
  shiftType: 'day' | 'night';
  onShiftTypeChange: (shift: 'day' | 'night') => void;
  summaryRows: readonly MachineMonthlySummaryRow[];
  archivedSnapshots: readonly ArchivedMachineMonthSnapshot[];
  isMonthSealed: boolean;
  onArchiveAndSealMonth: () => void;
  onInspectMachine30Day: (machineId: string) => void;
  engineeringLogs?: readonly EngineeringLogItem[];
}

export function MachineMonthlySummaryTab({
  selectedMonth,
  onSelectMonth,
  shiftType,
  onShiftTypeChange,
  summaryRows,
  archivedSnapshots,
  isMonthSealed,
  onArchiveAndSealMonth,
  onInspectMachine30Day,
  engineeringLogs = EMPTY_ENGINEERING_LOGS,
}: MachineMonthlySummaryTabProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [showBoardroomPrintModal, setShowBoardroomPrintModal] = useState(false);

  const filteredSummaryRows = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    if (!query) return summaryRows;
    return summaryRows.filter(
      (row) =>
        row.machineName.toLowerCase().includes(query) ||
        row.machineType.toLowerCase().includes(query) ||
        row.siteName.toLowerCase().includes(query)
    );
  }, [summaryRows, searchFilter]);

  const monthEngineeringLogs = useMemo(
    () => engineeringLogs.filter((item) => item.date.startsWith(selectedMonth)),
    [engineeringLogs, selectedMonth]
  );

  // Derive Predictive Maintenance Metrics for all machines
  const predictiveMetrics = useMemo(() => {
    return summaryRows.map((row) =>
      computeMachinePredictiveMetrics({
        summaryRow: row,
        dayRows: [],
        engineeringLogs: monthEngineeringLogs,
      })
    );
  }, [summaryRows, monthEngineeringLogs]);

  const topBottleneckMachines = useMemo(
    () =>
      [...summaryRows]
        .sort(
          (a, b) =>
            (b.delays.breakdown ?? 0) - (a.delays.breakdown ?? 0) ||
            a.availabilityPercent - b.availabilityPercent
        )
        .slice(0, TOP_BOTTLENECK_LIMIT),
    [summaryRows]
  );

  const fleetTotals = summaryRows.reduce(
    (acc, row) => {
      acc.totalSmrWorked += row.totalSmrWorked;
      acc.totalDelayHours += row.totalDelayHours;
      acc.availabilitySum += row.availabilityPercent;
      acc.utilizationSum += row.utilizationPercent;
      for (const col of OVERVIEW_DELAY_COLUMNS) {
        acc.delays[col.key] = (acc.delays[col.key] ?? 0) + (row.delays[col.key] ?? 0);
      }
      return acc;
    },
    {
      totalSmrWorked: 0,
      totalDelayHours: 0,
      availabilitySum: 0,
      utilizationSum: 0,
      delays: {} as Record<OverviewDelayKey, number>,
    }
  );

  const machineCount = summaryRows.length || 1;
  const fleetAvgAvailability = Number(
    (fleetTotals.availabilitySum / machineCount).toFixed(DECIMAL_PLACES_ONE)
  );
  const fleetAvgUtilization = Number(
    (fleetTotals.utilizationSum / machineCount).toFixed(DECIMAL_PLACES_ONE)
  );
  const totalBreakdownHours = fleetTotals.delays.breakdown ?? 0;

  const handleExportMonthlyCsv = () => {
    const headers = [
      'Machine ID',
      'Category',
      'Site',
      'Opening SMR',
      'Closing SMR',
      'Total SMR Worked (h)',
      ...OVERVIEW_DELAY_COLUMNS.map((c) => `${c.label} (h)`),
      'Days Logged',
      'Availability (%)',
      'Utilization (%)',
    ];
    const lines = summaryRows.map((r) => [
      r.machineName,
      r.machineType,
      r.siteName,
      r.openingSmr.toFixed(DECIMAL_PLACES_ONE),
      r.closingSmr.toFixed(DECIMAL_PLACES_ONE),
      r.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE),
      ...OVERVIEW_DELAY_COLUMNS.map((c) => (r.delays[c.key] ?? 0).toFixed(DECIMAL_PLACES_ONE)),
      `${r.activeDaysLogged}/${r.daysInMonth}`,
      r.availabilityPercent.toFixed(DECIMAL_PLACES_ONE),
      r.utilizationPercent.toFixed(DECIMAL_PLACES_ONE),
    ]);
    const csv = [
      headers.join(','),
      ...lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')),
    ].join('\n');
    if (typeof window !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fleet-monthly-summary-${selectedMonth}-${shiftType}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    toast.success(`Exported ${selectedMonth} Fleet Monthly Summary CSV`);
  };

  return (
    <div className="space-y-6" data-testid="machine-monthly-summary-tab">
      {/* Header & Safe Monthly Archive Controls */}
      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5" />
              CEO &amp; Management Fleet Monthly Availability, Utilization &amp; Delay Rollup
            </div>
            <h3 className="mt-1 font-bold text-[var(--text-heading)] text-lg">
              Monthly Machine Summary — {selectedMonth} ({summaryRows.length} Machines)
            </h3>
            <p className="text-[var(--text-secondary)] text-xs">
              Aggregates each machine&apos;s 30/31-day activity sheet for {selectedMonth}. Click any
              machine row to open its full 30-day table and inspect daily issues, or archive and
              seal previous months into the historical Machine Activity Database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-1.5 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Month:</span>
              <input
                type="month"
                aria-label="Select Summary Month"
                data-testid="monthly-summary-month-input"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) onSelectMonth(e.target.value);
                }}
                className="rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1 font-mono text-[var(--text-heading)] text-xs"
              />
            </label>

            <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-0.5">
              {(['day', 'night'] as const).map((shiftOpt) => (
                <button
                  key={shiftOpt}
                  type="button"
                  onClick={() => onShiftTypeChange(shiftOpt)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 font-semibold text-xs ${
                    shiftType === shiftOpt
                      ? 'bg-[var(--accent-blue)] text-white'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {shiftOpt === 'day' ? 'Day Shift' : 'Night Shift'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowBoardroomPrintModal(true)}
              data-testid="open-boardroom-print-view-btn"
              className={BTN_SECONDARY}
            >
              <Printer className="h-3.5 w-3.5 text-amber-600" />
              Boardroom Print View
            </button>

            <button
              type="button"
              onClick={handleExportMonthlyCsv}
              data-testid="export-monthly-summary-csv-btn"
              className={BTN_SECONDARY}
            >
              <Download className="h-3.5 w-3.5" />
              Export Monthly CSV
            </button>

            <button
              type="button"
              onClick={onArchiveAndSealMonth}
              data-testid="seal-monthly-summary-archive-btn"
              className={BTN_PRIMARY}
            >
              {isMonthSealed ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {isMonthSealed
                ? `Month ${selectedMonth} Archived & Sealed`
                : `Archive & Seal ${selectedMonth} to Machine DB`}
            </button>
          </div>
        </div>

        {/* Fleet Monthly KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Working Fleet Count
            </div>
            <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-xl">
              {summaryRows.length} Machines
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              30-day tables tracked for {selectedMonth}
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Total Monthly SMR Worked
            </div>
            <div className="mt-1 font-bold font-mono text-[var(--accent-blue)] text-xl">
              {fleetTotals.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)} h
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Total Delays: {fleetTotals.totalDelayHours.toFixed(DECIMAL_PLACES_ONE)} h
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Monthly Fleet Availability
            </div>
            <div className="mt-1 font-bold font-mono text-accent-green text-xl">
              {fleetAvgAvailability.toFixed(DECIMAL_PLACES_ONE)}%
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Across all {summaryRows.length} machine 30-day tables
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Monthly Fleet Utilization
            </div>
            <div className="mt-1 font-bold font-mono text-[var(--accent-blue)] text-xl">
              {fleetAvgUtilization.toFixed(DECIMAL_PLACES_ONE)}%
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Archived Months in DB: {archivedSnapshots.length}
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Monthly Breakdowns &amp; Issues
            </div>
            <div className="mt-1 font-bold font-mono text-rose-700 text-xl">
              {monthEngineeringLogs.length} Logs ({totalBreakdownHours.toFixed(DECIMAL_PLACES_ONE)}
              h)
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Engineering &amp; breakdown tickets in {selectedMonth}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Multi-Month Comparative Fleet Trend Graph */}
      <MachineMultiMonthTrendChart
        archivedSnapshots={archivedSnapshots}
        currentMonth={selectedMonth}
        onSelectMonth={onSelectMonth}
      />

      {/* CEO Executive Issue & Bottleneck Digest */}
      <GlassCard className="space-y-4 p-5" data-testid="ceo-monthly-issue-digest">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-700" />
            <h4 className="font-bold text-[var(--text-heading)] text-sm uppercase tracking-wider">
              CEO &amp; Management Executive Issue &amp; Bottleneck Digest — {selectedMonth}
            </h4>
          </div>
          <span className="text-[var(--text-secondary)] text-xs">
            Lowest-availability / highest-breakdown machines and underlying engineering logs
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Priority Attention Machines */}
          <div className="space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-[var(--text-heading)] uppercase">
                Priority Bottleneck Machines (Highest Downtime / Lowest Availability)
              </span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                Click to inspect 30-day daily logs
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {topBottleneckMachines.map((row) => (
                <div
                  key={`bottleneck-${row.machineId}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-white p-2.5"
                >
                  <div>
                    <div className="font-bold text-[var(--text-heading)] text-xs">
                      {row.machineName}{' '}
                      <span className="font-normal text-[10px] text-[var(--text-secondary)]">
                        ({row.siteName})
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                      Avail:{' '}
                      <strong className="text-amber-700">
                        {row.availabilityPercent.toFixed(DECIMAL_PLACES_ONE)}%
                      </strong>{' '}
                      · Breakdown:{' '}
                      <strong className="text-rose-700">
                        {(row.delays.breakdown ?? 0).toFixed(DECIMAL_PLACES_ONE)}h
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectMachine30Day(row.machineId)}
                    data-testid={`digest-open-machine-30d-${row.machineId}`}
                    className={BTN_OUTLINE}
                  >
                    Inspect
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Underlying Engineering & Breakdown Tickets */}
          <div className="space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-bold text-[11px] text-[var(--text-heading)] uppercase">
                <Wrench className="h-3.5 w-3.5 text-rose-700" />
                Monthly Breakdowns &amp; Engineering Notes ({monthEngineeringLogs.length})
              </span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                Period: {selectedMonth}
              </span>
            </div>

            {monthEngineeringLogs.length === 0 ? (
              <p className="rounded-lg border border-[var(--border-default)] bg-white p-3 text-[var(--text-secondary)] text-xs">
                No open breakdowns or critical engineering tickets logged for {selectedMonth}. Open
                any machine&apos;s 30-Day Sheet below to inspect daily shift notes and delay
                buckets.
              </p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {monthEngineeringLogs.map((log) => {
                  const matchedMachine = summaryRows.find(
                    (r) =>
                      log.machineName &&
                      (r.machineName.toLowerCase() === log.machineName.toLowerCase() ||
                        log.machineName.toLowerCase().includes(r.machineName.toLowerCase()))
                  );
                  return (
                    <div
                      key={log.id}
                      className="rounded-lg border border-rose-500/25 bg-white p-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[var(--text-heading)]">
                          {log.date} · {log.machineName ?? 'Site-Wide'} · {log.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-mono font-semibold text-[10px] text-rose-900 uppercase">
                            {log.severity} · {log.status}
                          </span>
                          {matchedMachine && (
                            <button
                              type="button"
                              onClick={() => onInspectMachine30Day(matchedMachine.machineId)}
                              className={BTN_OUTLINE}
                            >
                              30d Sheet
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-[var(--text-heading)]">{log.description}</p>
                      {log.actionTaken && (
                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                          <strong>Action Taken:</strong> {log.actionTaken}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Archived Months Vault Strip (Safe Historical Machine Activity Database) */}
      <GlassCard className="space-y-3 p-5" data-testid="archived-machine-months-vault">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--accent-blue)]" />
            <h4 className="font-bold text-[var(--text-heading)] text-sm uppercase tracking-wider">
              Safe Monthly Machine Activity Database ({archivedSnapshots.length} Archived Months)
            </h4>
          </div>
          <span className="text-[var(--text-secondary)] text-xs">
            Select any archived month below to load its 30-day per-machine tables
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {archivedSnapshots.map((snap) => {
            const isSelected = snap.month === selectedMonth;
            return (
              <div
                key={snap.month}
                data-testid={`archived-month-card-${snap.month}`}
                className={`rounded-xl border p-3.5 transition-colors ${
                  isSelected
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/8'
                    : 'border-[var(--border-default)] bg-[var(--bg-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
                    {snap.month}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/15 px-2 py-0.5 font-semibold text-[10px] text-accent-green">
                    <Lock className="h-2.5 w-2.5" />
                    {snap.isSealed ? 'Sealed Archive' : 'Active Month'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Machines</div>
                    <div className="font-bold text-[var(--text-heading)]">{snap.machineCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">SMR Worked</div>
                    <div className="font-bold text-[var(--accent-blue)]">
                      {snap.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)}h
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Avail / Util</div>
                    <div className="font-bold text-accent-green">
                      {snap.fleetAvailabilityPercent.toFixed(DECIMAL_PLACES_ONE)}% /{' '}
                      {snap.fleetUtilizationPercent.toFixed(DECIMAL_PLACES_ONE)}%
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSelectMonth(snap.month)}
                    data-testid={`load-archived-month-${snap.month}`}
                    className={BTN_OUTLINE}
                  >
                    {isSelected ? 'Viewing Month' : `Load ${snap.month} Tables`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Full Fleet Monthly Summary Table (Matching /control-room/engineering-notes columns) */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-b px-4 py-3">
          <div>
            <h4 className="font-bold text-[var(--text-heading)] text-sm">
              All Fleet Monthly Machine Rollup ({filteredSummaryRows.length} of {summaryRows.length}{' '}
              Machines)
            </h4>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Click any row or &ldquo;30-Day Sheet&rdquo; to inspect that machine&apos;s daily SMR,
              delays, and breakdown logs for {selectedMonth}
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              aria-label="Filter Monthly Summary Machines"
              data-testid="monthly-summary-search-input"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter machine, type, site..."
              className="w-56 rounded-lg border border-[var(--border-default)] bg-white py-1 pr-2.5 pl-8 text-[var(--text-heading)] text-xs"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table
            aria-label={`Monthly Machine Summary Table for ${selectedMonth}`}
            className="min-w-full border-collapse text-left text-xs"
          >
            <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/80">
              <tr>
                <th className={TH_BASE}>Machine ID</th>
                <th className={TH_NUM}>Start SMR</th>
                <th className={TH_NUM}>Stop SMR</th>
                <th className={TH_NUM}>Total SMR Worked</th>
                {OVERVIEW_DELAY_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    data-delay-group={col.delayGroup}
                    className={DELAY_GROUP_TH_CLASS[col.delayGroup]}
                  >
                    <div>{col.label}</div>
                  </th>
                ))}
                <th className={TH_NUM}>Days Logged</th>
                <th className={TH_NUM}>Availability</th>
                <th className={TH_NUM}>Utilization</th>
                <th className={TH_BASE}>30-Day Table</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-white/80">
              {filteredSummaryRows.map((row) => (
                <tr
                  key={row.machineId}
                  onClick={() => onInspectMachine30Day(row.machineId)}
                  data-testid={`monthly-summary-row-${row.machineId}`}
                  className="cursor-pointer transition-colors hover:bg-[var(--bg-secondary)]/50"
                >
                  <td className={TD_BASE}>
                    <div className="font-bold text-[var(--text-heading)]">{row.machineName}</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {row.machineType} · {row.siteName}
                    </div>
                  </td>
                  <td className={`${TD_BASE} text-right font-mono`}>
                    {row.openingSmr.toFixed(DECIMAL_PLACES_ONE)}
                  </td>
                  <td className={`${TD_BASE} text-right font-mono`}>
                    {row.closingSmr.toFixed(DECIMAL_PLACES_ONE)}
                  </td>
                  <td
                    className={`${TD_BASE} text-right font-bold font-mono text-[var(--accent-blue)]`}
                  >
                    {row.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)}h
                  </td>
                  {OVERVIEW_DELAY_COLUMNS.map((col) => (
                    <td key={col.key} className={DELAY_GROUP_TD_CLASS[col.delayGroup]}>
                      {(row.delays[col.key] ?? 0).toFixed(DECIMAL_PLACES_ONE)}h
                    </td>
                  ))}
                  <td className={`${TD_BASE} text-right font-mono`}>
                    {row.activeDaysLogged} / {row.daysInMonth}d
                  </td>
                  <td className={`${TD_BASE} text-right font-bold font-mono`}>
                    <span
                      className={
                        row.availabilityPercent >= HIGH_AVAILABILITY_THRESHOLD
                          ? 'text-accent-green'
                          : row.availabilityPercent >= MED_AVAILABILITY_THRESHOLD
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }
                    >
                      {row.availabilityPercent.toFixed(DECIMAL_PLACES_ONE)}%
                    </span>
                  </td>
                  <td className={`${TD_BASE} text-right font-bold font-mono`}>
                    <span
                      className={
                        row.utilizationPercent >= HIGH_UTILIZATION_THRESHOLD
                          ? 'text-[var(--accent-blue)]'
                          : row.utilizationPercent >= MED_UTILIZATION_THRESHOLD
                            ? 'text-[var(--text-heading)]'
                            : 'text-amber-600'
                      }
                    >
                      {row.utilizationPercent.toFixed(DECIMAL_PLACES_ONE)}%
                    </span>
                  </td>
                  <td className={TD_BASE}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectMachine30Day(row.machineId);
                      }}
                      data-testid={`open-machine-30d-${row.machineId}`}
                      className={BTN_OUTLINE}
                    >
                      30-Day Sheet
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Boardroom Executive Modal */}
      {showBoardroomPrintModal && (
        <ExecutiveBoardroomPrintView
          selectedMonth={selectedMonth}
          shiftType={shiftType}
          summaryRows={summaryRows}
          engineeringLogs={engineeringLogs}
          predictiveMetrics={predictiveMetrics}
          onClose={() => setShowBoardroomPrintModal(false)}
        />
      )}
    </div>
  );
}
