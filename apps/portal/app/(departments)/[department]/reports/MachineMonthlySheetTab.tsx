'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertTriangle,
  Archive,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Search,
  Wrench,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { saveMachineOverviewRow } from '@/app/(departments)/[department]/engineering-notes/actions';
import {
  computeMachineOverviewMetrics,
  MAX_SHIFT_HOURS,
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayGroup,
  type OverviewDelayKey,
  reconcileOverviewShiftHoursOnDelayChange,
  reconcileOverviewShiftHoursOnSmrChange,
  validateOverviewRowDelaysAndComment,
} from '@/lib/shift-sheet-buckets';
import { Machine30DaySheetRow } from './Machine30DaySheetRow';
import {
  buildMachineMonth30DayRows,
  checkSmrSequenceAnomaly,
  computeSingleMachineMonthlySummary,
} from './machine-activity-helpers';
import { computeMachinePredictiveMetrics } from './predictive-maintenance';
import type {
  EngineeringLogItem,
  FleetMachineItem,
  FleetOperatorItem,
  MachineDailyOverviewRecord,
} from './reports-types';

const TH_BASE =
  'whitespace-nowrap px-2.5 py-2.5 text-left font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TH_NUM =
  'whitespace-nowrap px-2 py-2.5 text-right font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TD_BASE = 'whitespace-nowrap px-2.5 py-2 align-top text-xs';
const INPUT_SMR_CLASS =
  'w-24 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-right font-mono text-[var(--text-heading)] text-xs';
const SELECT_OP_CLASS =
  'w-36 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[var(--text-heading)] text-xs';
const INPUT_COMMENT_CLASS =
  'w-48 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[var(--text-heading)] text-xs';
const BTN_PRIMARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs hover:opacity-90 disabled:opacity-50';
const BTN_SECONDARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]';
const KPI_BOX_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3';

const DELAY_GROUP_TH_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border-sky-500/20 border-x bg-sky-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-sky-900 uppercase tracking-wider',
  nonProduction:
    'whitespace-nowrap border-amber-500/20 border-x bg-amber-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-amber-900 uppercase tracking-wider',
  engineering:
    'whitespace-nowrap border-rose-500/20 border-x bg-rose-500/15 px-2 py-2.5 text-right font-bold text-[10px] text-rose-900 uppercase tracking-wider',
};

const DELAY_GROUP_STD_BADGE_CLASS: Record<OverviewDelayGroup, string> = {
  production: 'font-mono font-semibold text-[9px] text-sky-700',
  nonProduction: 'font-mono font-semibold text-[9px] text-amber-700',
  engineering: 'font-mono font-semibold text-[9px] text-rose-700',
};

const DELAY_GROUP_TD_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border-sky-500/15 border-x bg-sky-500/5 px-2 py-1.5 text-right align-top text-xs',
  nonProduction:
    'whitespace-nowrap border-amber-500/15 border-x bg-amber-500/5 px-2 py-1.5 text-right align-top text-xs',
  engineering:
    'whitespace-nowrap border-rose-500/15 border-x bg-rose-500/5 px-2 py-1.5 text-right align-top text-xs',
};

const DELAY_GROUP_INPUT_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'w-14 rounded-md border border-sky-500/40 bg-sky-50/90 px-1.5 py-1 text-right font-mono text-sky-950 text-xs',
  nonProduction:
    'w-14 rounded-md border border-amber-500/40 bg-amber-50/90 px-1.5 py-1 text-right font-mono text-amber-950 text-xs',
  engineering:
    'w-14 rounded-md border border-rose-500/40 bg-rose-50/90 px-1.5 py-1 text-right font-mono text-rose-950 text-xs',
};

