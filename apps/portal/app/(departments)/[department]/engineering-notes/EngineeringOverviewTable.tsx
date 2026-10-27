'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, CheckCircle2, RotateCcw, Save, ShieldAlert, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  computeMachineOverviewMetrics,
  createStandardOverviewDelays,
  MAX_SHIFT_HOURS,
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayGroup,
  type OverviewDelayHours,
  type OverviewDelayKey,
  reconcileOverviewShiftHoursOnDelayChange,
  reconcileOverviewShiftHoursOnSmrChange,
  STANDARD_OVERVIEW_DELAY_DEFAULTS,
  validateOverviewRowDelaysAndComment,
} from '@/lib/shift-sheet-buckets';
import { bookOutMachineCarryOverBreakdown, saveMachineOverviewRow } from './actions';

export interface CarryOverBreakdownInfo {
  id: string;
  reason: string;
  dateIn: string;
  timeIn: string | null;
  delayHours: number;
  isFromPreviousShift: boolean;
}

export interface MachineOverviewInitialRow {
  machineId: string;
  machineName: string;
  machineType: string;
  serialNumber: string | null;
  siteId: string | null;
  startSmr: number;
  stopSmr: number;
  operatorId: string | null;
  operatorName: string | null;
  delays: OverviewDelayHours;
  comment: string;
  hasExistingOperation: boolean;
  carryOverBreakdown: CarryOverBreakdownInfo | null;
}

export interface OverviewOperatorOption {
  id: string;
  fullName: string;
  employeeCode: string;
}

interface EngineeringOverviewTableProps {
  departmentId: string;
  shiftDate: string;
  initialShiftType: 'day' | 'night';
  initialRows: MachineOverviewInitialRow[];
  operators: OverviewOperatorOption[];
}

interface EditableMachineRow extends MachineOverviewInitialRow {
  endsOnBreakdown: boolean;
  error: string | null;
  saved: boolean;
}

const TH_BASE =
  'whitespace-nowrap px-2.5 py-2.5 text-left font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TH_NUM =
  'whitespace-nowrap px-2 py-2.5 text-right font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TD_BASE = 'whitespace-nowrap px-2.5 py-2 align-top text-xs';
const INPUT_SMR_CLASS =
  'w-24 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-right font-mono text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]';
const SELECT_OP_CLASS =
  'w-40 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]';
const INPUT_COMMENT_BASE =
  'w-56 rounded-md border bg-white px-2 py-1 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2';
const BTN_PRIMARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs transition-opacity hover:opacity-90 disabled:opacity-50';
const BTN_SECONDARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]';

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
    'whitespace-nowrap border-sky-500/15 border-x bg-sky-500/5 px-2.5 py-2 text-right align-top text-xs',
  nonProduction:
    'whitespace-nowrap border-amber-500/15 border-x bg-amber-500/5 px-2.5 py-2 text-right align-top text-xs',
  engineering:
    'whitespace-nowrap border-rose-500/15 border-x bg-rose-500/5 px-2.5 py-2 text-right align-top text-xs',
};

const DELAY_GROUP_INPUT_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'w-16 rounded-md border border-sky-500/40 bg-sky-50/90 px-1.5 py-1 text-right font-mono text-sky-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500',
  nonProduction:
    'w-16 rounded-md border border-amber-500/40 bg-amber-50/90 px-1.5 py-1 text-right font-mono text-amber-950 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500',
  engineering:
    'w-16 rounded-md border border-rose-500/40 bg-rose-50/90 px-1.5 py-1 text-right font-mono text-rose-950 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500',
};

const DEFAULT_ALLOWANCE_COMMENT =
  'Standard shift allowances (Refueling 0.2h, Safety Talks 0.5h, Lunches 0.5h, GES/Maint 0.5h, Tyres/Trams 0.2h, Greasing/Startup 0.5h)';

