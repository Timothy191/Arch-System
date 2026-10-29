import {
  computeMachineOverviewMetrics,
  createStandardOverviewDelays,
  createZeroOverviewDelays,
  MAX_SHIFT_HOURS,
  OVERVIEW_DELAY_BY_CATEGORY,
  OVERVIEW_DELAY_KEYS,
  type OverviewDelayHours,
} from '@/lib/shift-sheet-buckets';
import type { RawMachineOperationRow } from './reports-server-queries';
import type {
  ArchivedMachineMonthSnapshot,
  FleetMachineItem,
  MachineDailyOverviewRecord,
  MachineMonthlySummaryRow,
} from './reports-types';

const DEFAULT_MONTH_DAYS = 30;
const MIN_MONTH_DAYS = 28;
const MAX_MONTH_DAYS = 31;
const PERCENT_MULTIPLIER = 100;
const DECIMAL_PLACES_TWO = 2;
const DECIMAL_PLACES_ONE = 1;
const MINUTES_PER_HOUR = 60;
const DEFAULT_BASELINE_SMR = 1200;

export const DEFAULT_MONTHLY_ALLOWANCE_COMMENT =
  'Standard shift allowances (Refueling 0.2h, Safety Talks 0.5h, Lunches 0.5h, GES/Maint 0.5h, Tyres/Trams 0.2h, Greasing/Startup 0.5h)';

export const MACHINE_ACTIVITY_ARCHIVE_STORAGE_KEY = 'arch_machine_monthly_activity_archive_v1';

export interface MonthCalendarDay {
  date: string;
  dayOfMonth: number;
}

export function getDaysInMonthCount(monthPrefix: string): number {
  const parts = monthPrefix.split('-');
  const yearNum = Number.parseInt(parts[0] ?? '', 10);
  const monthNum = Number.parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(yearNum) || Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return DEFAULT_MONTH_DAYS;
  }
  const computedDays = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
  return Math.min(MAX_MONTH_DAYS, Math.max(MIN_MONTH_DAYS, computedDays));
}

export function buildMonthCalendarDays(monthPrefix: string): MonthCalendarDay[] {
  const daysCount = getDaysInMonthCount(monthPrefix);
  const normalizedPrefix = /^\d{4}-\d{2}$/.test(monthPrefix) ? monthPrefix : '2026-10';
  return Array.from({ length: daysCount }, (_, index) => {
    const dayNumber = index + 1;
    const paddedDay = String(dayNumber).padStart(DECIMAL_PLACES_TWO, '0');
    return {
      date: `${normalizedPrefix}-${paddedDay}`,
      dayOfMonth: dayNumber,
    };
  });
}

function parseOperationDelaysAndComment(opRow: RawMachineOperationRow): {
  delays: OverviewDelayHours;
  comment: string;
} {
  const delays = createZeroOverviewDelays();
  let comment = '';
  for (const entry of opRow.delay_entries ?? []) {
    if (entry.deleted_at) continue;
    const rawCat = Array.isArray(entry.delay_category)
      ? entry.delay_category[0]?.name
      : entry.delay_category?.name;
    const catKey = (rawCat ?? '').trim().toLowerCase();
    const mappedBucket = OVERVIEW_DELAY_BY_CATEGORY[catKey];
    const effectiveHours =
      entry.is_manual_override && entry.manual_duration_hours != null
        ? Number(entry.manual_duration_hours)
        : Number(entry.duration_hours ?? 0);
    if (mappedBucket && Number.isFinite(effectiveHours) && effectiveHours > 0) {
      delays[mappedBucket] = Number(
        (delays[mappedBucket] + effectiveHours).toFixed(DECIMAL_PLACES_TWO)
      );
    }
    if (!comment && entry.description && entry.description.trim().length > 0) {
      comment = entry.description.trim();
    }
  }
  return { delays, comment };
}

