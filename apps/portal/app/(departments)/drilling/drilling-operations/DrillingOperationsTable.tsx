'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { getOperationalToday } from '@repo/utils/client';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Drill,
  FileText,
  Moon,
  Radio,
  Search,
  Sun,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  buildMonthCalendarDays,
  getDaysInMonthCount,
  type MonthCalendarDay,
} from '~/app/(departments)/[department]/reports/machine-activity-helpers';

type Shift = 'day' | 'night';

export interface DrillOpRow {
  id?: string;
  machine_id: string;
  shift_type: Shift;
  operation_date?: string;
  open_hours: number | null;
  close_hours: number | null;
  total_hours: number | null;
  holes?: number | null;
  meters_drilled?: number | null;
  operator_name: string | null;
  block_drilled: string | null;
  site: string | null;
  external_delays_minutes: number | null;
  standard_delays_hours: number | null;
  production_delays_minutes: number | null;
  engineering_delays_minutes: number | null;
  comments: string | null;
  status?: string;
}

interface Machine {
  readonly id: string;
  readonly name: string;
}

interface Operator {
  readonly id: string;
  readonly full_name: string;
}

interface Props {
  readonly departmentId: string;
  readonly drills: readonly Machine[];
  readonly operators: readonly Operator[];
  readonly initialOps: readonly DrillOpRow[];
  readonly initialMonth?: string;
  readonly initialMachineId?: string;
}

interface ResolvedCalendarDayRow {
  readonly date: string;
  readonly dayOfMonth: number;
  readonly hasActivity: boolean;
  readonly startSmr: number | null;
  readonly stopSmr: number | null;
  readonly totalWorked: number | null;
  readonly site: string;
  readonly block: string;
  readonly operator: string;
  readonly holes: number | null;
  readonly meters: number | null;
}

interface ResolveCalendarDayOptions {
  readonly machineId: string;
  readonly dayEntry: MonthCalendarDay;
  readonly selectedShift: 'all' | Shift;
  readonly opsByKey: ReadonlyMap<string, DrillOpRow>;
}

const DECIMAL_PLACES_ONE = 1;
const DECIMAL_PLACES_TWO = 2;
const MONTH_PREFIX_LENGTH = 7;
const STEP_PREV = -1;
const STEP_NEXT = 1;
const MONTH_FORMAT_REGEX = /^\d{4}-\d{2}$/;

const TH_LEFT =
  'whitespace-nowrap px-3 py-2.5 text-left font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TH_RIGHT =
  'whitespace-nowrap px-3 py-2.5 text-right font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider';
const TD_LEFT = 'whitespace-nowrap px-3 py-2.5 align-middle text-xs';
const TD_RIGHT =
  'whitespace-nowrap px-3 py-2.5 text-right align-middle font-mono text-xs tabular-nums';
const KPI_BOX_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3';
const BTN_SECONDARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]';
const SELECT_CONTROL_CLASS =
  'rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs';
const MONTH_INPUT_CLASS =
  'rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1 font-mono text-[var(--text-heading)] text-xs';
const SEARCH_INPUT_CLASS =
  'w-40 rounded-lg border border-[var(--border-default)] bg-white py-1.5 pr-2.5 pl-8 text-[var(--text-heading)] text-xs';
const RIG_PILL_BASE_CLASS =
  'cursor-pointer rounded-full border px-2.5 py-1 font-semibold text-xs transition-colors';
const RIG_PILL_ACTIVE_CLASS = 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white';
const RIG_PILL_IDLE_CLASS =
  'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]';
const SHIFT_BTN_BASE_CLASS =
  'inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 font-medium text-xs transition-colors';
const SHIFT_BTN_ACTIVE_CLASS = 'bg-[var(--accent-blue)] text-white';
const SHIFT_BTN_IDLE_CLASS =
  'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]';
const SYNC_BADGE_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-2.5 py-0.5 font-medium text-accent-green text-xs';
const SHEET_BADGE_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider';

const today = getOperationalToday();
const defaultMonth = today.slice(0, MONTH_PREFIX_LENGTH);