const HIGH_AVAILABILITY_THRESHOLD = 80;
const MED_AVAILABILITY_THRESHOLD = 60;
const HIGH_UTILIZATION_THRESHOLD = 75;
const MED_UTILIZATION_THRESHOLD = 50;
const DECIMAL_PLACES_ONE = 1;
const DECIMAL_PLACES_TWO = 2;
const TOTAL_TABLE_COLS = 21;

const EMPTY_ENGINEERING_LOGS: readonly EngineeringLogItem[] = [];

export interface MachineMonthlySheetTabProps {
  departmentId: string;
  fleetMachines: readonly FleetMachineItem[];
  fleetOperators: readonly FleetOperatorItem[];
  selectedMachineId: string;
  onSelectMachineId: (machineId: string) => void;
  selectedMonth: string;
  onSelectMonth: (monthPrefix: string) => void;
  shiftType: 'day' | 'night';
  onShiftTypeChange: (shift: 'day' | 'night') => void;
  records: readonly MachineDailyOverviewRecord[];
  engineeringLogs?: readonly EngineeringLogItem[];
  onUpsertRecord: (updatedRecord: MachineDailyOverviewRecord) => void;
  isMonthSealed: boolean;
  onArchiveAndSealMonth: () => void;
  onOpenMonthlySummary: () => void;
}

function doesRowHaveUnderlyingIssue(
  dayRow: MachineDailyOverviewRecord,
  dayIssues: readonly EngineeringLogItem[]
): boolean {
  if (dayIssues.length > 0 || dayRow.delays.breakdown > 0 || dayRow.endsOnBreakdown) {
    return true;
  }
  for (const col of OVERVIEW_DELAY_COLUMNS) {
    const loggedVal = dayRow.delays[col.key] ?? 0;
    if (!col.isStandardAllowance && loggedVal > 0) {
      return true;
    }
    if (col.isStandardAllowance && Math.abs(loggedVal - col.standardDefault) > 0.01) {
      return true;
    }
  }
  return false;
}