export function mapOperationsToMachineDailyRecords(params: {
  operations: RawMachineOperationRow[];
  fleetMachines: FleetMachineItem[];
}): MachineDailyOverviewRecord[] {
  const machineById = new Map<string, FleetMachineItem>();
  for (const mach of params.fleetMachines) {
    machineById.set(mach.id, mach);
  }

  const recordsByKey = new Map<string, MachineDailyOverviewRecord>();
  for (const opRow of params.operations) {
    if (!opRow.machine_id || !opRow.shift_date) continue;
    const shiftType: 'day' | 'night' = opRow.shift_type === 'night' ? 'night' : 'day';
    const recordKey = `${opRow.machine_id}|${opRow.shift_date}|${shiftType}`;
    if (recordsByKey.has(recordKey)) continue;

    const machRel = Array.isArray(opRow.machine) ? opRow.machine[0] : opRow.machine;
    const opRel = Array.isArray(opRow.operator) ? opRow.operator[0] : opRow.operator;
    const siteRel = Array.isArray(opRow.site) ? opRow.site[0] : opRow.site;
    const fleetMach = machineById.get(opRow.machine_id);
    const { delays, comment } = parseOperationDelaysAndComment(opRow);
    const startSmr = Number(opRow.start_smu ?? fleetMach?.baselineSmr ?? DEFAULT_BASELINE_SMR);
    const stopSmr =
      opRow.end_smu != null && Number(opRow.end_smu) >= startSmr ? Number(opRow.end_smu) : startSmr;
    const dayNum = Number.parseInt(opRow.shift_date.slice(-DECIMAL_PLACES_TWO), 10) || 1;

    recordsByKey.set(recordKey, {
      machineId: opRow.machine_id,
      machineName: fleetMach?.name ?? machRel?.name ?? 'Machine',
      machineType: fleetMach?.machineType ?? machRel?.machine_type ?? 'Equipment',
      serialNumber: fleetMach?.serialNumber ?? machRel?.serial_number ?? null,
      siteId: fleetMach?.siteId ?? null,
      siteName: siteRel?.name ?? fleetMach?.siteName ?? 'General Pit',
      date: opRow.shift_date,
      dayOfMonth: dayNum,
      shiftType,
      startSmr,
      stopSmr,
      operatorId: null,
      operatorName: opRel?.full_name ?? opRow.operator_name ?? null,
      delays,
      comment: comment || DEFAULT_MONTHLY_ALLOWANCE_COMMENT,
      endsOnBreakdown: delays.breakdown > 0,
      hasExistingOperation: true,
    });
  }

  return Array.from(recordsByKey.values());
}

export function buildMachineMonth30DayRows(params: {
  machine: FleetMachineItem;
  monthPrefix: string;
  shiftType: 'day' | 'night';
  records: readonly MachineDailyOverviewRecord[];
}): MachineDailyOverviewRecord[] {
  const { machine, monthPrefix, shiftType, records } = params;
  const calendarDays = buildMonthCalendarDays(monthPrefix);
  const existingByDate = new Map<string, MachineDailyOverviewRecord>();

  for (const rec of records) {
    if (
      rec.machineId === machine.id &&
      rec.shiftType === shiftType &&
      rec.date.startsWith(monthPrefix)
    ) {
      existingByDate.set(rec.date, rec);
    }
  }

  let runningSmr = machine.baselineSmr > 0 ? machine.baselineSmr : DEFAULT_BASELINE_SMR;

  return calendarDays.map((dayEntry) => {
    const existing = existingByDate.get(dayEntry.date);
    if (existing) {
      runningSmr = existing.stopSmr >= existing.startSmr ? existing.stopSmr : existing.startSmr;
      return {
        ...existing,
        delays: { ...existing.delays },
      };
    }

    return {
      machineId: machine.id,
      machineName: machine.name,
      machineType: machine.machineType,
      serialNumber: machine.serialNumber,
      siteId: machine.siteId,
      siteName: machine.siteName,
      date: dayEntry.date,
      dayOfMonth: dayEntry.dayOfMonth,
      shiftType,
      startSmr: runningSmr,
      stopSmr: runningSmr,
      operatorId: null,
      operatorName: null,
      delays: createStandardOverviewDelays(),
      comment: DEFAULT_MONTHLY_ALLOWANCE_COMMENT,
      endsOnBreakdown: false,
      hasExistingOperation: false,
    };
  });
}

function addDelayHours(
  targetDelays: OverviewDelayHours,
  sourceDelays: OverviewDelayHours
): OverviewDelayHours {
  const nextDelays: OverviewDelayHours = { ...targetDelays };
  for (const key of OVERVIEW_DELAY_KEYS) {
    nextDelays[key] = Number(
      ((nextDelays[key] ?? 0) + (sourceDelays[key] ?? 0)).toFixed(DECIMAL_PLACES_TWO)
    );
  }
  return nextDelays;
}