function fmt(numVal: number | null | undefined, digits = DECIMAL_PLACES_TWO): string {
  if (numVal === null || numVal === undefined) return '—';
  return Number(numVal).toFixed(digits);
}

function resolveShiftWorkedHours(op: DrillOpRow | undefined): number | null {
  if (!op) return null;
  if (op.total_hours != null) {
    return Number(op.total_hours);
  }
  if (op.open_hours != null && op.close_hours != null && op.close_hours >= op.open_hours) {
    return Number(op.close_hours) - Number(op.open_hours);
  }
  return null;
}

function collectUniqueLabels(labels: readonly (string | null | undefined)[]): string {
  const uniqueSet = new Set<string>();
  for (const rawLabel of labels) {
    const trimmed = rawLabel?.trim();
    if (trimmed && trimmed !== '—') {
      uniqueSet.add(trimmed);
    }
  }
  return uniqueSet.size > 0 ? Array.from(uniqueSet).join(', ') : '—';
}

function resolveCalendarDayRow({
  machineId,
  dayEntry,
  selectedShift,
  opsByKey,
}: ResolveCalendarDayOptions): ResolvedCalendarDayRow {
  if (selectedShift !== 'all') {
    const shiftOp = opsByKey.get(`${machineId}:${dayEntry.date}:${selectedShift}`);
    if (!shiftOp) {
      return {
        date: dayEntry.date,
        dayOfMonth: dayEntry.dayOfMonth,
        hasActivity: false,
        startSmr: null,
        stopSmr: null,
        totalWorked: null,
        site: '—',
        block: '—',
        operator: '—',
        holes: null,
        meters: null,
      };
    }
    return {
      date: dayEntry.date,
      dayOfMonth: dayEntry.dayOfMonth,
      hasActivity: true,
      startSmr: shiftOp.open_hours != null ? Number(shiftOp.open_hours) : null,
      stopSmr: shiftOp.close_hours != null ? Number(shiftOp.close_hours) : null,
      totalWorked: resolveShiftWorkedHours(shiftOp),
      site: collectUniqueLabels([shiftOp.site]),
      block: collectUniqueLabels([shiftOp.block_drilled]),
      operator: collectUniqueLabels([shiftOp.operator_name]),
      holes: shiftOp.holes != null ? Number(shiftOp.holes) : 0,
      meters: shiftOp.meters_drilled != null ? Number(shiftOp.meters_drilled) : 0,
    };
  }

  const dayOp = opsByKey.get(`${machineId}:${dayEntry.date}:day`);
  const nightOp = opsByKey.get(`${machineId}:${dayEntry.date}:night`);
  const matchedOps = [dayOp, nightOp].filter((op): op is DrillOpRow => op !== undefined);

  if (matchedOps.length === 0) {
    return {
      date: dayEntry.date,
      dayOfMonth: dayEntry.dayOfMonth,
      hasActivity: false,
      startSmr: null,
      stopSmr: null,
      totalWorked: null,
      site: '—',
      block: '—',
      operator: '—',
      holes: null,
      meters: null,
    };
  }

  const openCandidates = matchedOps
    .map((op) => (op.open_hours != null ? Number(op.open_hours) : null))
    .filter((hoursVal): hoursVal is number => hoursVal !== null);
  const positiveOpenCandidates = openCandidates.filter((hoursVal) => hoursVal > 0);
  const startSmr =
    positiveOpenCandidates.length > 0
      ? Math.min(...positiveOpenCandidates)
      : (openCandidates[0] ?? null);

  const closeCandidates = matchedOps
    .map((op) => (op.close_hours != null ? Number(op.close_hours) : null))
    .filter((hoursVal): hoursVal is number => hoursVal !== null);
  const stopSmr = closeCandidates.length > 0 ? Math.max(...closeCandidates) : null;

  const workedCandidates = matchedOps
    .map((op) => resolveShiftWorkedHours(op))
    .filter((hoursVal): hoursVal is number => hoursVal !== null);
  const totalWorked =
    workedCandidates.length > 0
      ? workedCandidates.reduce((sum, hoursVal) => sum + hoursVal, 0)
      : null;

  const holesSum = matchedOps.reduce((sum, op) => sum + Number(op.holes ?? 0), 0);
  const metersSum = matchedOps.reduce((sum, op) => sum + Number(op.meters_drilled ?? 0), 0);

  return {
    date: dayEntry.date,
    dayOfMonth: dayEntry.dayOfMonth,
    hasActivity: true,
    startSmr,
    stopSmr,
    totalWorked,
    site: collectUniqueLabels(matchedOps.map((op) => op.site)),
    block: collectUniqueLabels(matchedOps.map((op) => op.block_drilled)),
    operator: collectUniqueLabels(matchedOps.map((op) => op.operator_name)),
    holes: holesSum,
    meters: metersSum,
  };
}

