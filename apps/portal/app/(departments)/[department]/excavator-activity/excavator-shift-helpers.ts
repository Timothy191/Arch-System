import type { HourlyShift } from '../hourly-loads/loads-utils';

export type StartSmrSource = 'current_shift' | 'previous_shift' | 'machine_db' | 'none';

export interface ExcavatorShiftSmrDefaults {
  readonly startSmr: number | null;
  readonly stopSmr: number | null;
  readonly startSmrSource: StartSmrSource;
  readonly operatorId: string | null;
  readonly comment: string;
}

export interface RawMachineOperationSmrRow {
  readonly id?: string;
  readonly machine_id: string;
  readonly shift_date: string;
  readonly shift_type: string;
  readonly start_smu: number | null;
  readonly end_smu: number | null;
  readonly hours_worked: number | null;
  readonly operator_id?: string | null;
  readonly operator_name?: string | null;
}

export interface RawExcavatorActivityShiftRow {
  readonly machine_id: string;
  readonly shift_type: string;
  readonly operator_id?: string | null;
  readonly notes?: string | null;
}

export interface ExcavatorSmrSeedInput {
  readonly id: string;
  readonly starting_smr?: number | null;
}

export const START_SMR_SOURCE_LABELS: Readonly<Record<StartSmrSource, string>> = {
  current_shift: 'Current Shift',
  previous_shift: 'Prev Shift',
  machine_db: 'DB SMR',
  none: 'Manual Entry',
};

export function buildExcavatorShiftTelemetryKey(
  excavatorId: string,
  shiftType: HourlyShift
): string {
  return `${excavatorId}|${shiftType}`;
}

export function parseFiniteSmrValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function findShiftOperation(
  ops: readonly RawMachineOperationSmrRow[],
  machineId: string,
  shiftDate: string,
  shiftType: HourlyShift
): RawMachineOperationSmrRow | undefined {
  return ops.find(
    (op) =>
      op.machine_id === machineId && op.shift_date === shiftDate && op.shift_type === shiftType
  );
}