export function computeSingleMachineMonthlySummary(params: {
  machine: FleetMachineItem;
  monthPrefix: string;
  dayRows: readonly MachineDailyOverviewRecord[];
}): MachineMonthlySummaryRow {
  const { machine, monthPrefix, dayRows } = params;
  const daysInMonth = dayRows.length || getDaysInMonthCount(monthPrefix);
  let cumulativeDelays = createZeroOverviewDelays();
  let totalSmrWorked = 0;
  let activeDaysLogged = 0;

  const firstRow = dayRows[0];
  const lastRow = dayRows[dayRows.length - 1];
  const openingSmr = firstRow ? firstRow.startSmr : machine.baselineSmr;
  let closingSmr = lastRow ? lastRow.stopSmr : openingSmr;

  for (const row of dayRows) {
    const worked = Math.min(
      MAX_SHIFT_HOURS,
      Math.max(0, Number((row.stopSmr - row.startSmr).toFixed(DECIMAL_PLACES_TWO)))
    );
    totalSmrWorked = Number((totalSmrWorked + worked).toFixed(DECIMAL_PLACES_TWO));
    if (row.stopSmr > closingSmr) {
      closingSmr = row.stopSmr;
    }
    if (row.hasExistingOperation || worked > 0) {
      activeDaysLogged += 1;
    }
    cumulativeDelays = addDelayHours(cumulativeDelays, row.delays);
  }

  const scheduledHours = daysInMonth * MAX_SHIFT_HOURS;
  const aggMetrics = computeMachineOverviewMetrics(
    0,
    totalSmrWorked,
    cumulativeDelays,
    scheduledHours
  );

  return {
    machineId: machine.id,
    machineName: machine.name,
    machineType: machine.machineType,
    serialNumber: machine.serialNumber,
    siteName: machine.siteName,
    month: monthPrefix,
    daysInMonth,
    activeDaysLogged,
    openingSmr,
    closingSmr,
    totalSmrWorked,
    delays: cumulativeDelays,
    productionDelayHours: aggMetrics.productionDelayHours,
    nonProductionDelayHours: aggMetrics.nonProductionDelayHours,
    engineeringDelayHours: aggMetrics.engineeringDelayHours,
    totalDelayHours: aggMetrics.totalDelayHours,
    scheduledHours,
    availableHours: aggMetrics.availableHours,
    availabilityPercent: aggMetrics.availabilityPercent,
    utilizationPercent: aggMetrics.utilizationPercent,
  };
}

export function computeFleetMonthlySummaryRows(params: {
  fleetMachines: readonly FleetMachineItem[];
  monthPrefix: string;
  shiftType: 'day' | 'night';
  records: readonly MachineDailyOverviewRecord[];
}): MachineMonthlySummaryRow[] {
  const { fleetMachines, monthPrefix, shiftType, records } = params;
  return fleetMachines.map((machine) => {
    const dayRows = buildMachineMonth30DayRows({
      machine,
      monthPrefix,
      shiftType,
      records,
    });
    return computeSingleMachineMonthlySummary({
      machine,
      monthPrefix,
      dayRows,
    });
  });
}

export function buildArchivedMonthSnapshot(params: {
  monthPrefix: string;
  fleetMachines: readonly FleetMachineItem[];
  shiftType: 'day' | 'night';
  records: readonly MachineDailyOverviewRecord[];
  isSealed: boolean;
}): ArchivedMachineMonthSnapshot {
  const { monthPrefix, fleetMachines, shiftType, records, isSealed } = params;
  const summaries = computeFleetMonthlySummaryRows({
    fleetMachines,
    monthPrefix,
    shiftType,
    records,
  });

  const monthRecords = records.filter((rec) => rec.date.startsWith(monthPrefix));
  const totalSmrWorked = Number(
    summaries.reduce((sum, row) => sum + row.totalSmrWorked, 0).toFixed(DECIMAL_PLACES_ONE)
  );
  const count = summaries.length || 1;
  const fleetAvailabilityPercent = Number(
    (summaries.reduce((sum, row) => sum + row.availabilityPercent, 0) / count).toFixed(
      DECIMAL_PLACES_ONE
    )
  );
  const fleetUtilizationPercent = Number(
    (summaries.reduce((sum, row) => sum + row.utilizationPercent, 0) / count).toFixed(
      DECIMAL_PLACES_ONE
    )
  );

  return {
    month: monthPrefix,
    archivedAt: new Date().toISOString(),
    isSealed,
    machineCount: summaries.length,
    totalSmrWorked,
    fleetAvailabilityPercent,
    fleetUtilizationPercent,
    records: monthRecords,
    summaries,
  };
}