export function DrillingOperationsTable({
  drills,
  initialOps,
  initialMonth,
  initialMachineId,
}: Props) {
  const [selectedShift, setSelectedShift] = useState<'all' | Shift>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    initialMonth && MONTH_FORMAT_REGEX.test(initialMonth) ? initialMonth : defaultMonth
  );
  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    () => initialMachineId ?? drills[0]?.id ?? ''
  );
  const [machineSearch, setMachineSearch] = useState<string>('');

  // Pre-index initialOps by `${machine_id}:${opDate}:${shift_type}`
  const opsByKey = useMemo(() => {
    const map = new Map<string, DrillOpRow>();
    for (const op of initialOps) {
      const opDate = op.operation_date ?? today;
      map.set(`${op.machine_id}:${opDate}:${op.shift_type}`, op);
    }
    return map;
  }, [initialOps]);

  // Fleet-wide KPI summary totals across the selected month and shift
  const { totalMeters, totalHoles, totalHours, activeRigsCount } = useMemo(() => {
    let meters = 0;
    let holes = 0;
    let hours = 0;
    const activeRigs = new Set<string>();

    for (const op of initialOps) {
      const opDate = op.operation_date ?? today;
      if (!opDate.startsWith(selectedMonth)) {
        continue;
      }
      if (selectedShift !== 'all' && op.shift_type !== selectedShift) {
        continue;
      }
      meters += Number(op.meters_drilled || 0);
      holes += Number(op.holes || 0);

      const workedHrs = resolveShiftWorkedHours(op);
      if (workedHrs != null) {
        hours += workedHrs;
      }

      if (op.machine_id) {
        activeRigs.add(op.machine_id);
      }
    }

    return {
      totalMeters: meters,
      totalHoles: holes,
      totalHours: hours,
      activeRigsCount: activeRigs.size,
    };
  }, [initialOps, selectedMonth, selectedShift]);

  const filteredDrills = useMemo(() => {
    const queryLower = machineSearch.trim().toLowerCase();
    if (!queryLower) return drills;
    return drills.filter((drill) => drill.name.toLowerCase().includes(queryLower));
  }, [drills, machineSearch]);

  const activeMachine = useMemo(() => {
    const foundInFiltered = filteredDrills.find((drill) => drill.id === selectedMachineId);
    if (foundInFiltered) return foundInFiltered;
    const foundInAll = drills.find((drill) => drill.id === selectedMachineId);
    return filteredDrills[0] ?? foundInAll ?? drills[0] ?? null;
  }, [drills, filteredDrills, selectedMachineId]);

  const activeMachineIndex = useMemo(() => {
    if (!activeMachine || filteredDrills.length === 0) return 0;
    const idx = filteredDrills.findIndex((drill) => drill.id === activeMachine.id);
    return idx >= 0 ? idx : 0;
  }, [activeMachine, filteredDrills]);

  const calendarDays = useMemo(() => {
    const daysCount = getDaysInMonthCount(selectedMonth);
    return buildMonthCalendarDays(selectedMonth).slice(0, daysCount);
  }, [selectedMonth]);

  const calendarDayRows = useMemo(() => {
    if (!activeMachine) return [];
    return calendarDays.map((dayEntry) =>
      resolveCalendarDayRow({
        machineId: activeMachine.id,
        dayEntry,
        selectedShift,
        opsByKey,
      })
    );
  }, [activeMachine, calendarDays, opsByKey, selectedShift]);

  const machineMonthlyTotals = useMemo(() => {
    let activeDaysLogged = 0;
    let firstStartSmr: number | null = null;
    let lastStopSmr: number | null = null;
    let totalHoursAccum = 0;
    let totalHolesAccum = 0;
    let totalMetersAccum = 0;
    const sitesSet = new Set<string>();
    const blocksSet = new Set<string>();
    const operatorsSet = new Set<string>();

    for (const row of calendarDayRows) {
      if (row.hasActivity) {
        activeDaysLogged += 1;
      }
      if (firstStartSmr === null && row.startSmr !== null) {
        firstStartSmr = row.startSmr;
      }
      if (row.stopSmr !== null) {
        lastStopSmr = row.stopSmr;
      }
      if (row.totalWorked !== null) {
        totalHoursAccum += row.totalWorked;
      }
      if (row.holes !== null) {
        totalHolesAccum += row.holes;
      }
      if (row.meters !== null) {
        totalMetersAccum += row.meters;
      }
      for (const sitePart of row.site.split(',')) {
        const trimmedSite = sitePart.trim();
        if (trimmedSite && trimmedSite !== '—') {
          sitesSet.add(trimmedSite);
        }
      }
      for (const blockPart of row.block.split(',')) {
        const trimmedBlock = blockPart.trim();
        if (trimmedBlock && trimmedBlock !== '—') {
          blocksSet.add(trimmedBlock);
        }
      }
      for (const operatorPart of row.operator.split(',')) {
        const trimmedOperator = operatorPart.trim();
        if (trimmedOperator && trimmedOperator !== '—') {
          operatorsSet.add(trimmedOperator);
        }
      }
    }

    return {
      activeDaysLogged,
      openingSmr: firstStartSmr !== null ? firstStartSmr.toFixed(DECIMAL_PLACES_ONE) : '—',
      closingSmr: lastStopSmr !== null ? lastStopSmr.toFixed(DECIMAL_PLACES_ONE) : '—',
      totalHours: totalHoursAccum,
      totalHoles: totalHolesAccum,
      totalMeters: totalMetersAccum,
      sitesSummary: sitesSet.size > 0 ? Array.from(sitesSet).join(', ') : '—',
      blocksCount: blocksSet.size,
      blocksSummary: blocksSet.size > 0 ? Array.from(blocksSet).join(', ') : '—',
      operatorsSummary: operatorsSet.size > 0 ? Array.from(operatorsSet).join(', ') : '—',
    };
  }, [calendarDayRows]);

  if (drills.length === 0 || !activeMachine) {
    return (
      <GlassCard className="p-12 text-center">
        <p className="text-[var(--text-muted)]">
          No active drill rigs registered. Add rigs in the Machines section first.
        </p>
      </GlassCard>
    );
  }

  const handleStepMachine = (direction: -1 | 1) => {
    if (filteredDrills.length === 0) return;
    const nextIndex =
      (activeMachineIndex + direction + filteredDrills.length) % filteredDrills.length;
    const targetDrill = filteredDrills[nextIndex];
    if (targetDrill) {
      setSelectedMachineId(targetDrill.id);
    }
  };

  const handleExportMachineMonthlyCsv = () => {
    const headers = [
      'Date',
      'Start SMR',
      'Stop SMR',
      'Total Worked',
      'Site',
      'Block',
      'Operator',
      'Holes',
      'Meters',
    ];
    const csvLines = [
      headers.join(','),
      ...calendarDayRows.map((row) =>
        [
          row.date,
          row.startSmr !== null ? row.startSmr.toFixed(DECIMAL_PLACES_ONE) : '',
          row.stopSmr !== null ? row.stopSmr.toFixed(DECIMAL_PLACES_ONE) : '',
          row.totalWorked !== null ? row.totalWorked.toFixed(DECIMAL_PLACES_TWO) : '',
          `"${row.site === '—' ? '' : row.site.replaceAll('"', '""')}"`,
          `"${row.block === '—' ? '' : row.block.replaceAll('"', '""')}"`,
          `"${row.operator === '—' ? '' : row.operator.replaceAll('"', '""')}"`,
          row.holes !== null ? String(row.holes) : '',
          row.meters !== null ? row.meters.toFixed(DECIMAL_PLACES_ONE) : '',
        ].join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${activeMachine.name.replace(/\s+/g, '-')}-${selectedMonth}-monthly-sheet.csv`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div className="space-y-6" data-testid="drilling-machine-monthly-sheet">
      {/* Fleet-Wide KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <GlassCard>
          <div className="flex items-center gap-2">
            <Drill className="h-4 w-4 text-accent-green" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Meters Drilled
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-accent-green">
            {totalMeters.toFixed(DECIMAL_PLACES_ONE)}m
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--accent-blue)]" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Holes Drilled
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--accent-blue)]">{totalHoles}</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Operating Hours
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-cyan-500">
            {totalHours.toFixed(DECIMAL_PLACES_ONE)}h
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent-green" />
            <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Rigs Logged
            </p>
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
            {activeRigsCount} / {drills.length}
          </p>
        </GlassCard>
      </div>

      {/* Top Per-Machine Switcher & Month Controls GlassCard */}
      <GlassCard className="p-5">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={SHEET_BADGE_CLASS}>
                  <Drill className="h-3.5 w-3.5" />
                  Per-Machine Monthly Activity Sheet
                </span>
                <span className={SYNC_BADGE_CLASS}>
                  <Radio className="h-3 w-3" />
                  Synced from Control Room
                </span>
              </div>
              <h3 className="mt-1.5 font-bold text-[var(--text-heading)] text-lg">
                {activeMachine.name} — {selectedMonth} ({calendarDays.length}-Day Auto-Compiled
                Shift Report)
              </h3>
              <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                Switch between any drill rig below to inspect its 30/31-day monthly calendar sheet
                (Date, Start SMR, Stop SMR, Total Worked, Site, Block, Operator, Holes &amp;
                Meters).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportMachineMonthlyCsv}
                data-testid="export-machine-30d-csv-btn"
                className={BTN_SECONDARY}
              >
                <Download className="h-3.5 w-3.5" />
                Export Machine Monthly CSV
              </button>

              <Link href="/drilling/reports" className={BTN_SECONDARY}>
                <FileText className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                Production Reports &amp; CSV
              </Link>
            </div>
          </div>

          {/* Machine Switcher & Filter Bar */}
          <div className="space-y-3 border-[var(--border-default)] border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepMachine(STEP_PREV)}
                  data-testid="prev-machine-30d-btn"
                  aria-label="Previous Machine"
                  className={BTN_SECONDARY}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>

                <select
                  aria-label="Select Machine for Monthly Activity Table"
                  data-testid="machine-30d-selector"
                  value={activeMachine.id}
                  onChange={(event) => setSelectedMachineId(event.target.value)}
                  className={SELECT_CONTROL_CLASS}
                >
                  {filteredDrills.map((drill) => (
                    <option key={drill.id} value={drill.id}>
                      {drill.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleStepMachine(STEP_NEXT)}
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
                    aria-label="Quick search drill rig"
                    data-testid="machine-30d-search-input"
                    value={machineSearch}
                    onChange={(event) => setMachineSearch(event.target.value)}
                    placeholder="Find drill rig..."
                    className={SEARCH_INPUT_CLASS}
                  />
                </div>

                <span className="font-mono text-[var(--text-muted)] text-xs">
                  Rig {activeMachineIndex + 1} of {filteredDrills.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Month Picker */}
                <label className="inline-flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">Month:</span>
                  <input
                    type="month"
                    aria-label="Select Activity Month"
                    data-testid="machine-30d-month-input"
                    value={selectedMonth}
                    onChange={(event) => {
                      if (event.target.value) {
                        setSelectedMonth(event.target.value);
                      }
                    }}
                    className={MONTH_INPUT_CLASS}
                  />
                </label>

                {/* Shift Segmented Control */}
                <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border-default)]">
                  <button
                    type="button"
                    onClick={() => setSelectedShift('all')}
                    className={cn(
                      SHIFT_BTN_BASE_CLASS,
                      selectedShift === 'all' ? SHIFT_BTN_ACTIVE_CLASS : SHIFT_BTN_IDLE_CLASS
                    )}
                  >
                    All Shifts
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedShift('day')}
                    className={cn(
                      SHIFT_BTN_BASE_CLASS,
                      'border-[var(--border-default)] border-l',
                      selectedShift === 'day' ? SHIFT_BTN_ACTIVE_CLASS : SHIFT_BTN_IDLE_CLASS
                    )}
                  >
                    <Sun className="h-3 w-3" />
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedShift('night')}
                    className={cn(
                      SHIFT_BTN_BASE_CLASS,
                      'border-[var(--border-default)] border-l',
                      selectedShift === 'night' ? SHIFT_BTN_ACTIVE_CLASS : SHIFT_BTN_IDLE_CLASS
                    )}
                  >
                    <Moon className="h-3 w-3" />
                    Night
                  </button>
                </div>
              </div>
            </div>

            {/* Clickable Rig Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {filteredDrills.map((drill) => {
                const isSelectedRig = drill.id === activeMachine.id;
                return (
                  <button
                    key={drill.id}
                    type="button"
                    onClick={() => setSelectedMachineId(drill.id)}
                    data-testid={`rig-pill-${drill.id}`}
                    className={cn(
                      RIG_PILL_BASE_CLASS,
                      isSelectedRig ? RIG_PILL_ACTIVE_CLASS : RIG_PILL_IDLE_CLASS
                    )}
                  >
                    {drill.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Machine 6-KPI Summary Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <div className={KPI_BOX_CLASS}>
              <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                Selected Machine
              </div>
              <div className="mt-0.5 font-bold text-[var(--text-heading)] text-sm">
                {activeMachine.name}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Drill Rig · Control Room SSoT
              </div>
            </div>

            <div className={KPI_BOX_CLASS}>
              <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                Calendar Days in Table
              </div>
              <div className="mt-0.5 font-bold font-mono text-[var(--text-heading)] text-sm">
                {calendarDays.length} Days ({machineMonthlyTotals.activeDaysLogged} active)
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Opening {machineMonthlyTotals.openingSmr} -&gt; Closing{' '}
                {machineMonthlyTotals.closingSmr}
              </div>
            </div>

            <div className={KPI_BOX_CLASS}>
              <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                Monthly SMR Worked
              </div>
              <div className="mt-0.5 font-bold font-mono text-[var(--accent-blue)] text-base">
                {machineMonthlyTotals.totalHours.toFixed(DECIMAL_PLACES_ONE)} h
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Logged across {selectedMonth}
              </div>
            </div>

            <div className={KPI_BOX_CLASS}>
              <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                Monthly Holes Drilled
              </div>
              <div className="mt-0.5 font-bold font-mono text-[var(--accent-blue)] text-base">
                {machineMonthlyTotals.totalHoles}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                {machineMonthlyTotals.activeDaysLogged} active shift days
              </div>
            </div>

            <div className={KPI_BOX_CLASS}>
              <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                Monthly Meters Drilled
              </div>
              <div className="mt-0.5 font-bold font-mono text-accent-green text-base">
                {machineMonthlyTotals.totalMeters.toFixed(DECIMAL_PLACES_ONE)} m
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Verified drill penetration
              </div>
            </div>

            <div className={KPI_BOX_CLASS}>
              <div className="font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                Primary Site &amp; Blocks
              </div>
              <div className="mt-0.5 truncate font-bold text-[var(--text-heading)] text-sm">
                {machineMonthlyTotals.sitesSummary}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                {machineMonthlyTotals.blocksCount} Blocks
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Per-Machine Monthly Calendar Table GlassCard */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table aria-label={`Monthly Activity Table for ${activeMachine.name}`}>
            <TableHeader className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/80">
              <TableRow className="border-[var(--border-subtle)] border-b hover:bg-transparent">
                <TableHead className={TH_LEFT}>Date</TableHead>
                <TableHead className={TH_RIGHT}>Start SMR</TableHead>
                <TableHead className={TH_RIGHT}>Stop SMR</TableHead>
                <TableHead className={TH_RIGHT}>Total Worked</TableHead>
                <TableHead className={TH_LEFT}>Site</TableHead>
                <TableHead className={TH_LEFT}>Block</TableHead>
                <TableHead className={TH_LEFT}>Operator</TableHead>
                <TableHead className={TH_RIGHT}>Holes</TableHead>
                <TableHead className={TH_RIGHT}>Meters</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calendarDayRows.map((row) => (
                <TableRow
                  key={`${activeMachine.id}:${row.date}`}
                  className="border-[var(--border-subtle)] border-b hover:bg-[var(--bg-tertiary)]/30"
                >
                  <TableCell className={TD_LEFT}>
                    <div className="font-semibold text-[var(--text-heading)]">
                      Day {String(row.dayOfMonth).padStart(DECIMAL_PLACES_TWO, '0')} · {row.date}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {selectedShift === 'all' ? 'All shifts' : `${selectedShift} shift`} ·{' '}
                      {activeMachine.name}
                    </div>
                  </TableCell>
                  <TableCell className={cn(TD_RIGHT, 'text-[var(--text-muted)]')}>
                    {row.startSmr !== null ? fmt(row.startSmr, DECIMAL_PLACES_ONE) : '—'}
                  </TableCell>
                  <TableCell className={cn(TD_RIGHT, 'text-[var(--text-muted)]')}>
                    {row.stopSmr !== null ? fmt(row.stopSmr, DECIMAL_PLACES_ONE) : '—'}
                  </TableCell>
                  <TableCell className={cn(TD_RIGHT, 'font-medium text-cyan-600')}>
                    {row.totalWorked !== null
                      ? `${row.totalWorked.toFixed(DECIMAL_PLACES_TWO)}h`
                      : '—'}
                  </TableCell>
                  <TableCell className={cn(TD_LEFT, 'text-[var(--text-body)]')}>
                    {row.site}
                  </TableCell>
                  <TableCell className={cn(TD_LEFT, 'font-medium text-[var(--text-heading)]')}>
                    {row.block}
                  </TableCell>
                  <TableCell className={cn(TD_LEFT, 'text-[var(--text-body)]')}>
                    {row.operator}
                  </TableCell>
                  <TableCell className={cn(TD_RIGHT, 'font-semibold text-[var(--accent-blue)]')}>
                    {row.holes !== null ? row.holes : '—'}
                  </TableCell>
                  <TableCell className={cn(TD_RIGHT, 'font-semibold text-accent-green')}>
                    {row.meters !== null ? `${fmt(row.meters, DECIMAL_PLACES_ONE)}m` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="border-[var(--border-default)] border-t-2 bg-[var(--bg-secondary)] font-bold text-xs">
              <TableRow data-testid="machine-30d-totals-row">
                <TableCell className={TD_LEFT}>
                  Monthly Total ({calendarDays.length} Days · {activeMachine.name})
                </TableCell>
                <TableCell className={TD_RIGHT}>{machineMonthlyTotals.openingSmr}</TableCell>
                <TableCell className={TD_RIGHT}>{machineMonthlyTotals.closingSmr}</TableCell>
                <TableCell className={cn(TD_RIGHT, 'text-[var(--accent-blue)]')}>
                  {machineMonthlyTotals.totalHours.toFixed(DECIMAL_PLACES_ONE)}h
                </TableCell>
                <TableCell className={TD_LEFT}>{machineMonthlyTotals.sitesSummary}</TableCell>
                <TableCell className={TD_LEFT}>{machineMonthlyTotals.blocksSummary}</TableCell>
                <TableCell className={TD_LEFT}>{machineMonthlyTotals.operatorsSummary}</TableCell>
                <TableCell className={cn(TD_RIGHT, 'text-[var(--accent-blue)]')}>
                  {machineMonthlyTotals.totalHoles}
                </TableCell>
                <TableCell className={cn(TD_RIGHT, 'text-accent-green')}>
                  {machineMonthlyTotals.totalMeters.toFixed(DECIMAL_PLACES_ONE)}m
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