export function EngineeringOverviewTable({
  departmentId,
  shiftDate,
  initialShiftType,
  initialRows,
  operators,
}: EngineeringOverviewTableProps) {
  const [shiftType, setShiftType] = useState<'day' | 'night'>(initialShiftType);
  const [savingMachineId, setSavingMachineId] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [bookingOutMachineId, setBookingOutMachineId] = useState<string | null>(null);

  const [rows, setRows] = useState<EditableMachineRow[]>(() =>
    initialRows.map((r) => ({
      ...r,
      comment:
        r.comment ||
        (r.carryOverBreakdown
          ? `[Carry-Over Breakdown] ${r.carryOverBreakdown.reason}`
          : DEFAULT_ALLOWANCE_COMMENT),
      endsOnBreakdown: Boolean(r.carryOverBreakdown) || r.delays.breakdown > 0,
      error: null,
      saved: r.hasExistingOperation,
    }))
  );

  const updateRowSmr = (machineId: string, field: 'startSmr' | 'stopSmr', rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    const val = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    setRows((prev) =>
      prev.map((r) => {
        if (r.machineId !== machineId) return r;
        const reconciled = reconcileOverviewShiftHoursOnSmrChange({
          currentStartSmr: r.startSmr,
          currentStopSmr: r.stopSmr,
          changedField: field,
          nextValue: val,
          delays: r.delays,
          maxShiftHours: MAX_SHIFT_HOURS,
        });
        return {
          ...r,
          startSmr: reconciled.startSmr,
          stopSmr: reconciled.stopSmr,
          delays: reconciled.delays,
          error: null,
          saved: false,
        };
      })
    );
  };

  const updateRowDelay = (machineId: string, key: OverviewDelayKey, rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    const val = Number.isNaN(parsed) ? 0 : Math.min(MAX_SHIFT_HOURS, Math.max(0, parsed));
    setRows((prev) =>
      prev.map((r) => {
        if (r.machineId !== machineId) return r;
        const reconciled = reconcileOverviewShiftHoursOnDelayChange({
          startSmr: r.startSmr,
          stopSmr: r.stopSmr,
          delays: r.delays,
          changedKey: key,
          nextDelayValue: val,
          maxShiftHours: MAX_SHIFT_HOURS,
        });
        const appliedVal = reconciled.delays[key];
        const isAbnormalOrChanged =
          !STANDARD_OVERVIEW_DELAY_DEFAULTS[key] ||
          Math.abs(appliedVal - STANDARD_OVERVIEW_DELAY_DEFAULTS[key]) > 0.001;
        const nextComment =
          isAbnormalOrChanged && r.comment === DEFAULT_ALLOWANCE_COMMENT ? '' : r.comment;

        return {
          ...r,
          startSmr: reconciled.startSmr,
          stopSmr: reconciled.stopSmr,
          delays: reconciled.delays,
          endsOnBreakdown: key === 'breakdown' && appliedVal > 0 ? true : r.endsOnBreakdown,
          comment: nextComment,
          error: null,
          saved: false,
        };
      })
    );
  };

  const updateRowOperator = (machineId: string, operatorId: string) => {
    const opObj = operators.find((o) => o.id === operatorId) ?? null;
    setRows((prev) =>
      prev.map((r) =>
        r.machineId === machineId
          ? {
              ...r,
              operatorId: operatorId || null,
              operatorName: opObj?.fullName ?? null,
              error: null,
              saved: false,
            }
          : r
      )
    );
  };

  const updateRowComment = (machineId: string, comment: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.machineId === machineId
          ? {
              ...r,
              comment,
              error: null,
              saved: false,
            }
          : r
      )
    );
  };

  const toggleEndsOnBreakdown = (machineId: string, checked: boolean) => {
    setRows((prev) =>
      prev.map((r) =>
        r.machineId === machineId
          ? {
              ...r,
              endsOnBreakdown: checked,
              error: null,
              saved: false,
            }
          : r
      )
    );
  };

  const handleResetStandardDefaults = () => {
    setRows((prev) =>
      prev.map((r) => {
        const std = createStandardOverviewDelays();
        if (r.carryOverBreakdown) {
          std.breakdown = r.carryOverBreakdown.delayHours || 12;
        }
        return {
          ...r,
          delays: std,
          comment:
            r.comment.trim() ||
            (r.carryOverBreakdown
              ? `[Carry-Over Breakdown] ${r.carryOverBreakdown.reason}`
              : DEFAULT_ALLOWANCE_COMMENT),
          error: null,
          saved: false,
        };
      })
    );
    toast.info('Reset all machines to standard shift allowance defaults.');
  };

  const validateSingleRow = (row: EditableMachineRow): string | null => {
    if (row.stopSmr < row.startSmr) {
      return 'Stop SMR cannot be less than Start SMR.';
    }
    const rawWorked = Number((row.stopSmr - row.startSmr).toFixed(2));
    if (rawWorked > MAX_SHIFT_HOURS + 0.001) {
      return `Total SMR worked (${rawWorked.toFixed(1)}h) cannot exceed ${MAX_SHIFT_HOURS} hours.`;
    }
    const metrics = computeMachineOverviewMetrics(
      row.startSmr,
      row.stopSmr,
      row.delays,
      MAX_SHIFT_HOURS
    );
    if (rawWorked + metrics.totalDelayHours > MAX_SHIFT_HOURS + 0.01) {
      return `Combined SMR worked (${rawWorked.toFixed(1)}h) and delays (${metrics.totalDelayHours.toFixed(1)}h) cannot exceed ${MAX_SHIFT_HOURS} hours.`;
    }
    const commentValidation = validateOverviewRowDelaysAndComment(row.delays, row.comment);
    if (!commentValidation.valid) {
      return commentValidation.error;
    }
    return null;
  };

  const handleSaveRow = async (machineId: string) => {
    const target = rows.find((r) => r.machineId === machineId);
    if (!target) return;

    const validationError = validateSingleRow(target);
    if (validationError) {
      setRows((prev) =>
        prev.map((r) => (r.machineId === machineId ? { ...r, error: validationError } : r))
      );
      toast.error(`${target.machineName}: ${validationError}`);
      return;
    }

    setSavingMachineId(machineId);
    try {
      await saveMachineOverviewRow({
        departmentId,
        machineId: target.machineId,
        machineName: target.machineName,
        machineType: target.machineType,
        serialNumber: target.serialNumber,
        siteId: target.siteId,
        shiftDate,
        shiftType,
        startSmr: target.startSmr,
        stopSmr: target.stopSmr,
        operatorId: target.operatorId,
        comment: target.comment.trim(),
        endsOnBreakdown: target.endsOnBreakdown,
        delays: target.delays,
      });

      setRows((prev) =>
        prev.map((r) => (r.machineId === machineId ? { ...r, error: null, saved: true } : r))
      );
      toast.success(`Saved overview ledger for ${target.machineName}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save machine row';
      setRows((prev) => prev.map((r) => (r.machineId === machineId ? { ...r, error: msg } : r)));
      toast.error(msg);
    } finally {
      setSavingMachineId(null);
    }
  };

  const handleSaveAllRows = async () => {
    let hasErrors = false;
    const validatedRows = rows.map((r) => {
      const err = validateSingleRow(r);
      if (err) hasErrors = true;
      return { ...r, error: err };
    });

    if (hasErrors) {
      setRows(validatedRows);
      toast.error(
        'Cannot save all rows: Every machine with a recorded delay must have a matching comment.'
      );
      return;
    }

    setIsSavingAll(true);
    try {
      for (const row of rows) {
        await saveMachineOverviewRow({
          departmentId,
          machineId: row.machineId,
          machineName: row.machineName,
          machineType: row.machineType,
          serialNumber: row.serialNumber,
          siteId: row.siteId,
          shiftDate,
          shiftType,
          startSmr: row.startSmr,
          stopSmr: row.stopSmr,
          operatorId: row.operatorId,
          comment: row.comment.trim(),
          endsOnBreakdown: row.endsOnBreakdown,
          delays: row.delays,
        });
      }
      setRows((prev) => prev.map((r) => ({ ...r, error: null, saved: true })));
      toast.success(`Saved all ${rows.length} fleet rows for ${shiftType.toUpperCase()} shift.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save fleet overview rows';
      toast.error(msg);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleBookOutCarryOver = async (row: EditableMachineRow) => {
    setBookingOutMachineId(row.machineId);
    try {
      await bookOutMachineCarryOverBreakdown({
        departmentId,
        machineId: row.machineId,
        machineName: row.machineName,
        serialNumber: row.serialNumber,
        shiftDate,
        repairNotes: row.comment.trim() || 'Booked out from Control Room Overview',
      });

      setRows((prev) =>
        prev.map((r) =>
          r.machineId === row.machineId
            ? {
                ...r,
                carryOverBreakdown: null,
                endsOnBreakdown: false,
                delays: { ...r.delays, breakdown: 0 },
              }
            : r
        )
      );
      toast.success(`${row.machineName} booked out of breakdown and returned to service.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to book out breakdown';
      toast.error(msg);
    } finally {
      setBookingOutMachineId(null);
    }
  };

  const fleetSummary = useMemo(() => {
    if (rows.length === 0) {
      return {
        totalSmrWorked: 0,
        avgAvailability: 0,
        avgUtilization: 0,
        carryOverCount: 0,
      };
    }

    let sumSmr = 0;
    let sumAvail = 0;
    let sumUtil = 0;
    let carryOverCount = 0;

    for (const r of rows) {
      const m = computeMachineOverviewMetrics(r.startSmr, r.stopSmr, r.delays);
      sumSmr += m.totalSmrWorked;
      sumAvail += m.availabilityPercent;
      sumUtil += m.utilizationPercent;
      if (r.carryOverBreakdown || r.endsOnBreakdown) {
        carryOverCount++;
      }
    }

    return {
      totalSmrWorked: Number(sumSmr.toFixed(1)),
      avgAvailability: Number((sumAvail / rows.length).toFixed(1)),
      avgUtilization: Number((sumUtil / rows.length).toFixed(1)),
      carryOverCount,
    };
  }, [rows]);

  return (
    <div className="space-y-4" data-testid="engineering-overview-ledger">
      {/* Top KPI & Standard Allowances Header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlassCard className="p-3.5">
          <span className="block font-semibold text-[11px] text-[var(--text-secondary)] uppercase">
            Working Fleet Count
          </span>
          <span className="mt-1 block font-bold font-mono text-[var(--text-heading)] text-xl">
            {rows.length} Machines
          </span>
        </GlassCard>
        <GlassCard className="p-3.5">
          <span className="block font-semibold text-[11px] text-[var(--text-secondary)] uppercase">
            Total SMR Worked
          </span>
          <span className="mt-1 block font-bold font-mono text-[var(--accent-blue)] text-xl">
            {fleetSummary.totalSmrWorked.toFixed(1)}h
          </span>
        </GlassCard>
        <GlassCard className="p-3.5">
          <span className="block font-semibold text-[11px] text-[var(--text-secondary)] uppercase">
            Fleet Availability
          </span>
          <span className="mt-1 block font-bold font-mono text-accent-green text-xl">
            {fleetSummary.avgAvailability.toFixed(1)}%
          </span>
        </GlassCard>
        <GlassCard className="p-3.5">
          <span className="block font-semibold text-[11px] text-[var(--text-secondary)] uppercase">
            Fleet Utilization
          </span>
          <span className="mt-1 block font-bold font-mono text-[var(--text-heading)] text-xl">
            {fleetSummary.avgUtilization.toFixed(1)}%
          </span>
        </GlassCard>
      </div>

      {/* Controls & Standard Defaults Banner */}
      <GlassCard variant="spotlight" className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <h3 className="font-bold text-[var(--text-heading)] text-sm">
              Full Fleet Shift SMR, Delays, Availability &amp; Utilization Overview
            </h3>
            <p className="text-[var(--text-secondary)] text-xs">
              Standard editable shift defaults:{' '}
              <span className="font-mono font-semibold text-[var(--text-heading)]">
                Refueling = 0.2h · Safety Talks = 0.5h · Lunches = 0.5h · GES / Maintenance = 0.5h ·
                Greasing / Startups = 0.5h · Tyres / Trams = 0.2h
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-900">
                <span className="h-2 w-2 rounded-full bg-sky-600" />
                Production Delays (Blasting, Lunches, Safety Talks, Refueling, No Operator, Standby)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-900">
                <span className="h-2 w-2 rounded-full bg-amber-600" />
                Natural &amp; Other Delays (Natural Delays, Other)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-900">
                <span className="h-2 w-2 rounded-full bg-rose-600" />
                Engineering Delays (GES / Maintenance, Tyres / Trams, Greasing / Startups,
                Breakdown)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-white px-2 py-0.5 font-mono font-semibold text-[var(--text-heading)]">
                Max {MAX_SHIFT_HOURS}.0h / Shift Cap (SMR Worked + Delays &le; {MAX_SHIFT_HOURS}.0h)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Shift Type"
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as 'day' | 'night')}
              className="rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs"
            >
              <option value="day">Day Shift (06:00 - 18:00)</option>
              <option value="night">Night Shift (18:00 - 06:00)</option>
            </select>

            <button type="button" onClick={handleResetStandardDefaults} className={BTN_SECONDARY}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Standard Defaults
            </button>

            <button
              type="button"
              onClick={() => void handleSaveAllRows()}
              disabled={isSavingAll}
              className={BTN_PRIMARY}
            >
              <Save className="h-3.5 w-3.5" />
              {isSavingAll ? 'Saving Fleet...' : 'Save All Rows'}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Full 20-Column Fleet Overview Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
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
                    {col.isStandardAllowance && (
                      <div className={DELAY_GROUP_STD_BADGE_CLASS[col.delayGroup]}>
                        std {col.standardDefault.toFixed(1)}h
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
              {rows.map((row) => {
                const metrics = computeMachineOverviewMetrics(
                  row.startSmr,
                  row.stopSmr,
                  row.delays
                );
                const commentCheck = validateOverviewRowDelaysAndComment(row.delays, row.comment);
                const hasCommentError = !commentCheck.valid || Boolean(row.error);
                const isCarryOver = Boolean(row.carryOverBreakdown);

                return (
                  <tr
                    key={row.machineId}
                    data-testid={`overview-row-${row.machineId}`}
                    className={
                      isCarryOver
                        ? 'bg-red-500/5 hover:bg-red-500/10'
                        : 'hover:bg-[var(--bg-secondary)]/40'
                    }
                  >
                    {/* 1. Machine ID */}
                    <td className={TD_BASE}>
                      <div className="font-bold text-[var(--text-heading)]">{row.machineName}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        {row.serialNumber ? `${row.serialNumber} · ` : ''}
                        {row.machineType}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                        Max {MAX_SHIFT_HOURS}.0h · {metrics.maxProductionAllowedHours.toFixed(1)}h
                        prod left · {metrics.maxDelaysAllowedHours.toFixed(1)}h max delays
                      </div>
                      {row.carryOverBreakdown && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-semibold text-[10px] text-red-600">
                          <ShieldAlert className="h-3 w-3" />
                          {row.carryOverBreakdown.isFromPreviousShift
                            ? `Carried Over Breakdown (Since ${row.carryOverBreakdown.dateIn})`
                            : 'Active Breakdown (Until Booked Out)'}
                        </div>
                      )}
                    </td>

                    {/* 2. Start SMR */}
                    <td className={`${TD_BASE} text-right`}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        aria-label={`Start SMR ${row.machineName}`}
                        value={row.startSmr}
                        onChange={(e) => updateRowSmr(row.machineId, 'startSmr', e.target.value)}
                        className={INPUT_SMR_CLASS}
                      />
                    </td>

                    {/* 3. Stop SMR */}
                    <td className={`${TD_BASE} text-right`}>
                      <input
                        type="number"
                        step="0.1"
                        min={row.startSmr}
                        max={Number((row.startSmr + MAX_SHIFT_HOURS).toFixed(2))}
                        aria-label={`Stop SMR ${row.machineName}`}
                        value={row.stopSmr}
                        onChange={(e) => updateRowSmr(row.machineId, 'stopSmr', e.target.value)}
                        className={INPUT_SMR_CLASS}
                      />
                    </td>

                    {/* 4. Total SMR Worked */}
                    <td
                      className={`${TD_BASE} text-right font-bold font-mono text-[var(--accent-blue)]`}
                    >
                      <div>{metrics.totalSmrWorked.toFixed(1)}h</div>
                      <div className="font-normal text-[10px] text-[var(--text-secondary)]">
                        {metrics.maxDelaysAllowedHours.toFixed(1)}h delay cap
                      </div>
                    </td>

                    {/* 5..16. All 12 Delay Columns */}
                    {OVERVIEW_DELAY_COLUMNS.map((col) => {
                      const val = row.delays[col.key] ?? 0;
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
                            aria-label={`${col.label} ${row.machineName}`}
                            value={val}
                            onChange={(e) => updateRowDelay(row.machineId, col.key, e.target.value)}
                            className={DELAY_GROUP_INPUT_CLASS[col.delayGroup]}
                          />
                        </td>
                      );
                    })}

                    {/* 17. Operator */}
                    <td className={TD_BASE}>
                      <select
                        aria-label={`Operator ${row.machineName}`}
                        value={row.operatorId ?? ''}
                        onChange={(e) => updateRowOperator(row.machineId, e.target.value)}
                        className={SELECT_OP_CLASS}
                      >
                        <option value="">
                          {row.operatorName ? `${row.operatorName}` : 'Select operator...'}
                        </option>
                        {operators.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.fullName} ({op.employeeCode})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 18. Comments (to add notes) + Breakdown Carry-Over Toggle */}
                    <td className={TD_BASE}>
                      <div className="space-y-1">
                        <input
                          type="text"
                          aria-label={`Comments ${row.machineName}`}
                          placeholder={
                            commentCheck.hasRecordedDelay
                              ? 'Required comment for recorded delay(s)...'
                              : 'Add shift note or comment...'
                          }
                          value={row.comment}
                          onChange={(e) => updateRowComment(row.machineId, e.target.value)}
                          className={`${INPUT_COMMENT_BASE} ${
                            hasCommentError
                              ? 'border-red-500 bg-red-500/5 focus:ring-red-500'
                              : 'border-[var(--border-default)] focus:ring-[var(--accent-blue)]'
                          }`}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                            <input
                              type="checkbox"
                              checked={row.endsOnBreakdown}
                              onChange={(e) =>
                                toggleEndsOnBreakdown(row.machineId, e.target.checked)
                              }
                              className="h-3.5 w-3.5 rounded border-[var(--border-default)]"
                            />
                            <span>Ends shift on breakdown (carry over)</span>
                          </label>
                          {!row.comment.trim() && !commentCheck.hasNonStandardDelay && (
                            <button
                              type="button"
                              onClick={() =>
                                updateRowComment(row.machineId, DEFAULT_ALLOWANCE_COMMENT)
                              }
                              className="cursor-pointer font-semibold text-[10px] text-[var(--accent-blue)] hover:underline"
                            >
                              Fill std note
                            </button>
                          )}
                        </div>
                        {hasCommentError && (
                          <p className="max-w-xs whitespace-normal font-medium text-[10px] text-red-600">
                            {row.error || commentCheck.error}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* 19. Availability (%) */}
                    <td className={`${TD_BASE} text-right font-bold font-mono`}>
                      <span
                        className={
                          metrics.availabilityPercent >= 80
                            ? 'text-accent-green'
                            : metrics.availabilityPercent >= 60
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }
                      >
                        {metrics.availabilityPercent.toFixed(1)}%
                      </span>
                      <div className="font-normal text-[10px] text-[var(--text-secondary)]">
                        {metrics.availableHours.toFixed(1)}h avail
                      </div>
                    </td>

                    {/* 20. Utilization (%) */}
                    <td className={`${TD_BASE} text-right font-bold font-mono`}>
                      <span
                        className={
                          metrics.utilizationPercent >= 75
                            ? 'text-[var(--accent-blue)]'
                            : metrics.utilizationPercent >= 50
                              ? 'text-[var(--text-heading)]'
                              : 'text-amber-600'
                        }
                      >
                        {metrics.utilizationPercent.toFixed(1)}%
                      </span>
                      <div className="font-normal text-[10px] text-[var(--text-secondary)]">
                        {metrics.totalDelayHours.toFixed(1)}h delays
                      </div>
                      <div className="font-normal text-[9px] text-[var(--text-secondary)]">
                        P:{metrics.productionDelayHours.toFixed(1)}h · N:
                        {metrics.nonProductionDelayHours.toFixed(1)}h · E:
                        {metrics.engineeringDelayHours.toFixed(1)}h
                      </div>
                    </td>

                    {/* 21. Actions (Save Row / Book Out Breakdown) */}
                    <td className={TD_BASE}>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleSaveRow(row.machineId)}
                          disabled={savingMachineId === row.machineId}
                          className={BTN_PRIMARY}
                        >
                          <Save className="h-3 w-3" />
                          {savingMachineId === row.machineId ? 'Saving...' : 'Save'}
                        </button>

                        {row.carryOverBreakdown && (
                          <button
                            type="button"
                            onClick={() => void handleBookOutCarryOver(row)}
                            disabled={bookingOutMachineId === row.machineId}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-accent-green/40 bg-accent-green/10 px-2 py-1 font-semibold text-[10px] text-accent-green hover:bg-accent-green/20"
                          >
                            <Wrench className="h-3 w-3" />
                            {bookingOutMachineId === row.machineId ? 'Booking Out...' : 'Book Out'}
                          </button>
                        )}

                        {row.saved && !hasCommentError && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-accent-green">
                            <CheckCircle2 className="h-3 w-3" />
                            Saved
                          </span>
                        )}
                        {hasCommentError && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            Needs Comment
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