export function loadStoredMachineMonthArchives(
  initialSnapshots: readonly ArchivedMachineMonthSnapshot[]
): ArchivedMachineMonthSnapshot[] {
  if (typeof window === 'undefined') {
    return [...initialSnapshots];
  }
  try {
    const rawJson = window.localStorage.getItem(MACHINE_ACTIVITY_ARCHIVE_STORAGE_KEY);
    if (!rawJson) return [...initialSnapshots];
    const parsed = JSON.parse(rawJson) as ArchivedMachineMonthSnapshot[];
    if (!Array.isArray(parsed)) return [...initialSnapshots];

    const mergedByMonth = new Map<string, ArchivedMachineMonthSnapshot>();
    for (const snap of initialSnapshots) {
      mergedByMonth.set(snap.month, snap);
    }
    for (const storedSnap of parsed) {
      if (storedSnap && typeof storedSnap.month === 'string') {
        mergedByMonth.set(storedSnap.month, storedSnap);
      }
    }
    return Array.from(mergedByMonth.values()).sort((a, b) => b.month.localeCompare(a.month));
  } catch {
    return [...initialSnapshots];
  }
}

export function saveStoredMachineMonthArchives(
  snapshots: readonly ArchivedMachineMonthSnapshot[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MACHINE_ACTIVITY_ARCHIVE_STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export function deriveFallbackFleetMachinesFromLogs(params: {
  fleetMachines: readonly FleetMachineItem[];
  machineOperationLogs: ReadonlyArray<{
    machineName: string;
    machineType: string;
    siteName: string;
    startSmu: number | null;
    endSmu: number | null;
    date: string;
    shift: 'day' | 'night';
    operatorName: string;
    delayMinutes: number;
  }>;
}): {
  machines: FleetMachineItem[];
  records: MachineDailyOverviewRecord[];
} {
  if (params.fleetMachines.length > 0) {
    return {
      machines: [...params.fleetMachines],
      records: [],
    };
  }
  const byName = new Map<string, FleetMachineItem>();
  const synthesizedRecords: MachineDailyOverviewRecord[] = [];

  for (const logEntry of params.machineOperationLogs) {
    const slugId = `mach-${logEntry.machineName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (!byName.has(slugId)) {
      byName.set(slugId, {
        id: slugId,
        name: logEntry.machineName,
        machineType: logEntry.machineType || 'Equipment',
        serialNumber: null,
        siteId: null,
        siteName: logEntry.siteName || 'General Pit',
        baselineSmr: logEntry.startSmu ?? DEFAULT_BASELINE_SMR,
      });
    }
    const delays = createStandardOverviewDelays();
    if (logEntry.delayMinutes > 0) {
      delays.other = Number((logEntry.delayMinutes / MINUTES_PER_HOUR).toFixed(DECIMAL_PLACES_TWO));
    }
    const startSmr = logEntry.startSmu ?? DEFAULT_BASELINE_SMR;
    const stopSmr = logEntry.endSmu ?? startSmr;
    const dayNum = Number.parseInt(logEntry.date.slice(-DECIMAL_PLACES_TWO), 10) || 1;
    synthesizedRecords.push({
      machineId: slugId,
      machineName: logEntry.machineName,
      machineType: logEntry.machineType || 'Equipment',
      serialNumber: null,
      siteId: null,
      siteName: logEntry.siteName || 'General Pit',
      date: logEntry.date,
      dayOfMonth: dayNum,
      shiftType: logEntry.shift,
      startSmr,
      stopSmr,
      operatorId: null,
      operatorName: logEntry.operatorName || null,
      delays,
      comment: DEFAULT_MONTHLY_ALLOWANCE_COMMENT,
      endsOnBreakdown: false,
      hasExistingOperation: true,
    });
  }

  return {
    machines: Array.from(byName.values()),
    records: synthesizedRecords,
  };
}
