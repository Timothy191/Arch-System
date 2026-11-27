'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudRain,
  Gauge,
  Lock,
  RotateCcw,
  Save,
  ShieldAlert,
  Truck,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  buildCarryOverBreakdownDelays,
  computeMachineOverviewMetrics,
  createStandardOverviewDelays,
  MAX_SHIFT_HOURS,
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayGroup,
  type OverviewDelayHours,
  type OverviewDelayKey,
  reconcileOverviewShiftHoursOnDelayChange,
  reconcileOverviewShiftHoursOnSmrChange,
  reconcileShortShiftHours,
  STANDARD_OVERVIEW_DELAY_DEFAULTS,
  validateOverviewRowDelaysAndComment,
  validateSmrOdometerEntry,
} from '@/lib/shift-sheet-buckets';
import { bookOutMachineCarryOverBreakdown, saveMachineOverviewRow } from './actions';
import { MachineLogFormModal, type MachineLogFormSavePayload } from './MachineLogFormModal';
import { QuickDelayLoggerPanel } from './QuickDelayLoggerPanel';
import { useWeatherNaturalDelayMonitor } from './useWeatherNaturalDelayMonitor';

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
  siteName: string | null;
  startSmr: number;
  stopSmr: number;
  previousClosingSmr?: number;
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
  previousClosingSmr: number;
  endsOnBreakdown: boolean;
  error: string | null;
  saved: boolean;
}

const TH_BASE =
  'whitespace-nowrap border border-slate-300/90 px-2.5 py-2.5 text-center align-middle font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TH_NUM =
  'whitespace-nowrap border border-slate-300/90 px-2 py-2.5 text-center align-middle font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TD_BASE =
  'whitespace-nowrap border border-slate-300/90 px-2.5 py-2 text-center align-middle text-xs';
const INPUT_READONLY_CLASS =
  'w-24 cursor-not-allowed rounded-md border border-slate-300 bg-slate-100/90 px-2 py-1 text-center font-mono text-slate-700 text-xs';
const SELECT_OP_CLASS =
  'w-40 rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-center text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]';
const INPUT_COMMENT_BASE =
  'w-56 rounded-md border bg-white px-2 py-1 text-center text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2';
const BTN_PRIMARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs transition-opacity hover:opacity-90 disabled:opacity-50';
const BTN_SECONDARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]';

const DELAY_GROUP_TH_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border border-slate-300/90 border-x border-x-sky-600/40 bg-sky-500/15 px-2 py-2.5 text-center align-middle font-bold text-[10px] text-sky-900 uppercase tracking-wider',
  nonProduction:
    'whitespace-nowrap border border-slate-300/90 border-x border-x-amber-600/40 bg-amber-500/15 px-2 py-2.5 text-center align-middle font-bold text-[10px] text-amber-900 uppercase tracking-wider',
  engineering:
    'whitespace-nowrap border border-slate-300/90 border-x border-x-rose-600/40 bg-rose-500/15 px-2 py-2.5 text-center align-middle font-bold text-[10px] text-rose-900 uppercase tracking-wider',
};

const DELAY_GROUP_STD_BADGE_CLASS: Record<OverviewDelayGroup, string> = {
  production: 'font-mono font-semibold text-[9px] text-sky-700',
  nonProduction: 'font-mono font-semibold text-[9px] text-amber-700',
  engineering: 'font-mono font-semibold text-[9px] text-rose-700',
};

const DELAY_GROUP_TD_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'whitespace-nowrap border border-slate-300/90 border-x border-x-sky-600/40 bg-sky-50/5 px-2.5 py-2 text-center align-middle text-xs',
  nonProduction:
    'whitespace-nowrap border border-slate-300/90 border-x border-x-amber-600/40 bg-amber-50/5 px-2.5 py-2 text-center align-middle text-xs',
  engineering:
    'whitespace-nowrap border border-slate-300/90 border-x border-x-rose-600/40 bg-rose-50/5 px-2.5 py-2 text-center align-middle text-xs',
};

const DELAY_GROUP_INPUT_CLASS: Record<OverviewDelayGroup, string> = {
  production:
    'w-16 rounded-md border border-sky-500/40 bg-sky-50/90 px-1.5 py-1 text-center font-mono text-sky-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500',
  nonProduction:
    'w-16 rounded-md border border-amber-500/40 bg-amber-50/90 px-1.5 py-1 text-center font-mono text-amber-950 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500',
  engineering:
    'w-16 rounded-md border border-rose-500/40 bg-rose-50/90 px-1.5 py-1 text-center font-mono text-rose-950 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500',
};

const DEFAULT_ALLOWANCE_COMMENT =
  'Standard shift allowances (Refueling 0.2h, Safety Talks 0.5h, Lunches 0.5h, GES/Maint 0.5h, Tyres/Trams 0.2h, Greasing/Startup 0.5h)';
const STRICT_HOURS_EPSILON = 0.001;
const ALLOWANCE_DIFF_EPSILON = 0.01;
const DECIMAL_PLACES_TWO = 2;
const HIGH_AVAILABILITY_THRESHOLD = 80;
const MED_AVAILABILITY_THRESHOLD = 60;
const HIGH_UTILIZATION_THRESHOLD = 75;
const MED_UTILIZATION_THRESHOLD = 50;
const AVAILABILITY_TARGET_PERCENT = 85;
const UTILIZATION_TARGET_PERCENT = 75;
const PERCENT_SCALE_MAX = 100;

const REPORTING_CARD_CLASS =
  'gold-steel-border gold-steel-border-slim flex flex-col justify-between gap-3 border border-[var(--border-default)] bg-white/95 p-4 shadow-xs';