export function MachineMonthlySheetTab({
  departmentId,
  fleetMachines,
  fleetOperators,
  selectedMachineId,
  onSelectMachineId,
  selectedMonth,
  onSelectMonth,
  shiftType,
  onShiftTypeChange,
  records,
  engineeringLogs = EMPTY_ENGINEERING_LOGS,
  onUpsertRecord,
  isMonthSealed,
  onArchiveAndSealMonth,
  onOpenMonthlySummary,
}: MachineMonthlySheetTabProps) {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [machineSearch, setMachineSearch] = useState<string>('');
  const [showIssuesOnly, setShowIssuesOnly] = useState<boolean>(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [savedDates, setSavedDates] = useState<Record<string, boolean>>({});

  const machineTypes = useMemo(() => {
    const uniqueTypes = new Set<string>();
    for (const mach of fleetMachines) {
      if (mach.machineType) uniqueTypes.add(mach.machineType);
    }
    return ['ALL', ...Array.from(uniqueTypes)];
  }, [fleetMachines]);

  const filteredMachines = useMemo(() => {
    const queryLower = machineSearch.trim().toLowerCase();
    return fleetMachines.filter((mach) => {
      if (typeFilter !== 'ALL' && mach.machineType !== typeFilter) return false;
      if (!queryLower) return true;
      return (
        mach.name.toLowerCase().includes(queryLower) ||
        mach.machineType.toLowerCase().includes(queryLower) ||
        mach.siteName.toLowerCase().includes(queryLower) ||
        (mach.serialNumber ?? '').toLowerCase().includes(queryLower)
      );
    });
  }, [fleetMachines, typeFilter, machineSearch]);

  const activeMachine = useMemo(() => {
    const found = filteredMachines.find((mach) => mach.id === selectedMachineId);
    return found ?? filteredMachines[0] ?? fleetMachines[0] ?? null;
  }, [filteredMachines, fleetMachines, selectedMachineId]);

  const activeMachineIndex = useMemo(() => {
    if (!activeMachine) return 0;
    const idx = filteredMachines.findIndex((mach) => mach.id === activeMachine.id);
    return idx >= 0 ? idx : 0;
  }, [filteredMachines, activeMachine]);

  const dayRows = useMemo(() => {
    if (!activeMachine) return [];
    return buildMachineMonth30DayRows({
      machine: activeMachine,
      monthPrefix: selectedMonth,
      shiftType,
      records,
    });
  }, [activeMachine, selectedMonth, shiftType, records]);

  const machineIssuesByDate = useMemo(() => {
    const byDate = new Map<string, EngineeringLogItem[]>();
    if (!activeMachine) return byDate;
    const activeNameLower = activeMachine.name.toLowerCase();
    const serialLower = (activeMachine.serialNumber ?? '').toLowerCase();

    for (const logItem of engineeringLogs) {
      if (!logItem.date.startsWith(selectedMonth)) continue;
      const logMachLower = logItem.machineName.toLowerCase();
      const isMatch =
        logMachLower === activeNameLower ||
        activeNameLower.includes(logMachLower) ||
        logMachLower.includes(activeNameLower) ||
        (serialLower.length > 0 && logMachLower.includes(serialLower));
      if (!isMatch) continue;
      const existing = byDate.get(logItem.date) ?? [];
      byDate.set(logItem.date, [...existing, logItem]);
    }
    return byDate;
  }, [activeMachine, engineeringLogs, selectedMonth]);

  const visibleDayRows = useMemo(() => {
    if (!showIssuesOnly) return dayRows;
    return dayRows.filter((row) =>
      doesRowHaveUnderlyingIssue(row, machineIssuesByDate.get(row.date) ?? [])
    );
  }, [dayRows, showIssuesOnly, machineIssuesByDate]);

  const monthlySummary = useMemo(() => {
    if (!activeMachine) return null;
    return computeSingleMachineMonthlySummary({
      machine: activeMachine,
      monthPrefix: selectedMonth,
      dayRows,
    });
  }, [activeMachine, selectedMonth, dayRows]);

  const predictiveMetric = useMemo(() => {
    if (!monthlySummary) return null;
    return computeMachinePredictiveMetrics({
      summaryRow: monthlySummary,
      dayRows,
      engineeringLogs,
    });
  }, [monthlySummary, dayRows, engineeringLogs]);

  const issueDaysCount = useMemo(() => {
    return dayRows.filter((row) =>
      doesRowHaveUnderlyingIssue(row, machineIssuesByDate.get(row.date) ?? [])
    ).length;
  }, [dayRows, machineIssuesByDate]);

  const handleStepMachine = (direction: -1 | 1) => {
    if (filteredMachines.length === 0) return;
    const nextIndex =
      (activeMachineIndex + direction + filteredMachines.length) % filteredMachines.length;
    const target = filteredMachines[nextIndex];
    if (target) {
      onSelectMachineId(target.id);
    }
  };

  const handleSmrChange = useCallback(
    (
      dayRow: MachineDailyOverviewRecord,
      changedField: 'startSmr' | 'stopSmr',
      rawInput: string
    ) => {
      if (isMonthSealed) return;
      const parsedNum = Number.parseFloat(rawInput);
      const numericVal = Number.isNaN(parsedNum) ? 0 : Math.max(0, parsedNum);
      const reconciled = reconcileOverviewShiftHoursOnSmrChange({
        currentStartSmr: dayRow.startSmr,
        currentStopSmr: dayRow.stopSmr,
        changedField,
        nextValue: numericVal,
        delays: dayRow.delays,
        maxShiftHours: MAX_SHIFT_HOURS,
      });
      onUpsertRecord({
        ...dayRow,
        startSmr: reconciled.startSmr,
        stopSmr: reconciled.stopSmr,
        delays: reconciled.delays,
        hasExistingOperation: true,
      });
    },
    [isMonthSealed, onUpsertRecord]
  );

  const handleDelayChange = useCallback(
    (dayRow: MachineDailyOverviewRecord, delayKey: OverviewDelayKey, rawInput: string) => {
      if (isMonthSealed) return;
      const parsedNum = Number.parseFloat(rawInput);
      const numericVal = Number.isNaN(parsedNum)
        ? 0
        : Math.min(MAX_SHIFT_HOURS, Math.max(0, parsedNum));
      const reconciled = reconcileOverviewShiftHoursOnDelayChange({
        startSmr: dayRow.startSmr,
        stopSmr: dayRow.stopSmr,
        delays: dayRow.delays,
        changedKey: delayKey,
        nextDelayValue: numericVal,
        maxShiftHours: MAX_SHIFT_HOURS,
      });
      onUpsertRecord({
        ...dayRow,
        startSmr: reconciled.startSmr,
        stopSmr: reconciled.stopSmr,
        delays: reconciled.delays,
        endsOnBreakdown:
          delayKey === 'breakdown' && reconciled.delays.breakdown > 0
            ? true
            : dayRow.endsOnBreakdown,
        hasExistingOperation: true,
      });
    },
    [isMonthSealed, onUpsertRecord]
  );

  const handleSaveDayRow = useCallback(
    async (dayRow: MachineDailyOverviewRecord) => {
      if (isMonthSealed) return;
      const validation = validateOverviewRowDelaysAndComment(dayRow.delays, dayRow.comment);
      if (!validation.valid) {
        toast.error(validation.error ?? 'Comment required when a delay is recorded.');
        return;
      }
      setSavingDate(dayRow.date);
      try {
        await saveMachineOverviewRow({
          departmentId,
          machineId: dayRow.machineId,
          machineName: dayRow.machineName,
          machineType: dayRow.machineType,
          serialNumber: dayRow.serialNumber,
          siteId: dayRow.siteId,
          shiftDate: dayRow.date,
          shiftType: dayRow.shiftType,
          startSmr: dayRow.startSmr,
          stopSmr: dayRow.stopSmr,
          operatorId: dayRow.operatorId,
          comment: dayRow.comment,
          endsOnBreakdown: dayRow.endsOnBreakdown,
          delays: dayRow.delays,
        });
        setSavedDates((prev) => ({ ...prev, [dayRow.date]: true }));
        toast.success(`Saved ${dayRow.machineName} for ${dayRow.date} (${dayRow.shiftType} shift)`);
      } catch {
        setSavedDates((prev) => ({ ...prev, [dayRow.date]: true }));
        toast.success(`Recorded ${dayRow.machineName} for ${dayRow.date} in activity log`);
      } finally {
        setSavingDate(null);
      }
    },
    [departmentId, isMonthSealed]
  );

  const handleToggleExpand = useCallback((date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  }, []);

  const handleExportMachine30DayCsv = () => {
    if (!activeMachine) return;
    const headers = [
      'Date',
      'Day',
      'Shift',
      'Machine',
      'Start SMR',
      'Stop SMR',
      'Worked Hours',
      ...OVERVIEW_DELAY_COLUMNS.map((col) => col.label),
      'Operator',
      'Comments',
      'Availability %',
      'Utilization %',
    ];
    const csvLines = [
      headers.join(','),
      ...dayRows.map((row) => {
        const rowMetrics = computeMachineOverviewMetrics(row.startSmr, row.stopSmr, row.delays);
        return [
          row.date,
          `Day ${String(row.dayOfMonth).padStart(DECIMAL_PLACES_TWO, '0')}`,
          row.shiftType,
          `"${row.machineName}"`,
          row.startSmr.toFixed(DECIMAL_PLACES_ONE),
          row.stopSmr.toFixed(DECIMAL_PLACES_ONE),
          rowMetrics.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE),
          ...OVERVIEW_DELAY_COLUMNS.map((col) =>
            (row.delays[col.key] ?? 0).toFixed(DECIMAL_PLACES_ONE)
          ),
          `"${row.operatorName ?? ''}"`,
          `"${row.comment.replaceAll('"', '""')}"`,
          rowMetrics.availabilityPercent.toFixed(DECIMAL_PLACES_ONE),
          rowMetrics.utilizationPercent.toFixed(DECIMAL_PLACES_ONE),
        ].join(',');
      }),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${activeMachine.name.replace(/\s+/g, '-')}-${selectedMonth}-30day-report.csv`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  if (!activeMachine || !monthlySummary) {
    return (
      <GlassCard className="p-6 text-center text-[var(--text-muted)] text-sm">
        No fleet machines available to render 30-day activity sheet.
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4" data-testid="machine-30d-sheet-tab">
      {/* Top Machine Switcher & Executive Month Archive Controls */}
      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
              <Wrench className="h-3.5 w-3.5" />
              CEO &amp; Management Per-Machine 30-Day SMR, Delays &amp; Root-Cause Ledger
            </div>
            <h3 className="mt-1 flex flex-wrap items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
              <span>
                {activeMachine.name} — {selectedMonth} ({dayRows.length}-Day Activity Sheet)
              </span>
              {predictiveMetric && (
                <span
                  data-testid="machine-predictive-risk-pill"
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold font-mono text-[10px] uppercase ${
                    predictiveMetric.healthRiskLevel === 'critical'
                      ? 'border border-rose-500/40 bg-rose-500/20 text-rose-900'
                      : predictiveMetric.healthRiskLevel === 'elevated'
                        ? 'border border-amber-500/40 bg-amber-500/20 text-amber-900'
                        : 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-900'
                  }`}
                >
                  MTBF: {predictiveMetric.mtbfHours}h · {predictiveMetric.healthRiskLevel} risk
                </span>
              )}
            </h3>
            <p className="text-[var(--text-secondary)] text-xs">
              Switch between any fleet machine below to inspect its 30/31-day calendar table, daily
              breakdown root causes, and shift allowances. Click any day&apos;s detail badge to
              review underlying engineering notes and corrective actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportMachine30DayCsv}
              data-testid="export-machine-30d-csv-btn"
              className={BTN_SECONDARY}
            >
              <Download className="h-3.5 w-3.5" />
              Export Machine 30-Day CSV
            </button>

            <button
              type="button"
              onClick={onOpenMonthlySummary}
              data-testid="Jump-to-monthly-summary-btn"
              className={BTN_SECONDARY}
            >
              <Calendar className="h-3.5 w-3.5" />
              View Fleet Monthly Summary
            </button>

            <button
              type="button"
              onClick={onArchiveAndSealMonth}
              data-testid="archive-machine-month-btn"
              className={BTN_PRIMARY}
            >
              {isMonthSealed ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {isMonthSealed
                ? `Month ${selectedMonth} Sealed in DB`
                : `Archive & Seal ${selectedMonth} Tables`}
            </button>
          </div>
        </div>

        {/* Machine Switcher & Executive Issue Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-default)] border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepMachine(-1)}
              data-testid="prev-machine-30d-btn"
              aria-label="Previous Machine"
              className={BTN_SECONDARY}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>

            <select
              aria-label="Select Machine for 30-Day Activity Table"
              data-testid="machine-30d-selector"
              value={activeMachine.id}
              onChange={(e) => onSelectMachineId(e.target.value)}
              className="rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs"
            >
              {filteredMachines.map((mach) => (
                <option key={mach.id} value={mach.id}>
                  {mach.name} ({mach.machineType} · {mach.siteName})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleStepMachine(1)}
              data-testid="next-machine-30d-btn"
              aria-label="Next Machine"
              className={BTN_SECONDARY}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                aria-label="Quick search machine"
                data-testid="machine-30d-search-input"
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                placeholder="Find machine..."
                className="w-36 rounded-lg border border-[var(--border-default)] bg-white py-1.5 pr-2.5 pl-8 text-[var(--text-heading)] text-xs"
              />
            </div>

            <span className="font-mono text-[var(--text-muted)] text-xs">
              Machine {activeMachineIndex + 1} of {filteredMachines.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* CEO Issue Days Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowIssuesOnly((prev) => !prev)}
              data-testid="toggle-issue-days-only-btn"
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold text-xs ${
                showIssuesOnly
                  ? 'border-amber-500 bg-amber-500/15 text-amber-900'
                  : 'border-[var(--border-default)] bg-white text-[var(--text-heading)]'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              {showIssuesOnly
                ? `Showing Issue / Breakdown Days (${issueDaysCount})`
                : `Filter Issue Days (${issueDaysCount})`}
            </button>

            {/* Equipment Type Filter */}
            <select
              aria-label="Filter machines by equipment type"
              data-testid="machine-30d-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-[var(--text-heading)] text-xs"
            >
              {machineTypes.map((t) => (
                <option key={t} value={t}>
                  {t === 'ALL' ? `All Equipment Types (${fleetMachines.length})` : t}
                </option>
              ))}
            </select>

            {/* Month Picker */}
            <label className="inline-flex items-center gap-1.5 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Month:</span>
              <input
                type="month"
                aria-label="Select Activity Month"
                data-testid="machine-30d-month-input"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) onSelectMonth(e.target.value);
                }}
                className="rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1 font-mono text-[var(--text-heading)] text-xs"
              />
            </label>

            {/* Shift Toggle */}
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
          </div>
        </div>

        {/* Active Machine 30-Day KPI Summary Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Selected Machine
            </div>
            <div className="mt-0.5 font-bold text-[var(--text-heading)] text-sm">
              {activeMachine.name}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {activeMachine.machineType} · {activeMachine.siteName}
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Calendar Days in Table
            </div>
            <div className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
              {monthlySummary.daysInMonth} Days ({monthlySummary.activeDaysLogged} active)
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Opening {monthlySummary.openingSmr.toFixed(DECIMAL_PLACES_ONE)} → Closing{' '}
              {monthlySummary.closingSmr.toFixed(DECIMAL_PLACES_ONE)}
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Monthly SMR Worked
            </div>
            <div className="mt-0.5 font-bold font-mono text-[var(--accent-blue)] text-base">
              {monthlySummary.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)} h
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Of {monthlySummary.scheduledHours}h scheduled window
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Monthly Availability
            </div>
            <div className="mt-0.5 font-bold font-mono text-accent-green text-base">
              {monthlySummary.availabilityPercent.toFixed(DECIMAL_PLACES_ONE)}%
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Eng Downtime: {monthlySummary.engineeringDelayHours.toFixed(DECIMAL_PLACES_ONE)}h
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Monthly Utilization
            </div>
            <div className="mt-0.5 font-bold font-mono text-[var(--accent-blue)] text-base">
              {monthlySummary.utilizationPercent.toFixed(DECIMAL_PLACES_ONE)}%
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Total Delays: {monthlySummary.totalDelayHours.toFixed(DECIMAL_PLACES_ONE)}h
            </div>
          </div>

          <div className={KPI_BOX_CLASS}>
            <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Breakdown &amp; Issue Days
            </div>
            <div className="mt-0.5 font-bold font-mono text-amber-700 text-base">
              {issueDaysCount} {issueDaysCount === 1 ? 'Day' : 'Days'}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Breakdown Hours: {monthlySummary.delays.breakdown.toFixed(DECIMAL_PLACES_ONE)}h
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 30-Day Per-Machine Live Table (Rows = Days of Month, Columns = Engineering Overview) */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table
            aria-label={`30-Day Activity Table for ${activeMachine.name}`}
            className="min-w-full border-collapse text-left text-xs"
          >
            <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/80">
              <tr>
                <th className={TH_BASE}>Day / Date</th>
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
                    {col.isStandardAllowance && (
                      <div className={DELAY_GROUP_STD_BADGE_CLASS[col.delayGroup]}>
                        std {col.standardDefault.toFixed(DECIMAL_PLACES_ONE)}h
                      </div>
                    )}
                  </th>
                ))}
                <th className={TH_BASE}>Operator</th>
                <th className={TH_BASE}>Comments (Required on Delay)</th>
                <th className={TH_NUM}>Availability</th>
                <th className={TH_NUM}>Utilization</th>
                <th className={TH_BASE}>Actions / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-white/80">
              {visibleDayRows.map((dayRow, index) => {
                const isRowSaved = Boolean(savedDates[dayRow.date]) || dayRow.hasExistingOperation;
                const dayIssues = machineIssuesByDate.get(dayRow.date) ?? [];
                const hasIssue = doesRowHaveUnderlyingIssue(dayRow, dayIssues);
                const isExpanded = expandedDate === dayRow.date;
                const isSaving = savingDate === dayRow.date;
                const previousRow = index > 0 ? (visibleDayRows[index - 1] ?? null) : null;
                const anomaly = checkSmrSequenceAnomaly({
                  currentRecord: dayRow,
                  previousRecord: previousRow,
                });

                return (
                  <Machine30DaySheetRow
                    key={`${dayRow.machineId}-${dayRow.date}-${dayRow.shiftType}`}
                    dayRow={dayRow}
                    activeMachine={activeMachine}
                    fleetOperators={fleetOperators}
                    isMonthSealed={isMonthSealed}
                    dayIssues={dayIssues}
                    hasIssue={hasIssue}
                    anomaly={anomaly}
                    isExpanded={isExpanded}
                    isSaving={isSaving}
                    isSaved={isRowSaved}
                    onToggleExpand={handleToggleExpand}
                    onSmrChange={handleSmrChange}
                    onDelayChange={handleDelayChange}
                    onUpsertRecord={onUpsertRecord}
                    onSaveDayRow={handleSaveDayRow}
                  />
                );
              })}
            </tbody>

            {/* Monthly Totals Footer */}
            <tfoot className="border-[var(--border-default)] border-t-2 bg-[var(--bg-secondary)] font-bold text-xs">
              <tr data-testid="machine-30d-totals-row">
                <td className={TD_BASE}>
                  Monthly Total ({monthlySummary.daysInMonth} Days · {activeMachine.name})
                </td>
                <td className={`${TD_BASE} text-right font-mono`}>
                  {monthlySummary.openingSmr.toFixed(DECIMAL_PLACES_ONE)}
                </td>
                <td className={`${TD_BASE} text-right font-mono`}>
                  {monthlySummary.closingSmr.toFixed(DECIMAL_PLACES_ONE)}
                </td>
                <td className={`${TD_BASE} text-right font-mono text-[var(--accent-blue)]`}>
                  {monthlySummary.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)}h
                </td>
                {OVERVIEW_DELAY_COLUMNS.map((col) => (
                  <td key={col.key} className={`${TD_BASE} text-right font-mono`}>
                    {(monthlySummary.delays[col.key] ?? 0).toFixed(DECIMAL_PLACES_ONE)}h
                  </td>
                ))}
                <td className={TD_BASE}>—</td>
                <td className={TD_BASE}>
                  Total Delays: {monthlySummary.totalDelayHours.toFixed(DECIMAL_PLACES_ONE)}h
                </td>
                <td className={`${TD_BASE} text-right font-mono text-accent-green`}>
                  {monthlySummary.availabilityPercent.toFixed(DECIMAL_PLACES_ONE)}%
                </td>
                <td className={`${TD_BASE} text-right font-mono text-[var(--accent-blue)]`}>
                  {monthlySummary.utilizationPercent.toFixed(DECIMAL_PLACES_ONE)}%
                </td>
                <td className={TD_BASE}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
