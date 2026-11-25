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
