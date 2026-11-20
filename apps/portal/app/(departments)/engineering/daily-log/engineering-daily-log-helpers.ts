import { escapeEngineeringCsvCell } from '../engineering-hub-metrics';

export { escapeEngineeringCsvCell };

export interface RawDailyBreakdownRow {
  readonly id: string;
  readonly fleet_id: string;
  readonly machine_id: string | null;
  readonly machine_name: string | null;
  readonly machine_type: string;
  readonly site_code: string | null;
  readonly shift_type: string | null;
  readonly date_in: string;
  readonly time_in: string | null;
  readonly date_out: string | null;
  readonly time_out: string | null;
  readonly duration_hours: number | null;
  readonly duration_minutes: number | null;
  readonly delay_hours: number | null;
  readonly reason: string;
  readonly repair_notes: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface RawDailyMachineRow {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly serial_number: string | null;
  readonly active: boolean;
  readonly site?:
    | { readonly name: string | null; readonly site_code: string | null }
    | Array<{ readonly name: string | null; readonly site_code: string | null }>
    | null;
}

export interface DailyLogBreakdownRecord {
  readonly id: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly fleetId: string;
  readonly siteCode: string;
  readonly shiftType: 'day' | 'night';
  readonly dateIn: string;
  readonly timeIn: string;
  readonly dateOut: string;
  readonly timeOut: string;
  readonly durationHours: number;
  readonly reason: string;
  readonly repairNotes: string;
  readonly status: 'active' | 'completed';
  readonly createdAt: string;
}

export interface HourlyActivityBucket {
  readonly slot: string;
  readonly shift: 'Day' | 'Night';
  readonly active: number;
  readonly resolved: number;
  readonly total: number;
  readonly downtimeHours: number;
}

export interface ShiftSummaryBucket {
  readonly shift: string;
  readonly active: number;
  readonly resolved: number;
  readonly total: number;
  readonly downtimeHours: number;
}

export interface DailyLogReportKpis {
  readonly loggedLast24h: number;
  readonly stillActive: number;
  readonly completedResolved: number;
  readonly totalDowntimeHours: number;
  readonly mttrHours: number;
  readonly activeMachinesCount: number;
}

export interface EngineeringDailyLogReport {
  readonly today: string;
  readonly kpis: DailyLogReportKpis;
  readonly records: DailyLogBreakdownRecord[];
  readonly hourlyActivity: HourlyActivityBucket[];
  readonly shiftBreakdown: ShiftSummaryBucket[];
  readonly machineTypes: string[];
}

export interface BuildDailyLogReportOptions {
  readonly breakdowns: readonly RawDailyBreakdownRow[];
  readonly machines: readonly RawDailyMachineRow[];
  readonly today: string;
  readonly nowMs?: number;
}

const MS_PER_HOUR = 3_600_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SLOT_STEP_HOURS = 2;
const DAY_SHIFT_START_HOUR = 6;
const DAY_SHIFT_END_HOUR = 18;

function roundOneDecimal(num: number): number {
  return Math.round(num * 10) / 10;
}

function parseEventHour(options: {
  readonly timeIn: string | null;
  readonly createdAt: string;
}): number {
  if (options.timeIn) {
    const match = options.timeIn.match(/^(\d{1,2}):/);
    if (match?.[1]) {
      const hour = Number(match[1]);
      if (hour >= 0 && hour < HOURS_PER_DAY) return hour;
    }
  }
  const parsed = new Date(options.createdAt);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getUTCHours();
  }
  return DAY_SHIFT_START_HOUR;
}

function resolveShiftType(options: {
  readonly shiftType: string | null;
  readonly eventHour: number;
}): 'day' | 'night' {
  const normalized = options.shiftType?.trim().toLowerCase();
  if (normalized === 'day') return 'day';
  if (normalized === 'night') return 'night';
  return options.eventHour >= DAY_SHIFT_START_HOUR && options.eventHour < DAY_SHIFT_END_HOUR
    ? 'day'
    : 'night';
}

function resolveDurationHours(options: {
  readonly row: RawDailyBreakdownRow;
  readonly nowMs: number;
}): number {
  const { row, nowMs } = options;
  if (row.duration_hours != null && Number(row.duration_hours) > 0) {
    return roundOneDecimal(Number(row.duration_hours));
  }
  if (row.duration_minutes != null && Number(row.duration_minutes) > 0) {
    return roundOneDecimal(Number(row.duration_minutes) / MINUTES_PER_HOUR);
  }
  if (row.date_in && row.time_in && row.date_out && row.time_out) {
    const startMs = new Date(`${row.date_in}T${row.time_in}`).getTime();
    const endMs = new Date(`${row.date_out}T${row.time_out}`).getTime();
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
      return roundOneDecimal((endMs - startMs) / MS_PER_HOUR);
    }
  }
  if (row.status === 'active') {
    const startCandidate =
      row.date_in && row.time_in ? `${row.date_in}T${row.time_in}` : row.created_at;
    const startMs = new Date(startCandidate).getTime();
    if (!Number.isNaN(startMs) && nowMs > startMs) {
      return roundOneDecimal(Math.min(HOURS_PER_DAY, (nowMs - startMs) / MS_PER_HOUR));
    }
  }
  return 0;
}

function resolveSiteCode(options: {
  readonly explicitSiteCode: string | null;
  readonly machineRow: RawDailyMachineRow | undefined;
}): string {
  if (options.explicitSiteCode?.trim()) {
    return options.explicitSiteCode.trim();
  }
  const site = Array.isArray(options.machineRow?.site)
    ? options.machineRow?.site[0]
    : options.machineRow?.site;
  return site?.site_code?.trim() || site?.name?.trim() || '—';
}

