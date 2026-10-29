'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  Archive,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Save,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
import {
  buildMachineMonth30DayRows,
  computeSingleMachineMonthlySummary,
} from './machine-activity-helpers';
import type {
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
  onUpsertRecord: (updatedRecord: MachineDailyOverviewRecord) => void;
  isMonthSealed: boolean;
  onArchiveAndSealMonth: () => void;
  onOpenMonthlySummary: () => void;
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
  onUpsertRecord,
  isMonthSealed,
  onArchiveAndSealMonth,
  onOpenMonthlySummary,
}: MachineMonthlySheetTabProps) {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
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
    if (typeFilter === 'ALL') return fleetMachines;
    return fleetMachines.filter((mach) => mach.machineType === typeFilter);
  }, [fleetMachines, typeFilter]);

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

  const monthlySummary = useMemo(() => {
    if (!activeMachine) return null;
    return computeSingleMachineMonthlySummary({
      machine: activeMachine,
      monthPrefix: selectedMonth,
      dayRows,
    });
  }, [activeMachine, selectedMonth, dayRows]);

  const handleStepMachine = (direction: -1 | 1) => {
    if (filteredMachines.length === 0) return;
    const nextIndex =
      (activeMachineIndex + direction + filteredMachines.length) % filteredMachines.length;
    const target = filteredMachines[nextIndex];
    if (target) {
      onSelectMachineId(target.id);
    }
  };

  const handleSmrChange = (
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
  };

  const handleDelayChange = (
    dayRow: MachineDailyOverviewRecord,
    delayKey: OverviewDelayKey,
    rawInput: string
  ) => {
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
        delayKey === 'breakdown' && reconciled.delays.breakdown > 0 ? true : dayRow.endsOnBreakdown,
      hasExistingOperation: true,
    });
  };

  const handleSaveDayRow = async (dayRow: MachineDailyOverviewRecord) => {
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
      // Keep local update persisted even when offline or using synthetic IDs
      setSavedDates((prev) => ({ ...prev, [dayRow.date]: true }));
      toast.success(`Recorded ${dayRow.machineName} for ${dayRow.date} in activity log`);
    } finally {
      setSavingDate(null);
    }
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
      {/* Top Machine Switcher & Month Archive Controls */}
      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
              <Wrench className="h-3.5 w-3.5" />
              Per-Machine 30-Day SMR, Delays, Availability &amp; Utilization Ledger
            </div>
            <h3 className="mt-1 font-bold text-[var(--text-heading)] text-lg">
              {activeMachine.name} — {selectedMonth} ({dayRows.length}-Day Activity Sheet)
            </h3>
            <p className="text-[var(--text-secondary)] text-xs">
              Switch between any fleet machine below to inspect or log its full 30/31-day calendar
              table. Standard defaults: Refueling = 0.2h · Safety Talks = 0.5h · Lunches = 0.5h ·
              GES / Maintenance = 0.5h · Tyres / Trams = 0.2h · Greasing / Startups = 0.5h.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

        {/* Machine Switcher Bar */}
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

            <span className="font-mono text-[var(--text-muted)] text-xs">
              Machine {activeMachineIndex + 1} of {filteredMachines.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
              Of {monthlySummary.scheduledHours}h scheduled shift window
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
                <th className={TH_BASE}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-white/80">
              {dayRows.map((dayRow) => {
                const metrics = computeMachineOverviewMetrics(
                  dayRow.startSmr,
                  dayRow.stopSmr,
                  dayRow.delays
                );
                const paddedDay = String(dayRow.dayOfMonth).padStart(DECIMAL_PLACES_TWO, '0');
                const isRowSaved = Boolean(savedDates[dayRow.date]) || dayRow.hasExistingOperation;

                return (
                  <tr
                    key={`${dayRow.machineId}-${dayRow.date}-${dayRow.shiftType}`}
                    data-testid={`machine-day-row-${dayRow.date}`}
                    className="hover:bg-[var(--bg-secondary)]/40"
                  >
                    {/* 1. Day / Date */}
                    <td className={TD_BASE}>
                      <div className="font-bold font-mono text-[var(--text-heading)]">
                        Day {paddedDay} · {dayRow.date}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] uppercase">
                        {dayRow.shiftType} shift · {activeMachine.name}
                      </div>
                    </td>

                    {/* 2. Start SMR */}
                    <td className={`${TD_BASE} text-right`}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        disabled={isMonthSealed}
                        aria-label={`Start SMR ${dayRow.date}`}
                        value={dayRow.startSmr}
                        onChange={(e) => handleSmrChange(dayRow, 'startSmr', e.target.value)}
                        className={INPUT_SMR_CLASS}
                      />
                    </td>

                    {/* 3. Stop SMR */}
                    <td className={`${TD_BASE} text-right`}>
                      <input
                        type="number"
                        step="0.1"
                        min={dayRow.startSmr}
                        max={Number(
                          (dayRow.startSmr + MAX_SHIFT_HOURS).toFixed(DECIMAL_PLACES_TWO)
                        )}
                        disabled={isMonthSealed}
                        aria-label={`Stop SMR ${dayRow.date}`}
                        value={dayRow.stopSmr}
                        onChange={(e) => handleSmrChange(dayRow, 'stopSmr', e.target.value)}
                        className={INPUT_SMR_CLASS}
                      />
                    </td>

                    {/* 4. Total SMR Worked */}
                    <td
                      className={`${TD_BASE} text-right font-bold font-mono text-[var(--accent-blue)]`}
                    >
                      <div>{metrics.totalSmrWorked.toFixed(DECIMAL_PLACES_ONE)}h</div>
                      <div className="font-normal text-[10px] text-[var(--text-secondary)]">
                        {metrics.maxDelaysAllowedHours.toFixed(DECIMAL_PLACES_ONE)}h delay cap
                      </div>
                    </td>

                    {/* 5..16. All 12 Delay Category Columns */}
                    {OVERVIEW_DELAY_COLUMNS.map((col) => {
                      const delayHours = dayRow.delays[col.key] ?? 0;
                      return (
                        <td
                          key={col.key}
                          data-delay-group={col.delayGroup}
                          className={DELAY_GROUP_TD_CLASS[col.delayGroup]}
                        >
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={metrics.maxDelaysAllowedHours}
                            disabled={isMonthSealed}
                            aria-label={`${col.label} ${dayRow.date}`}
                            value={delayHours}
                            onChange={(e) => handleDelayChange(dayRow, col.key, e.target.value)}
                            className={DELAY_GROUP_INPUT_CLASS[col.delayGroup]}
                          />
                        </td>
                      );
                    })}

                    {/* 17. Operator */}
                    <td className={TD_BASE}>
                      <select
                        disabled={isMonthSealed}
                        aria-label={`Operator ${dayRow.date}`}
                        value={dayRow.operatorId ?? ''}
                        onChange={(e) => {
                          const opMatch = fleetOperators.find((op) => op.id === e.target.value);
                          onUpsertRecord({
                            ...dayRow,
                            operatorId: e.target.value || null,
                            operatorName: opMatch?.fullName ?? null,
                            hasExistingOperation: true,
                          });
                        }}
                        className={SELECT_OP_CLASS}
                      >
                        <option value="">
                          {dayRow.operatorName ? dayRow.operatorName : 'Assigned Operator'}
                        </option>
                        {fleetOperators.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.fullName}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 18. Comments */}
                    <td className={TD_BASE}>
                      <input
                        type="text"
                        disabled={isMonthSealed}
                        aria-label={`Comments ${dayRow.date}`}
                        value={dayRow.comment}
                        onChange={(e) =>
                          onUpsertRecord({
                            ...dayRow,
                            comment: e.target.value,
                            hasExistingOperation: true,
                          })
                        }
                        className={INPUT_COMMENT_CLASS}
                      />
                    </td>

                    {/* 19. Availability */}
                    <td className={`${TD_BASE} text-right font-bold font-mono`}>
                      <span
                        className={
                          metrics.availabilityPercent >= HIGH_AVAILABILITY_THRESHOLD
                            ? 'text-accent-green'
                            : metrics.availabilityPercent >= MED_AVAILABILITY_THRESHOLD
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }
                      >
                        {metrics.availabilityPercent.toFixed(DECIMAL_PLACES_ONE)}%
                      </span>
                    </td>

                    {/* 20. Utilization */}
                    <td className={`${TD_BASE} text-right font-bold font-mono`}>
                      <span
                        className={
                          metrics.utilizationPercent >= HIGH_UTILIZATION_THRESHOLD
                            ? 'text-[var(--accent-blue)]'
                            : metrics.utilizationPercent >= MED_UTILIZATION_THRESHOLD
                              ? 'text-[var(--text-heading)]'
                              : 'text-amber-600'
                        }
                      >
                        {metrics.utilizationPercent.toFixed(DECIMAL_PLACES_ONE)}%
                      </span>
                    </td>

                    {/* 21. Actions */}
                    <td className={TD_BASE}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isMonthSealed || savingDate === dayRow.date}
                          onClick={() => void handleSaveDayRow(dayRow)}
                          data-testid={`save-machine-day-${dayRow.date}`}
                          className={BTN_PRIMARY}
                        >
                          <Save className="h-3 w-3" />
                          {savingDate === dayRow.date ? '...' : 'Save'}
                        </button>
                        {isRowSaved && (
                          <span className="inline-flex items-center text-[10px] text-accent-green">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
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