const REPORTING_LABEL_CLASS =
  'font-bold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider';
const REPORTING_PILL_BASE =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono font-semibold text-[10px] tabular-nums';
const REPORTING_TRACK_CLASS = 'relative h-2 w-full overflow-hidden rounded-full bg-slate-100';

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
  const [selectedQuickMachineId, setSelectedQuickMachineId] = useState<string>(
    () => initialRows[0]?.machineId ?? ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [isSimplifiedView, setIsSimplifiedView] = useState(false);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const [timeUnit, setTimeUnit] = useState<'hours' | 'minutes'>('hours');
  const [logFormModalMachineId, setLogFormModalMachineId] = useState<string | null>(null);

  const [rows, setRows] = useState<EditableMachineRow[]>(() =>
    initialRows.map((r) => ({
      ...r,
      previousClosingSmr: r.previousClosingSmr ?? r.startSmr,
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

  // Item 8: Weather-linked Natural Delays auto-monitor hook
  const weatherMonitor = useWeatherNaturalDelayMonitor({
    departmentId,
    shiftDate,
    shiftType,
    onAutoLogNaturalDelay: (hours, reason) => {
      setRows((prev) =>
        prev.map((r) => {
          if ((r.delays.natural ?? 0) >= hours) return r;
          const reconciled = reconcileOverviewShiftHoursOnDelayChange({
            startSmr: r.startSmr,
            stopSmr: r.stopSmr,
            delays: r.delays,
            changedKey: 'natural',
            nextDelayValue: hours,
            maxShiftHours: MAX_SHIFT_HOURS,
          });
          const existingComment = r.comment.trim();
          const autoComment = `[Weather Delay Auto-Monitor] ${reason}`;
          const nextComment = existingComment ? `${existingComment}; ${autoComment}` : autoComment;
          return {
            ...r,
            delays: reconciled.delays,
            comment: nextComment,
            saved: false,
          };
        })
      );
    },
  });

  const updateRowSmr = (
    machineId: string,
    change: { field: 'startSmr' | 'stopSmr'; rawValue: string }
  ) => {
    const targetRow = rows.find((r) => r.machineId === machineId);
    if (!targetRow) return;

    // Item 4: Start SMR is immutable when previousClosingSmr > 0
    if (change.field === 'startSmr' && (targetRow.previousClosingSmr ?? 0) > 0) {
      toast.error(`${targetRow.machineName}: Start SMR is immutable and cannot be edited.`);
      return;
    }

    const parsed = Number.parseFloat(change.rawValue);
    const val = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);

    const preview = reconcileOverviewShiftHoursOnSmrChange({
      currentStartSmr: targetRow.startSmr,
      currentStopSmr: targetRow.stopSmr,
      changedField: change.field,
      nextValue: val,
      delays: targetRow.delays,
      maxShiftHours: MAX_SHIFT_HOURS,
      minAllowedStartSmr: targetRow.previousClosingSmr,
    });
    if (preview.smrViolation) {
      toast.error(`${targetRow.machineName}: ${preview.smrViolation}`);
    }

    setRows((prev) =>
      prev.map((r) => {
        if (r.machineId !== machineId) return r;
        const reconciled = reconcileOverviewShiftHoursOnSmrChange({
          currentStartSmr: r.startSmr,
          currentStopSmr: r.stopSmr,
          changedField: change.field,
          nextValue: val,
          delays: r.delays,
          maxShiftHours: MAX_SHIFT_HOURS,
          minAllowedStartSmr: r.previousClosingSmr,
        });
        return {
          ...r,
          startSmr: reconciled.startSmr,
          stopSmr: reconciled.stopSmr,
          delays: reconciled.delays,
          error: reconciled.smrViolation,
          saved: false,
        };
      })
    );
  };

  const updateRowDelay = (
    machineId: string,
    change: { key: OverviewDelayKey; rawValue: string }
  ) => {
    // Item 11: Compulsory lunches locked at 0.5h
    if (change.key === 'lunches') return;

    const parsed = Number.parseFloat(change.rawValue);
    const rawVal = Number.isNaN(parsed) ? 0 : Math.min(MAX_SHIFT_HOURS, Math.max(0, parsed));
    // Item 12: Safety Talks min 0.5h
    const val = change.key === 'safetyTalks' ? Math.max(0.5, rawVal) : rawVal;

    const targetRow = rows.find((r) => r.machineId === machineId);

    // Item 10: Site-Wide Blasting Delays Auto-Propagation notification
    if (change.key === 'blasting' && targetRow?.siteId) {
      const otherSiteMachines = rows.filter(
        (r) => r.siteId === targetRow.siteId && r.machineId !== machineId
      );
      if (otherSiteMachines.length > 0) {
        toast.info(
          `Blasting delay (${val.toFixed(1)}h) auto-propagated to ${otherSiteMachines.length} other machine(s) across site.`
        );
      }
    }

    setRows((prev) =>
      prev.map((r) => {
        const isTarget = r.machineId === machineId;
        const isSameSite = targetRow?.siteId && r.siteId === targetRow.siteId;
        if (!isTarget && (!isSameSite || change.key !== 'blasting')) return r;

        const reconciled = reconcileOverviewShiftHoursOnDelayChange({
          startSmr: r.startSmr,
          stopSmr: r.stopSmr,
          delays: r.delays,
          changedKey: change.key,
          nextDelayValue: val,
          maxShiftHours: MAX_SHIFT_HOURS,
        });
        const appliedVal = reconciled.delays[change.key];
        const isAbnormalOrChanged =
          !STANDARD_OVERVIEW_DELAY_DEFAULTS[change.key] ||
          Math.abs(appliedVal - STANDARD_OVERVIEW_DELAY_DEFAULTS[change.key]) >
            STRICT_HOURS_EPSILON;

        let nextComment = r.comment;
        if (isSameSite && !isTarget) {
          const blastingNote = `Site blasting delay (${appliedVal.toFixed(1)}h)`;
          nextComment =
            r.comment && r.comment !== DEFAULT_ALLOWANCE_COMMENT
              ? `${r.comment}; ${blastingNote}`
              : blastingNote;
        } else if (isAbnormalOrChanged && r.comment === DEFAULT_ALLOWANCE_COMMENT) {
          nextComment = '';
        }

        return {
          ...r,
          startSmr: reconciled.startSmr,
          stopSmr: reconciled.stopSmr,
          delays: reconciled.delays,
          endsOnBreakdown: change.key === 'breakdown' && appliedVal > 0 ? true : r.endsOnBreakdown,
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
      prev.map((r) => {
        if (r.machineId !== machineId) return r;
        const nextComment =
          checked && (!r.comment.trim() || r.comment === DEFAULT_ALLOWANCE_COMMENT)
            ? '[Breakdown Carry-Over] Machine ends shift on breakdown'
            : r.comment;
        return {
          ...r,
          endsOnBreakdown: checked,
          comment: nextComment,
          error: null,
          saved: false,
        };
      })
    );
  };

  const handleShiftTypeChange = (nextShift: 'day' | 'night') => {
    if (nextShift === shiftType) return;
    const carriedOverMachines = rows.filter(
      (r) => r.endsOnBreakdown || Boolean(r.carryOverBreakdown)
    ).length;

    setRows((prev) =>
      prev.map((r) => {
        const nextStartSmr = r.stopSmr >= r.startSmr ? r.stopSmr : r.startSmr;
        if (r.endsOnBreakdown || r.carryOverBreakdown) {
          const rawReason = r.carryOverBreakdown?.reason
            ? r.carryOverBreakdown.reason
            : r.comment && r.comment !== DEFAULT_ALLOWANCE_COMMENT
              ? r.comment.replace(/^\[(Carry-Over Breakdown|Breakdown Carry-Over)\]\s*/i, '').trim()
              : 'Ended previous shift on breakdown';
          const carryOverInfo: CarryOverBreakdownInfo = {
            id: r.carryOverBreakdown?.id ?? `carry-over-${r.machineId}-${shiftDate}`,
            reason: rawReason || 'Ended previous shift on breakdown',
            dateIn: r.carryOverBreakdown?.dateIn ?? shiftDate,
            timeIn: r.carryOverBreakdown?.timeIn ?? null,
            delayHours: MAX_SHIFT_HOURS,
            isFromPreviousShift: true,
          };
          return {
            ...r,
            startSmr: nextStartSmr,
            stopSmr: nextStartSmr,
            previousClosingSmr: nextStartSmr,
            delays: buildCarryOverBreakdownDelays({
              carryOverDelayHours: MAX_SHIFT_HOURS,
              startSmr: nextStartSmr,
              stopSmr: nextStartSmr,
            }),
            carryOverBreakdown: carryOverInfo,
            endsOnBreakdown: true,
            comment: `[Carry-Over Breakdown] ${carryOverInfo.reason}`,
            error: null,
            saved: false,
          };
        }

        return {
          ...r,
          startSmr: nextStartSmr,
          stopSmr: nextStartSmr,
          previousClosingSmr: nextStartSmr,
          delays: createStandardOverviewDelays(),
          comment: DEFAULT_ALLOWANCE_COMMENT,
          error: null,
          saved: false,
        };
      })
    );

    setShiftType(nextShift);
    if (carriedOverMachines > 0) {
      toast.info(
        `Switched to ${nextShift.toUpperCase()} shift · ${carriedOverMachines} breakdown machine${carriedOverMachines === 1 ? '' : 's'} auto-carried over.`
      );
    }
  };

  const handleResetStandardDefaults = () => {
    setRows((prev) =>
      prev.map((r) => {
        const std = r.carryOverBreakdown
          ? buildCarryOverBreakdownDelays({
              carryOverDelayHours: r.carryOverBreakdown.delayHours || MAX_SHIFT_HOURS,
              startSmr: r.startSmr,
              stopSmr: r.stopSmr,
            })
          : createStandardOverviewDelays();
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
    const smrCheck = validateSmrOdometerEntry({
      startSmr: row.startSmr,
      stopSmr: row.stopSmr,
      minAllowedStartSmr: row.previousClosingSmr,
      maxAllowedShiftHours: MAX_SHIFT_HOURS,
    });
    if (!smrCheck.valid) {
      return smrCheck.error;
    }
    const rawWorked = Number((row.stopSmr - row.startSmr).toFixed(DECIMAL_PLACES_TWO));
    if (rawWorked > MAX_SHIFT_HOURS + STRICT_HOURS_EPSILON) {
      return `Total SMR worked (${rawWorked.toFixed(1)}h) cannot exceed ${MAX_SHIFT_HOURS} hours.`;
    }
    const metrics = computeMachineOverviewMetrics(
      row.startSmr,
      row.stopSmr,
      row.delays,
      MAX_SHIFT_HOURS
    );
    if (rawWorked + metrics.totalDelayHours > MAX_SHIFT_HOURS + ALLOWANCE_DIFF_EPSILON) {
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

    // Item 13: Auto-reconcile shortfall (50/50 split between refueling and gesMaintenance)
    const reconciledShortfall = reconcileShortShiftHours({
      startSmr: target.startSmr,
      stopSmr: target.stopSmr,
      delays: target.delays,
      comment: target.comment,
      maxShiftHours: MAX_SHIFT_HOURS,
    });

    const activeDelays = reconciledShortfall.delays;
    const activeComment = reconciledShortfall.comment;
    const candidateRow = {
      ...target,
      delays: activeDelays,
      comment: activeComment,
    };

    const validationError = validateSingleRow(candidateRow);
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
        comment: activeComment.trim(),
        endsOnBreakdown: target.endsOnBreakdown,
        delays: activeDelays,
      });

      setRows((prev) =>
        prev.map((r) =>
          r.machineId === machineId
            ? {
                ...r,
                delays: activeDelays,
                comment: activeComment,
                error: null,
                saved: true,
              }
            : r
        )
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
    const reconciledRows = rows.map((r) => {
      const rec = reconcileShortShiftHours({
        startSmr: r.startSmr,
        stopSmr: r.stopSmr,
        delays: r.delays,
        comment: r.comment,
        maxShiftHours: MAX_SHIFT_HOURS,
      });
      const candidateRow = { ...r, delays: rec.delays, comment: rec.comment };
      const err = validateSingleRow(candidateRow);
      if (err) hasErrors = true;
      return { ...candidateRow, error: err };
    });

    if (hasErrors) {
      setRows(reconciledRows);
      toast.error(
        'Cannot save all rows: Every machine with a recorded delay must have a matching comment.'
      );
      return;
    }

    setIsSavingAll(true);
    try {
      for (const row of reconciledRows) {
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
      setRows(reconciledRows.map((r) => ({ ...r, error: null, saved: true })));
      toast.success(`Saved all ${rows.length} fleet rows for ${shiftType.toUpperCase()} shift.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save fleet overview rows';
      toast.error(msg);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleLogFormSave = async (payload: MachineLogFormSavePayload) => {
    const target = rows.find((r) => r.machineId === payload.machineId);
    if (!target) return;

    const opObj = operators.find((op) => op.id === payload.operatorId);

    const reconciledShortfall = reconcileShortShiftHours({
      startSmr: target.startSmr,
      stopSmr: payload.stopSmr,
      delays: payload.delays,
      comment: payload.comment,
      maxShiftHours: MAX_SHIFT_HOURS,
    });

    setSavingMachineId(payload.machineId);
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
        stopSmr: payload.stopSmr,
        operatorId: payload.operatorId,
        comment: reconciledShortfall.comment.trim(),
        endsOnBreakdown: payload.endsOnBreakdown,
        delays: reconciledShortfall.delays,
      });

      setRows((prev) =>
        prev.map((r) =>
          r.machineId === payload.machineId
            ? {
                ...r,
                operatorId: payload.operatorId,
                operatorName: opObj?.fullName ?? null,
                stopSmr: payload.stopSmr,
                delays: reconciledShortfall.delays,
                comment: reconciledShortfall.comment,
                endsOnBreakdown: payload.endsOnBreakdown,
                error: null,
                saved: true,
              }
            : r
        )
      );
      setLogFormModalMachineId(null);
      toast.success(`Saved log form for ${target.machineName}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save log form';
      toast.error(msg);
    } finally {
      setSavingMachineId(null);
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
        operatingCount: 0,
        standbyCount: 0,
        breakdownCount: 0,
        avgSmrPerMachine: 0,
        maxFleetHours: 0,
        smrCapacityPct: 0,
        totalProductionDelayHours: 0,
        totalNonProductionDelayHours: 0,
        totalEngineeringDelayHours: 0,
      };
    }

    let sumSmr = 0;
    let sumAvail = 0;
    let sumUtil = 0;
    let carryOverCount = 0;
    let operatingCount = 0;
    let breakdownCount = 0;
    let totalProductionDelayHours = 0;
    let totalNonProductionDelayHours = 0;
    let totalEngineeringDelayHours = 0;

    for (const r of rows) {
      const m = computeMachineOverviewMetrics(r.startSmr, r.stopSmr, r.delays);
      sumSmr += m.totalSmrWorked;
      sumAvail += m.availabilityPercent;
      sumUtil += m.utilizationPercent;
      totalProductionDelayHours += m.productionDelayHours;
      totalNonProductionDelayHours += m.nonProductionDelayHours;
      totalEngineeringDelayHours += m.engineeringDelayHours;

      const isBreakdown =
        Boolean(r.carryOverBreakdown) || r.endsOnBreakdown || r.delays.breakdown > 0;
      if (r.carryOverBreakdown || r.endsOnBreakdown) {
        carryOverCount++;
      }
      if (isBreakdown) {
        breakdownCount++;
      } else if (m.totalSmrWorked > 0) {
        operatingCount++;
      }
    }

    const maxFleetHours = rows.length * MAX_SHIFT_HOURS;
    const standbyCount = Math.max(0, rows.length - operatingCount - breakdownCount);
    const smrCapacityPct =
      maxFleetHours > 0
        ? Math.min(
            PERCENT_SCALE_MAX,
            Number(((sumSmr / maxFleetHours) * PERCENT_SCALE_MAX).toFixed(1))
          )
        : 0;

    return {
      totalSmrWorked: Number(sumSmr.toFixed(1)),
      avgAvailability: Number((sumAvail / rows.length).toFixed(1)),
      avgUtilization: Number((sumUtil / rows.length).toFixed(1)),
      carryOverCount,
      operatingCount,
      standbyCount,
      breakdownCount,
      avgSmrPerMachine: Number((sumSmr / rows.length).toFixed(1)),
      maxFleetHours,
      smrCapacityPct,
      totalProductionDelayHours: Number(totalProductionDelayHours.toFixed(1)),
      totalNonProductionDelayHours: Number(totalNonProductionDelayHours.toFixed(1)),
      totalEngineeringDelayHours: Number(totalEngineeringDelayHours.toFixed(1)),
    };
  }, [rows]);

  const visibleDelayColumns = useMemo(
    () =>
      isSimplifiedView
        ? OVERVIEW_DELAY_COLUMNS.filter((col) => !col.isStandardAllowance)
        : OVERVIEW_DELAY_COLUMNS,
    [isSimplifiedView]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedTypeFilter === 'abnormal') {
        const hasAbnormal =
          Boolean(r.carryOverBreakdown) ||
          r.endsOnBreakdown ||
          OVERVIEW_DELAY_COLUMNS.some((col) => {
            const std = STANDARD_OVERVIEW_DELAY_DEFAULTS[col.key] ?? 0;
            return Math.abs((r.delays[col.key] ?? 0) - std) > ALLOWANCE_DIFF_EPSILON;
          });
        if (!hasAbnormal) return false;
      } else if (
        selectedTypeFilter !== 'all' &&
        (r.machineType || 'Other') !== selectedTypeFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        r.machineName.toLowerCase().includes(q) ||
        r.machineType.toLowerCase().includes(q) ||
        (r.serialNumber?.toLowerCase().includes(q) ?? false) ||
        (r.operatorName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, searchQuery, selectedTypeFilter]);

  const availabilityStatus =
    fleetSummary.avgAvailability >= HIGH_AVAILABILITY_THRESHOLD
      ? {
          label: 'On Target',
          toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
          barClass: 'bg-emerald-500',
          valueClass: 'text-accent-green',
        }
      : fleetSummary.avgAvailability >= MED_AVAILABILITY_THRESHOLD
        ? {
            label: 'Watch',
            toneClass: 'border-amber-200 bg-amber-50 text-amber-800',
            barClass: 'bg-amber-500',
            valueClass: 'text-amber-600',
          }
        : {
            label: 'Critical',
            toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
            barClass: 'bg-rose-500',
            valueClass: 'text-rose-600',
          };

  const utilizationStatus =
    fleetSummary.avgUtilization >= HIGH_UTILIZATION_THRESHOLD
      ? {
          label: 'Optimal',
          toneClass: 'border-sky-200 bg-sky-50 text-sky-800',
          barClass: 'bg-[var(--accent-blue)]',
          valueClass: 'text-[var(--accent-blue)]',
        }
      : fleetSummary.avgUtilization >= MED_UTILIZATION_THRESHOLD
        ? {
            label: 'Moderate',
            toneClass: 'border-amber-200 bg-amber-50 text-amber-800',
            barClass: 'bg-amber-500',
            valueClass: 'text-[var(--text-heading)]',
          }
        : {
            label: 'Underutilized',
            toneClass: 'border-slate-200 bg-slate-100 text-slate-700',
            barClass: 'bg-slate-400',
            valueClass: 'text-[var(--text-heading)]',
          };

  const operationalReadyPct =
    rows.length > 0
      ? Math.round(((rows.length - fleetSummary.breakdownCount) / rows.length) * PERCENT_SCALE_MAX)
      : 0;

  return (
    <div className="space-y-4" data-testid="engineering-overview-ledger">
      {/* Refined SCADA Executive Reporting Panels */}
      <div
        data-testid="engineering-reporting-panels"
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* Panel 1: Working Fleet Count */}
        <GlassCard data-testid="reporting-panel-working-fleet" className={REPORTING_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={REPORTING_LABEL_CLASS}>Working Fleet Count</span>
              <span className="mt-1 block font-bold font-mono text-2xl text-[var(--text-heading)] tabular-nums">
                {rows.length} Machines
              </span>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
              <Truck className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label="Fleet operational readiness"
              aria-valuenow={operationalReadyPct}
              aria-valuemin={0}
              aria-valuemax={PERCENT_SCALE_MAX}
              className={REPORTING_TRACK_CLASS}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${operationalReadyPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`${REPORTING_PILL_BASE} border-emerald-200 bg-emerald-50 text-emerald-700`}
              >
                Active: {fleetSummary.operatingCount}
              </span>
              <span
                className={`${REPORTING_PILL_BASE} border-slate-200 bg-slate-50 text-slate-700`}
              >
                Standby: {fleetSummary.standbyCount}
              </span>
              <span
                className={`${REPORTING_PILL_BASE} ${
                  fleetSummary.breakdownCount > 0
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                Down: {fleetSummary.breakdownCount}
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Panel 2: Total SMR Worked */}
        <GlassCard data-testid="reporting-panel-total-smr" className={REPORTING_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={REPORTING_LABEL_CLASS}>Total SMR Worked</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-bold font-mono text-2xl text-[var(--accent-blue)] tabular-nums">
                  {fleetSummary.totalSmrWorked.toFixed(1)}h
                </span>
                <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                  / {fleetSummary.maxFleetHours.toFixed(0)}h cap
                </span>
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label="Shift SMR capacity logged"
              aria-valuenow={fleetSummary.smrCapacityPct}
              aria-valuemin={0}
              aria-valuemax={PERCENT_SCALE_MAX}
              className={REPORTING_TRACK_CLASS}
            >
              <div
                className="h-full rounded-full bg-[var(--accent-blue)] transition-all duration-300"
                style={{ width: `${fleetSummary.smrCapacityPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className={`${REPORTING_PILL_BASE} border-sky-200 bg-sky-50 text-sky-800`}>
                Avg {fleetSummary.avgSmrPerMachine.toFixed(1)}h / machine
              </span>
              <span
                className={`${REPORTING_PILL_BASE} border-slate-200 bg-slate-50 text-slate-700`}
              >
                {fleetSummary.smrCapacityPct.toFixed(1)}% shift cap
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Panel 3: Fleet Availability */}
        <GlassCard data-testid="reporting-panel-availability" className={REPORTING_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={REPORTING_LABEL_CLASS}>Fleet Availability</span>
                <span className={`${REPORTING_PILL_BASE} ${availabilityStatus.toneClass}`}>
                  {availabilityStatus.label}
                </span>
              </div>
              <span
                className={`mt-1 block font-bold font-mono text-2xl tabular-nums ${availabilityStatus.valueClass}`}
              >
                {fleetSummary.avgAvailability.toFixed(1)}%
              </span>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label="Fleet availability percentage"
              aria-valuenow={fleetSummary.avgAvailability}
              aria-valuemin={0}
              aria-valuemax={PERCENT_SCALE_MAX}
              className={REPORTING_TRACK_CLASS}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${availabilityStatus.barClass}`}
                style={{ width: `${Math.min(PERCENT_SCALE_MAX, fleetSummary.avgAvailability)}%` }}
              />
              <span
                aria-hidden="true"
                title={`Target ${AVAILABILITY_TARGET_PERCENT}%`}
                className="absolute inset-y-0 w-0.5 bg-slate-700/70"
                style={{ left: `${AVAILABILITY_TARGET_PERCENT}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className={`${REPORTING_PILL_BASE} border-rose-200 bg-rose-50 text-rose-700`}>
                Eng: {fleetSummary.totalEngineeringDelayHours.toFixed(1)}h
              </span>
              <span
                className={`${REPORTING_PILL_BASE} border-slate-200 bg-slate-50 text-slate-700`}
              >
                Target {AVAILABILITY_TARGET_PERCENT}% · {fleetSummary.breakdownCount} BD
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Panel 4: Fleet Utilization */}
        <GlassCard data-testid="reporting-panel-utilization" className={REPORTING_CARD_CLASS}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={REPORTING_LABEL_CLASS}>Fleet Utilization</span>
                <span className={`${REPORTING_PILL_BASE} ${utilizationStatus.toneClass}`}>
                  {utilizationStatus.label}
                </span>
              </div>
              <span
                className={`mt-1 block font-bold font-mono text-2xl tabular-nums ${utilizationStatus.valueClass}`}
              >
                {fleetSummary.avgUtilization.toFixed(1)}%
              </span>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
              <Gauge className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label="Fleet utilization percentage"
              aria-valuenow={fleetSummary.avgUtilization}
              aria-valuemin={0}
              aria-valuemax={PERCENT_SCALE_MAX}
              className={REPORTING_TRACK_CLASS}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${utilizationStatus.barClass}`}
                style={{ width: `${Math.min(PERCENT_SCALE_MAX, fleetSummary.avgUtilization)}%` }}
              />
              <span
                aria-hidden="true"
                title={`Target ${UTILIZATION_TARGET_PERCENT}%`}
                className="absolute inset-y-0 w-0.5 bg-slate-700/70"
                style={{ left: `${UTILIZATION_TARGET_PERCENT}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`${REPORTING_PILL_BASE} border-sky-200 bg-sky-50 text-sky-800`}>
                Prod: {fleetSummary.totalProductionDelayHours.toFixed(1)}h
              </span>
              <span className={`${REPORTING_PILL_BASE} border-rose-200 bg-rose-50 text-rose-700`}>
                Eng: {fleetSummary.totalEngineeringDelayHours.toFixed(1)}h
              </span>
              <span
                className={`${REPORTING_PILL_BASE} border-amber-200 bg-amber-50 text-amber-800`}
              >
                Nat: {fleetSummary.totalNonProductionDelayHours.toFixed(1)}h
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Controls & Standard Defaults Banner (animated legend) */}
      <GlassCard
        variant="spotlight"
        className="fade-in slide-in-from-top-2 animate-in p-4 transition-all duration-500"
      >
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="time-unit-toggle"
                onClick={() => setTimeUnit((prev) => (prev === 'hours' ? 'minutes' : 'hours'))}
                className="gold-steel-border inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]"
              >
                <Clock className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                <span>Time Unit: {timeUnit === 'hours' ? 'Hours (h)' : 'Minutes (m)'}</span>
              </button>
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                0.5h = 30m · 0.2h = 12m
              </span>
            </div>

            <select
              aria-label="Shift Type"
              value={shiftType}
              onChange={(e) => handleShiftTypeChange(e.target.value as 'day' | 'night')}
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

      {/* Guided 3-Step Quick Delay & Shift SMR Logger + Fleet Filter Bar */}
      <QuickDelayLoggerPanel
        rows={rows}
        operators={operators}
        selectedMachineId={selectedQuickMachineId}
        onSelectMachine={setSelectedQuickMachineId}
        onUpdateSmr={updateRowSmr}
        onUpdateDelay={updateRowDelay}
        onUpdateOperator={updateRowOperator}
        onUpdateComment={updateRowComment}
        onToggleBreakdown={toggleEndsOnBreakdown}
        onSaveRow={handleSaveRow}
        savingMachineId={savingMachineId}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedTypeFilter={selectedTypeFilter}
        onTypeFilterChange={setSelectedTypeFilter}
        isSimplifiedView={isSimplifiedView}
        onToggleSimplifiedView={() => setIsSimplifiedView((prev) => !prev)}
      />

      {/* Table collapse toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="table-collapse-toggle"
          onClick={() => setIsTableCollapsed((prev) => !prev)}
          className={BTN_SECONDARY}
        >
          {isTableCollapsed ? 'Expand Table' : 'Collapse Table'}
        </button>
      </div>

      {/* Full 20-Column Fleet Overview Table */}
      {!isTableCollapsed && (
        <GlassCard className="overflow-hidden p-0 transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-400/70 text-center text-xs">
              <thead className="border-slate-400/70 border-b bg-[var(--bg-secondary)]/80">
                <tr>
                  <th className={TH_BASE}>Machine ID</th>
                  <th className={TH_NUM}>Start SMR</th>
                  <th className={TH_NUM}>Stop SMR</th>
                  <th className={TH_NUM}>Total SMR Worked</th>
                  {visibleDelayColumns.map((col) => (
                    <th
                      key={col.key}
                      data-delay-group={col.delayGroup}
                      className={DELAY_GROUP_TH_CLASS[col.delayGroup]}
                    >
                      <div>{col.label}</div>
                      {col.key === 'other' && (
                        <div
                          title="External / Non-Site (e.g. DMRE)"
                          className="font-normal text-[9px] text-amber-900"
                        >
                          External / Non-Site (e.g. DMRE)
                        </div>
                      )}
                      {col.key === 'natural' && weatherMonitor.isWeatherLinked && (
                        <div
                          data-testid="weather-linked-badge"
                          title={
                            weatherMonitor.weatherAlertMessage ??
                            'Weather Linked: Natural delay monitor active'
                          }
                          className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-500/20 px-1 py-0.2 font-semibold text-[9px] text-amber-900"
                        >
                          <CloudRain className="h-2.5 w-2.5" />
                          Weather Linked
                        </div>
                      )}
                      {col.isStandardAllowance && (
                        <div className={DELAY_GROUP_STD_BADGE_CLASS[col.delayGroup]}>
                          std{' '}
                          {timeUnit === 'minutes'
                            ? `${Math.round(col.standardDefault * 60)}m`
                            : `${col.standardDefault.toFixed(1)}h`}
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
              <tbody className="divide-y divide-slate-300/90 bg-white/80">
                {filteredRows.map((row) => {
                  const metrics = computeMachineOverviewMetrics(
                    row.startSmr,
                    row.stopSmr,
                    row.delays
                  );
                  const commentCheck = validateOverviewRowDelaysAndComment(row.delays, row.comment);
                  const hasCommentError = !commentCheck.valid || Boolean(row.error);
                  const isCarryOver = Boolean(row.carryOverBreakdown);
                  const isQuickSelected = row.machineId === selectedQuickMachineId;

                  return (
                    <tr
                      key={row.machineId}
                      data-testid={`overview-row-${row.machineId}`}
                      className={
                        isCarryOver
                          ? 'bg-red-500/5 hover:bg-red-500/10'
                          : isQuickSelected
                            ? 'bg-[var(--accent-blue)]/8 hover:bg-[var(--accent-blue)]/12'
                            : 'hover:bg-[var(--bg-secondary)]/40'
                      }
                    >
                      {/* 1. Machine ID */}
                      <td className={TD_BASE}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-[var(--text-heading)]">
                            {row.machineName}
                          </div>
                          <button
                            type="button"
                            data-testid={`open-log-form-btn-${row.machineId}`}
                            onClick={() => setLogFormModalMachineId(row.machineId)}
                            className="cursor-pointer rounded border border-[var(--accent-blue)]/35 bg-[var(--accent-blue)]/10 px-1.5 py-0.5 font-semibold text-[10px] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20"
                          >
                            Log Form
                          </button>
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">
                          {row.serialNumber ? `${row.serialNumber} · ` : ''}
                          {row.machineType}
                          {row.siteName ? ` · ${row.siteName}` : ''}
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
                      <td className={TD_BASE}>
                        <div className="flex items-center justify-center gap-1">
                          <Lock className="h-3 w-3 text-slate-400" />
                          <input
                            type="number"
                            readOnly
                            aria-readonly="true"
                            aria-label={`Start SMR ${row.machineName}`}
                            value={
                              timeUnit === 'minutes' ? Math.round(row.startSmr * 60) : row.startSmr
                            }
                            className={INPUT_READONLY_CLASS}
                          />
                        </div>
                      </td>

                      {/* 3. Stop SMR (Non-editable in table) */}
                      <td className={TD_BASE}>
                        <input
                          type="number"
                          readOnly
                          aria-readonly="true"
                          title="Editable in Log Form or Quick Logger"
                          aria-label={`Stop SMR ${row.machineName}`}
                          value={
                            timeUnit === 'minutes' ? Math.round(row.stopSmr * 60) : row.stopSmr
                          }
                          className={INPUT_READONLY_CLASS}
                        />
                      </td>

                      {/* 4. Total SMR Worked */}
                      <td className={`${TD_BASE} font-bold font-mono text-[var(--accent-blue)]`}>
                        <div>
                          {timeUnit === 'minutes'
                            ? `${Math.round(metrics.totalSmrWorked * 60)}m`
                            : `${metrics.totalSmrWorked.toFixed(1)}h`}
                        </div>
                        <div className="font-normal text-[10px] text-[var(--text-secondary)]">
                          {timeUnit === 'minutes'
                            ? `${Math.round(metrics.maxDelaysAllowedHours * 60)}m delay cap`
                            : `${metrics.maxDelaysAllowedHours.toFixed(1)}h delay cap`}
                        </div>
                      </td>

                      {/* 5..16. Visible Delay Columns */}
                      {visibleDelayColumns.map((col) => {
                        const val = row.delays[col.key] ?? 0;
                        const isLunch = col.key === 'lunches';
                        const isSafetyTalks = col.key === 'safetyTalks';
                        const displayVal = isLunch
                          ? timeUnit === 'minutes'
                            ? 30
                            : 0.5
                          : timeUnit === 'minutes'
                            ? Math.round(val * 60)
                            : val;

                        return (
                          <td
                            key={col.key}
                            data-delay-group={col.delayGroup}
                            className={DELAY_GROUP_TD_CLASS[col.delayGroup]}
                          >
                            <input
                              type="number"
                              step={timeUnit === 'minutes' ? 1 : 0.1}
                              min={isSafetyTalks ? (timeUnit === 'minutes' ? 30 : 0.5) : 0}
                              max={
                                timeUnit === 'minutes'
                                  ? Math.round(metrics.maxDelaysAllowedHours * 60)
                                  : metrics.maxDelaysAllowedHours
                              }
                              readOnly={isLunch}
                              aria-readonly={isLunch ? 'true' : 'false'}
                              title={isLunch ? 'Compulsory lunch locked at 0.5h' : col.label}
                              aria-label={`${col.label} ${row.machineName}`}
                              value={displayVal}
                              onChange={(e) => {
                                if (isLunch) return;
                                const parsed = Number.parseFloat(e.target.value);
                                const rawHours = Number.isNaN(parsed)
                                  ? 0
                                  : timeUnit === 'minutes'
                                    ? Number((parsed / 60).toFixed(2))
                                    : parsed;
                                updateRowDelay(row.machineId, {
                                  key: col.key,
                                  rawValue: String(rawHours),
                                });
                              }}
                              className={
                                isLunch
                                  ? `${INPUT_READONLY_CLASS} w-16`
                                  : DELAY_GROUP_INPUT_CLASS[col.delayGroup]
                              }
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
                      <td className={`${TD_BASE} font-bold font-mono`}>
                        <span
                          className={
                            metrics.availabilityPercent >= HIGH_AVAILABILITY_THRESHOLD
                              ? 'text-accent-green'
                              : metrics.availabilityPercent >= MED_AVAILABILITY_THRESHOLD
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }
                        >
                          {metrics.availabilityPercent.toFixed(1)}%
                        </span>
                        <div className="font-normal text-[10px] text-[var(--text-secondary)]">
                          {timeUnit === 'minutes'
                            ? `${Math.round(metrics.availableHours * 60)}m avail`
                            : `${metrics.availableHours.toFixed(1)}h avail`}
                        </div>
                      </td>

                      {/* 20. Utilization (%) */}
                      <td className={`${TD_BASE} font-bold font-mono`}>
                        <span
                          className={
                            metrics.utilizationPercent >= HIGH_UTILIZATION_THRESHOLD
                              ? 'text-[var(--accent-blue)]'
                              : metrics.utilizationPercent >= MED_UTILIZATION_THRESHOLD
                                ? 'text-[var(--text-heading)]'
                                : 'text-amber-600'
                          }
                        >
                          {metrics.utilizationPercent.toFixed(1)}%
                        </span>
                        <div className="font-normal text-[10px] text-[var(--text-secondary)]">
                          {timeUnit === 'minutes'
                            ? `${Math.round(metrics.totalDelayHours * 60)}m delays`
                            : `${metrics.totalDelayHours.toFixed(1)}h delays`}
                        </div>
                        <div className="font-normal text-[9px] text-[var(--text-secondary)]">
                          P:
                          {timeUnit === 'minutes'
                            ? `${Math.round(metrics.productionDelayHours * 60)}m`
                            : `${metrics.productionDelayHours.toFixed(1)}h`}{' '}
                          · N:
                          {timeUnit === 'minutes'
                            ? `${Math.round(metrics.nonProductionDelayHours * 60)}m`
                            : `${metrics.nonProductionDelayHours.toFixed(1)}h`}{' '}
                          · E:
                          {timeUnit === 'minutes'
                            ? `${Math.round(metrics.engineeringDelayHours * 60)}m`
                            : `${metrics.engineeringDelayHours.toFixed(1)}h`}
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
                              {bookingOutMachineId === row.machineId
                                ? 'Booking Out...'
                                : 'Book Out'}
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
      )}

      {/* Item 1: Machine Log Form Modal */}
      {(() => {
        const activeModalRow = rows.find((r) => r.machineId === logFormModalMachineId);
        if (!activeModalRow) return null;
        return (
          <MachineLogFormModal
            isOpen={Boolean(activeModalRow)}
            onClose={() => setLogFormModalMachineId(null)}
            row={{
              machineId: activeModalRow.machineId,
              machineName: activeModalRow.machineName,
              machineType: activeModalRow.machineType,
              serialNumber: activeModalRow.serialNumber,
              startSmr: activeModalRow.startSmr,
              stopSmr: activeModalRow.stopSmr,
              previousClosingSmr: activeModalRow.previousClosingSmr,
              operatorId: activeModalRow.operatorId,
              operatorName: activeModalRow.operatorName,
              delays: activeModalRow.delays,
              comment: activeModalRow.comment,
              endsOnBreakdown: activeModalRow.endsOnBreakdown,
              saved: activeModalRow.saved,
            }}
            operators={operators}
            onSave={handleLogFormSave}
            isSaving={savingMachineId === activeModalRow.machineId}
          />
        );
      })()}
    </div>
  );
}