/**
 * Deduplicates 24-hour engineering breakdown queries by ID and builds
 * KPI metrics, 2-hour activity windows, shift split data, and normalized report rows.
 */
export function buildEngineeringDailyLogReport(
  options: BuildDailyLogReportOptions
): EngineeringDailyLogReport {
  const nowMs = options.nowMs ?? Date.now();
  const machineById = new Map<string, RawDailyMachineRow>();
  for (const machine of options.machines) {
    machineById.set(machine.id, machine);
  }

  const dedupedById = new Map<string, RawDailyBreakdownRow>();
  for (const row of options.breakdowns) {
    if (!dedupedById.has(row.id)) {
      dedupedById.set(row.id, row);
    }
  }

  const hourlySlots: HourlyActivityBucket[] = Array.from(
    { length: HOURS_PER_DAY / SLOT_STEP_HOURS },
    (_, index) => {
      const startHour = index * SLOT_STEP_HOURS;
      const paddedStart = String(startHour).padStart(2, '0');
      const shift: 'Day' | 'Night' =
        startHour >= DAY_SHIFT_START_HOUR && startHour < DAY_SHIFT_END_HOUR ? 'Day' : 'Night';
      return {
        slot: `${paddedStart}:00`,
        shift,
        active: 0,
        resolved: 0,
        total: 0,
        downtimeHours: 0,
      };
    }
  );

  const dayShiftBucket: ShiftSummaryBucket = {
    shift: 'Day Shift',
    active: 0,
    resolved: 0,
    total: 0,
    downtimeHours: 0,
  };
  const nightShiftBucket: ShiftSummaryBucket = {
    shift: 'Night Shift',
    active: 0,
    resolved: 0,
    total: 0,
    downtimeHours: 0,
  };

  let stillActive = 0;
  let completedResolved = 0;
  let totalDowntimeHours = 0;
  let completedDurationSum = 0;
  let completedWithDurationCount = 0;
  const machineTypeSet = new Set<string>();

  const records: DailyLogBreakdownRecord[] = Array.from(dedupedById.values())
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((row) => {
      const matchedMachine = row.machine_id ? machineById.get(row.machine_id) : undefined;
      const machineName =
        row.machine_name?.trim() ||
        matchedMachine?.name ||
        row.fleet_id?.trim() ||
        'Unknown Machine';
      const machineType = row.machine_type?.trim() || matchedMachine?.machine_type || 'Unspecified';
      const eventHour = parseEventHour({ timeIn: row.time_in, createdAt: row.created_at });
      const shiftType = resolveShiftType({ shiftType: row.shift_type, eventHour });
      const durationHours = resolveDurationHours({ row, nowMs });
      const status: 'active' | 'completed' = row.status === 'completed' ? 'completed' : 'active';

      machineTypeSet.add(machineType);
      totalDowntimeHours += durationHours;

      if (status === 'active') {
        stillActive += 1;
      } else {
        completedResolved += 1;
        if (durationHours > 0) {
          completedDurationSum += durationHours;
          completedWithDurationCount += 1;
        }
      }

      const slotIndex = Math.floor(eventHour / SLOT_STEP_HOURS);
      const slotBucket = hourlySlots[slotIndex];
      if (slotBucket) {
        const updatedSlot: HourlyActivityBucket = {
          ...slotBucket,
          active: slotBucket.active + (status === 'active' ? 1 : 0),
          resolved: slotBucket.resolved + (status === 'completed' ? 1 : 0),
          total: slotBucket.total + 1,
          downtimeHours: roundOneDecimal(slotBucket.downtimeHours + durationHours),
        };
        hourlySlots[slotIndex] = updatedSlot;
      }

      const targetShift = shiftType === 'day' ? dayShiftBucket : nightShiftBucket;
      Object.assign(targetShift, {
        active: targetShift.active + (status === 'active' ? 1 : 0),
        resolved: targetShift.resolved + (status === 'completed' ? 1 : 0),
        total: targetShift.total + 1,
        downtimeHours: roundOneDecimal(targetShift.downtimeHours + durationHours),
      });

      return {
        id: row.id,
        machineName,
        machineType,
        fleetId: row.fleet_id?.trim() || '—',
        siteCode: resolveSiteCode({ explicitSiteCode: row.site_code, machineRow: matchedMachine }),
        shiftType,
        dateIn: row.date_in,
        timeIn: row.time_in?.trim() || '—',
        dateOut: row.date_out?.trim() || '—',
        timeOut: row.time_out?.trim() || '—',
        durationHours,
        reason: row.reason,
        repairNotes: row.repair_notes?.trim() || '—',
        status,
        createdAt: row.created_at,
      };
    });

  return {
    today: options.today,
    kpis: {
      loggedLast24h: records.length,
      stillActive,
      completedResolved,
      totalDowntimeHours: roundOneDecimal(totalDowntimeHours),
      mttrHours:
        completedWithDurationCount > 0
          ? roundOneDecimal(completedDurationSum / completedWithDurationCount)
          : 0,
      activeMachinesCount: options.machines.length,
    },
    records,
    hourlyActivity: hourlySlots,
    shiftBreakdown: [dayShiftBucket, nightShiftBucket],
    machineTypes: Array.from(machineTypeSet).sort((left, right) => left.localeCompare(right)),
  };
}