function findLatestPriorShiftSmr(
  ops: readonly RawMachineOperationSmrRow[],
  machineId: string,
  today: string,
  targetShift: HourlyShift
): number | null {
  if (targetShift === 'night') {
    const todayDayOp = findShiftOperation(ops, machineId, today, 'day');
    const dayShiftStopOrStart =
      parseFiniteSmrValue(todayDayOp?.end_smu) ?? parseFiniteSmrValue(todayDayOp?.start_smu);
    if (dayShiftStopOrStart !== null) {
      return dayShiftStopOrStart;
    }
  }

  for (const op of ops) {
    if (op.machine_id !== machineId) continue;
    if (op.shift_date >= today) continue;
    const candidate = parseFiniteSmrValue(op.end_smu) ?? parseFiniteSmrValue(op.start_smu);
    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

/**
 * Resolves initial Day & Night shift SMR defaults for each excavator from:
 * 1) current shift machine_operations record, 2) previous shift end_smu, 3) machines.starting_smr.
 */
export function buildInitialShiftTelemetryMap(options: {
  readonly excavators: readonly ExcavatorSmrSeedInput[];
  readonly machineOperations: readonly RawMachineOperationSmrRow[];
  readonly todayActivities: readonly RawExcavatorActivityShiftRow[];
  readonly today: string;
}): Record<string, ExcavatorShiftSmrDefaults> {
  const result: Record<string, ExcavatorShiftSmrDefaults> = {};
  const sortedOps = [...options.machineOperations].sort((a, b) =>
    b.shift_date.localeCompare(a.shift_date)
  );
  const shifts: readonly HourlyShift[] = ['day', 'night'];

  for (const excavator of options.excavators) {
    const dbStartSmr = parseFiniteSmrValue(excavator.starting_smr);

    for (const shiftType of shifts) {
      const key = buildExcavatorShiftTelemetryKey(excavator.id, shiftType);
      const currentOp = findShiftOperation(sortedOps, excavator.id, options.today, shiftType);
      const currentAct = options.todayActivities.find(
        (act) => act.machine_id === excavator.id && act.shift_type === shiftType
      );

      const currentStart = parseFiniteSmrValue(currentOp?.start_smu);
      const currentStop = parseFiniteSmrValue(currentOp?.end_smu);
      const previousShiftSmr = findLatestPriorShiftSmr(
        sortedOps,
        excavator.id,
        options.today,
        shiftType
      );

      let startSmr: number | null = null;
      let startSmrSource: StartSmrSource = 'none';

      if (currentStart !== null) {
        startSmr = currentStart;
        startSmrSource = 'current_shift';
      } else if (previousShiftSmr !== null) {
        startSmr = previousShiftSmr;
        startSmrSource = 'previous_shift';
      } else if (dbStartSmr !== null) {
        startSmr = dbStartSmr;
        startSmrSource = 'machine_db';
      }

      result[key] = {
        startSmr,
        stopSmr: currentStop,
        startSmrSource,
        operatorId: currentAct?.operator_id ?? currentOp?.operator_id ?? null,
        comment: currentAct?.notes ?? '',
      };
    }
  }

  return result;
}

/* ─── Stop SMR cap (shift length minus logged delays) ─────────────────────── */

/** Nominal shift length in engine hours (Day 06:00–17:59 / Night 18:00–05:59). */
export const SHIFT_LENGTH_HOURS = 12;

function roundSmr(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Clamps logged delay hours into the 0..SHIFT_LENGTH_HOURS range (null/NaN → 0). */
export function normalizeDelayHours(delayHours: number | null | undefined): number {
  if (delayHours === null || delayHours === undefined || !Number.isFinite(delayHours)) return 0;
  return Math.min(SHIFT_LENGTH_HOURS, Math.max(0, delayHours));
}

/**
 * Maximum allowed Stop SMR for a shift: `startSmr + (12 h − delay hours)`.
 * Returns null when Start SMR is unknown (no cap can be derived).
 */
export function computeMaxStopSmr(
  startSmr: number | null | undefined,
  delayHours: number | null | undefined
): number | null {
  if (startSmr === null || startSmr === undefined || !Number.isFinite(startSmr)) return null;
  return roundSmr(startSmr + (SHIFT_LENGTH_HOURS - normalizeDelayHours(delayHours)));
}

/** Returns a user-facing error when Stop SMR exceeds the shift cap, otherwise null. */
export function validateStopSmrCap(input: {
  readonly startSmr: number | null;
  readonly stopSmr: number | null;
  readonly delayHours: number | null | undefined;
}): string | null {
  if (input.stopSmr === null) return null;
  const maxStop = computeMaxStopSmr(input.startSmr, input.delayHours);
  if (maxStop === null || input.stopSmr <= maxStop) return null;
  const delay = normalizeDelayHours(input.delayHours);
  return `Stop SMR cannot exceed ${maxStop} (Start SMR + ${SHIFT_LENGTH_HOURS} h − ${delay} h delay).`;
}

export interface RawShiftDelayRow {
  readonly machine_id: string | null;
  readonly shift_date: string | null;
  readonly shift_type: string | null;
  readonly total_delay_hours: number | null;
}

/** Sums `machine_operations_with_delays.total_delay_hours` per excavator + shift for `today`. */
export function buildShiftDelayHoursMap(
  rows: readonly RawShiftDelayRow[],
  today: string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    if (!row.machine_id || row.shift_date !== today) continue;
    if (row.shift_type !== 'day' && row.shift_type !== 'night') continue;
    const key = buildExcavatorShiftTelemetryKey(row.machine_id, row.shift_type);
    result[key] = roundSmr((result[key] ?? 0) + normalizeDelayHours(row.total_delay_hours));
  }
  return result;
}

/* ─── Excavator operator filtering ───────────────────────────────────────── */

export interface OperatorRoleLike {
  readonly id: string;
  readonly employee_code: string;
  readonly role?: string | null;
}

// cspell:ignore excavat -- intentional prefix match for excavator/excavation roles
const EXCAVATOR_ROLE_PATTERN = /excavat/i;
const EXCAVATOR_CODE_PATTERN = /^OP-EX/i;

/** True when the operator's role (synced job title) or employee code marks an excavator operator. */
export function isExcavatorOperator(operator: OperatorRoleLike): boolean {
  if (operator.role && EXCAVATOR_ROLE_PATTERN.test(operator.role)) return true;
  return EXCAVATOR_CODE_PATTERN.test(operator.employee_code.trim());
}

/**
 * Restricts the operator list to excavator operators. Keeps the currently selected
 * operator visible even when non-matching, and falls back to all operators when the
 * roster contains no excavator operators at all.
 */
export function filterExcavatorOperators<T extends OperatorRoleLike>(
  operators: readonly T[],
  selectedOperatorId?: string | null
): readonly T[] {
  const matching = operators.filter(isExcavatorOperator);
  if (matching.length === 0) return operators;
  if (!selectedOperatorId || matching.some((op) => op.id === selectedOperatorId)) return matching;
  const selected = operators.find((op) => op.id === selectedOperatorId);
  return selected ? [selected, ...matching] : matching;
}

/* ─── Log ordering (Plant / Other last) ──────────────────────────────────── */

const REGULAR_MACHINE_MODES: ReadonlySet<string> = new Set(['Plant', 'Other']);

/** Stable ordering: Waste / Coal / unassigned first, Plant / Other moved to the end. */
export function sortExcavatorsForLog<T extends { readonly id: string }>(
  excavators: readonly T[],
  materials: Readonly<Record<string, string | undefined>>
): T[] {
  const primary: T[] = [];
  const regular: T[] = [];
  for (const excavator of excavators) {
    (REGULAR_MACHINE_MODES.has(materials[excavator.id] ?? '') ? regular : primary).push(excavator);
  }
  return [...primary, ...regular];
}

/* ─── Per-excavator machine / loads table ────────────────────────────────── */

export interface ExcavatorLoadSegmentLike {
  readonly machine_id: string;
  readonly excavator_id?: string | null;
  readonly shift_type?: string | null;
  readonly total_loads?: number | null;
}

export interface ExcavatorSavedAssignmentLike {
  readonly excavator_activity_id: string;
  readonly dumper_machine_id: string;
  readonly total_loads: number;
  readonly total_bcm: number | null;
}

export interface ExcavatorDumperRef {
  readonly id: string;
  readonly name: string;
  readonly bin_factor: number | null;
}

export interface ExcavatorLoadTableRow {
  readonly machineId: string;
  readonly machineName: string;
  readonly loads: number;
  /** Total material moved (BCM); null when the dumper has no bin factor. */
  readonly totalMaterial: number | null;
}

export interface ExcavatorLoadTable {
  readonly rows: readonly ExcavatorLoadTableRow[];
  readonly totalLoads: number;
  readonly totalMaterial: number;
}

function safeCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Builds the Machine ID | Loads | Total Material table for one excavator & shift.
 * Hourly load segments are the primary source (loads × dumper bin factor = BCM);
 * saved dumper assignments fill in machines that have no hourly segments.
 */
export function buildExcavatorLoadTable(input: {
  readonly excavatorId: string;
  readonly shift: HourlyShift;
  readonly activityId?: string | null;
  readonly loads: readonly ExcavatorLoadSegmentLike[];
  readonly assignments: readonly ExcavatorSavedAssignmentLike[];
  readonly dumpers: readonly ExcavatorDumperRef[];
}): ExcavatorLoadTable {
  const dumperById = new Map(input.dumpers.map((d) => [d.id, d]));
  const loadsByMachine = new Map<string, number>();
  for (const seg of input.loads) {
    if (seg.excavator_id !== input.excavatorId) continue;
    if (seg.shift_type && seg.shift_type !== input.shift) continue;
    loadsByMachine.set(
      seg.machine_id,
      (loadsByMachine.get(seg.machine_id) ?? 0) + safeCount(seg.total_loads)
    );
  }

  const rows: ExcavatorLoadTableRow[] = [];
  for (const [machineId, loads] of loadsByMachine) {
    const dumper = dumperById.get(machineId);
    const binFactor = dumper?.bin_factor ?? null;
    rows.push({
      machineId,
      machineName: dumper?.name ?? machineId,
      loads,
      totalMaterial: binFactor !== null ? roundSmr(loads * binFactor) : null,
    });
  }

  if (input.activityId) {
    for (const a of input.assignments) {
      if (a.excavator_activity_id !== input.activityId) continue;
      if (loadsByMachine.has(a.dumper_machine_id)) continue;
      const dumper = dumperById.get(a.dumper_machine_id);
      const loads = safeCount(a.total_loads);
      const binFactor = dumper?.bin_factor ?? null;
      const bcm = a.total_bcm ?? (binFactor !== null ? loads * binFactor : null);
      rows.push({
        machineId: a.dumper_machine_id,
        machineName: dumper?.name ?? a.dumper_machine_id,
        loads,
        totalMaterial: bcm !== null ? roundSmr(bcm) : null,
      });
    }
  }

  rows.sort((a, b) => a.machineName.localeCompare(b.machineName, undefined, { numeric: true }));
  return {
    rows,
    totalLoads: rows.reduce((sum, r) => sum + r.loads, 0),
    totalMaterial: roundSmr(rows.reduce((sum, r) => sum + (r.totalMaterial ?? 0), 0)),
  };
}
