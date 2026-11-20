export interface RawBreakdownMetricRow {
  readonly id: string;
  readonly fleet_id?: string | null;
  readonly machine_id?: string | null;
  readonly machine_name: string | null;
  readonly machine_type?: string | null;
  readonly reason: string;
  readonly status: string;
  readonly priority?: string | null;
  readonly date_in?: string | null;
  readonly time_in?: string | null;
  readonly date_out?: string | null;
  readonly time_out?: string | null;
  readonly duration_hours?: number | null;
  readonly duration_minutes?: number | null;
  readonly delay_hours?: number | null;
  readonly shift_type?: string | null;
  readonly site_code?: string | null;
  readonly created_at: string;
  readonly updated_at?: string | null;
}

export interface RawMachineMetricRow {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly serial_number: string | null;
  readonly active: boolean;
  readonly site_id?: string | null;
}

export interface RawTireMetricRow {
  readonly id: string;
  readonly serial_number: string;
  readonly brand: string;
  readonly size: string;
  readonly position: string | null;
  readonly status: string;
  readonly installed_at: string | null;
  readonly installed_hours: number | null;
  readonly removed_at: string | null;
  readonly machine_id: string | null;
}

export interface RawTireInspectionMetricRow {
  readonly id: string;
  readonly tire_id: string;
  readonly inspection_date: string;
  readonly tread_depth_mm: number | null;
  readonly pressure_psi: number | null;
  readonly condition_status: string;
  readonly notes: string | null;
}

export interface RawMachineHoursMetricRow {
  readonly id?: string;
  readonly machine_id: string;
  readonly daily_log_date: string | null;
  readonly hours_worked: number | null;
  readonly created_at: string;
}

export interface RawMachineOperationMetricRow {
  readonly id?: string;
  readonly machine_id: string;
  readonly shift_date: string | null;
  readonly daily_log_date: string | null;
  readonly hours_worked: number | null;
  readonly start_smu: number | null;
  readonly end_smu: number | null;
  readonly created_at: string;
}

export interface BreakdownSummary {
  readonly id: string;
  readonly machine_name: string;
  readonly reason: string;
  readonly priority: string;
  readonly created_at: string;
}

export interface BreakdownReportRow {
  readonly id: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly fleetId: string;
  readonly siteCode: string;
  readonly shiftType: string;
  readonly dateIn: string;
  readonly timeIn: string;
  readonly status: 'active' | 'completed';
  readonly durationHours: number;
  readonly reason: string;
}

export interface DailyBreakdownTrendPoint {
  readonly date: string;
  readonly label: string;
  readonly logged: number;
  readonly resolved: number;
  readonly downtimeHours: number;
}

export interface MachineTypeBreakdownStat {
  readonly machineType: string;
  readonly total: number;
  readonly active: number;
  readonly resolved: number;
  readonly downtimeHours: number;
}

export interface TireHealthBucket {
  readonly label: string;
  readonly count: number;
  readonly colorVar: string;
}

export interface TireAlertRow {
  readonly id: string;
  readonly serialNumber: string;
  readonly brand: string;
  readonly size: string;
  readonly machineName: string;
  readonly position: string;
  readonly status: string;
  readonly treadDepthMm: number | null;
  readonly pressurePsi: number | null;
  readonly conditionStatus: string;
  readonly installedHours: number;
  readonly isCritical: boolean;
}

export interface MachineMaintenanceSummaryRow {
  readonly id: string;
  readonly name: string;
  readonly machineType: string;
  readonly active: boolean;
  readonly hoursWorked30d: number;
  readonly breakdownCount30d: number;
  readonly activeBreakdowns: number;
  readonly downtimeHours30d: number;
  readonly installedTires: number;
}

export interface EngineeringHubMetrics {
  readonly activeBreakdowns: number;
  readonly resolvedToday: number;
  readonly recentBreakdowns: BreakdownSummary[];
  readonly totalMachines: number;
  readonly activeMachines: number;
  readonly availabilityPct: number;
  readonly totalTires: number;
  readonly installedTires: number;
  readonly inventoryTires: number;
  readonly criticalTires: number;
  readonly totalHoursWorked30d: number;
  readonly avgMttrHours: number;
  readonly trend14d: DailyBreakdownTrendPoint[];
  readonly byMachineType: MachineTypeBreakdownStat[];
  readonly tireHealthDistribution: TireHealthBucket[];
  readonly breakdownReports: BreakdownReportRow[];
  readonly tireAlerts: TireAlertRow[];
  readonly machineSummaries: MachineMaintenanceSummaryRow[];
}

export interface BuildEngineeringHubInput {
  readonly activeBreakdownsCount: number;
  readonly resolvedTodayCount: number;
  readonly recentActiveRows: readonly RawBreakdownMetricRow[];
  readonly breakdownHistoryRows: readonly RawBreakdownMetricRow[];
  readonly machineRows: readonly RawMachineMetricRow[];
  readonly tireRows: readonly RawTireMetricRow[];
  readonly tireInspectionRows: readonly RawTireInspectionMetricRow[];
  readonly machineHoursRows: readonly RawMachineHoursMetricRow[];
  readonly machineOperationRows: readonly RawMachineOperationMetricRow[];
  readonly referenceDateIso: string;
}

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const MINUTES_PER_HOUR = 60;
const TREND_DAYS = 14;
const CRITICAL_TREAD_MM = 15;
const MONITOR_TREAD_MM = 25;
const PERCENT_SCALE = 100;
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** RFC-4180 CSV cell escaper with formula-injection neutralization for engineering exports. */
export function escapeEngineeringCsvCell(rawCell: string): string {
  const safeText = CSV_FORMULA_PREFIX.test(rawCell) ? `'${rawCell}` : rawCell;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function roundOneDecimal(num: number): number {
  return Math.round(num * 10) / 10;
}

function toIsoDay(rawTimestamp: string | null | undefined): string {
  if (!rawTimestamp) return '';
  return rawTimestamp.slice(0, 10);
}

function formatTrendDayLabel(isoDay: string): string {
  const parsed = new Date(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDay;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function shiftIsoDate(baseIsoDay: string, offsetDays: number): string {
  const baseMs = new Date(`${baseIsoDay}T00:00:00Z`).getTime();
  if (Number.isNaN(baseMs)) return baseIsoDay;
  return new Date(baseMs + offsetDays * MS_PER_DAY).toISOString().slice(0, 10);
}

function resolveBreakdownDurationHours(row: RawBreakdownMetricRow): number {
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
  return 0;
}

function resolveOperationHours(row: RawMachineOperationMetricRow): number {
  if (row.hours_worked != null && Number(row.hours_worked) >= 0) {
    return Number(row.hours_worked);
  }
  if (row.end_smu != null && row.start_smu != null && row.end_smu >= row.start_smu) {
    return Number(row.end_smu) - Number(row.start_smu);
  }
  return 0;
}

function buildMachineHoursLookup(options: {
  readonly machineHoursRows: readonly RawMachineHoursMetricRow[];
  readonly machineOperationRows: readonly RawMachineOperationMetricRow[];
}): {
  readonly byMachineId: Map<string, number>;
  readonly totalHours: number;
} {
  const mhByKey = new Map<string, number>();
  for (const row of options.machineHoursRows) {
    const dayKey = toIsoDay(row.daily_log_date ?? row.created_at);
    const mapKey = `${row.machine_id}::${dayKey}`;
    mhByKey.set(mapKey, (mhByKey.get(mapKey) ?? 0) + Math.max(0, Number(row.hours_worked ?? 0)));
  }

  const opByKey = new Map<string, number>();
  for (const row of options.machineOperationRows) {
    const dayKey = toIsoDay(row.shift_date ?? row.daily_log_date ?? row.created_at);
    const mapKey = `${row.machine_id}::${dayKey}`;
    opByKey.set(mapKey, (opByKey.get(mapKey) ?? 0) + resolveOperationHours(row));
  }

  const combinedKeys = new Set<string>([...mhByKey.keys(), ...opByKey.keys()]);
  const byMachineId = new Map<string, number>();
  let totalHours = 0;

  // Prefer the higher daily reading between machine_hours and machine_operations to prevent double-counting.
  for (const mapKey of combinedKeys) {
    const [machineId] = mapKey.split('::');
    if (!machineId) continue;
    const hoursForDay = Math.max(mhByKey.get(mapKey) ?? 0, opByKey.get(mapKey) ?? 0);
    byMachineId.set(machineId, (byMachineId.get(machineId) ?? 0) + hoursForDay);
    totalHours += hoursForDay;
  }

  return { byMachineId, totalHours: roundOneDecimal(totalHours) };
}

function buildTrendBuckets(options: {
  readonly breakdownRows: readonly RawBreakdownMetricRow[];
  readonly referenceDateIso: string;
}): DailyBreakdownTrendPoint[] {
  const buckets = new Map<
    string,
    { logged: number; resolved: number; downtimeHours: number; label: string }
  >();

  for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
    const isoDay = shiftIsoDate(options.referenceDateIso, -offset);
    buckets.set(isoDay, {
      logged: 0,
      resolved: 0,
      downtimeHours: 0,
      label: formatTrendDayLabel(isoDay),
    });
  }

  for (const row of options.breakdownRows) {
    const loggedDay = toIsoDay(row.date_in ?? row.created_at);
    const duration = resolveBreakdownDurationHours(row);
    const loggedBucket = buckets.get(loggedDay);
    if (loggedBucket) {
      loggedBucket.logged += 1;
      loggedBucket.downtimeHours = roundOneDecimal(loggedBucket.downtimeHours + duration);
    }

    if (row.status === 'completed') {
      const resolvedDay = toIsoDay(row.date_out ?? row.updated_at ?? row.created_at);
      const resolvedBucket = buckets.get(resolvedDay);
      if (resolvedBucket) {
        resolvedBucket.resolved += 1;
      }
    }
  }

  return Array.from(buckets.entries()).map(([date, bucket]) => ({
    date,
    label: bucket.label,
    logged: bucket.logged,
    resolved: bucket.resolved,
    downtimeHours: bucket.downtimeHours,
  }));
}

function buildMachineTypeStats(
  breakdownRows: readonly RawBreakdownMetricRow[]
): MachineTypeBreakdownStat[] {
  const statsMap = new Map<
    string,
    { total: number; active: number; resolved: number; downtimeHours: number }
  >();

  for (const row of breakdownRows) {
    const machineType = row.machine_type?.trim() || 'Unspecified';
    const current = statsMap.get(machineType) ?? {
      total: 0,
      active: 0,
      resolved: 0,
      downtimeHours: 0,
    };
    current.total += 1;
    if (row.status === 'active') {
      current.active += 1;
    } else if (row.status === 'completed') {
      current.resolved += 1;
    }
    current.downtimeHours = roundOneDecimal(
      current.downtimeHours + resolveBreakdownDurationHours(row)
    );
    statsMap.set(machineType, current);
  }

  return Array.from(statsMap.entries())
    .map(([machineType, entry]) => ({
      machineType,
      total: entry.total,
      active: entry.active,
      resolved: entry.resolved,
      downtimeHours: entry.downtimeHours,
    }))
    .sort((left, right) => right.total - left.total || right.downtimeHours - left.downtimeHours);
}

function buildTireTelemetry(options: {
  readonly tireRows: readonly RawTireMetricRow[];
  readonly tireInspectionRows: readonly RawTireInspectionMetricRow[];
  readonly machineNameById: Map<string, string>;
}): {
  readonly totalTires: number;
  readonly installedTires: number;
  readonly inventoryTires: number;
  readonly criticalTires: number;
  readonly installedByMachineId: Map<string, number>;
  readonly tireHealthDistribution: TireHealthBucket[];
  readonly tireAlerts: TireAlertRow[];
} {
  const latestInspectionByTire = new Map<string, RawTireInspectionMetricRow>();
  for (const insp of options.tireInspectionRows) {
    if (!latestInspectionByTire.has(insp.tire_id)) {
      latestInspectionByTire.set(insp.tire_id, insp);
    }
  }

  let installedTires = 0;
  let inventoryTires = 0;
  let criticalTires = 0;
  let healthyCount = 0;
  let monitorCount = 0;
  let criticalBandCount = 0;
  let sparesOrPendingCount = 0;

  const installedByMachineId = new Map<string, number>();
  const alerts: TireAlertRow[] = [];

  for (const tire of options.tireRows) {
    const latestInspection = latestInspectionByTire.get(tire.id);
    const treadMm =
      latestInspection?.tread_depth_mm != null ? Number(latestInspection.tread_depth_mm) : null;
    const psi =
      latestInspection?.pressure_psi != null ? Number(latestInspection.pressure_psi) : null;
    const conditionStatus = latestInspection?.condition_status ?? 'pending';
    const isCritical =
      conditionStatus === 'critical' || (treadMm !== null && treadMm < CRITICAL_TREAD_MM);

    if (tire.status === 'installed') {
      installedTires += 1;
      if (tire.machine_id) {
        installedByMachineId.set(
          tire.machine_id,
          (installedByMachineId.get(tire.machine_id) ?? 0) + 1
        );
      }
      if (isCritical) {
        criticalTires += 1;
        criticalBandCount += 1;
      } else if (treadMm !== null && treadMm < MONITOR_TREAD_MM) {
        monitorCount += 1;
      } else if (treadMm !== null) {
        healthyCount += 1;
      } else {
        sparesOrPendingCount += 1;
      }
    } else if (tire.status === 'inventory') {
      inventoryTires += 1;
      sparesOrPendingCount += 1;
    } else {
      sparesOrPendingCount += 1;
    }

    alerts.push({
      id: tire.id,
      serialNumber: tire.serial_number,
      brand: tire.brand,
      size: tire.size,
      machineName: tire.machine_id
        ? (options.machineNameById.get(tire.machine_id) ?? 'Unassigned')
        : 'Inventory Spare',
      position: tire.position ?? '—',
      status: tire.status,
      treadDepthMm: treadMm,
      pressurePsi: psi,
      conditionStatus,
      installedHours: Number(tire.installed_hours ?? 0),
      isCritical,
    });
  }

  const tireHealthDistribution: TireHealthBucket[] = [
    { label: 'Healthy (>=25mm)', count: healthyCount, colorVar: 'var(--accent-green)' },
    { label: 'Monitor (15–24mm)', count: monitorCount, colorVar: 'var(--accent-amber)' },
    { label: 'Critical (<15mm / Alert)', count: criticalBandCount, colorVar: 'var(--accent-red)' },
    {
      label: 'Spares / Pending',
      count: sparesOrPendingCount,
      colorVar: 'var(--accent-blue)',
    },
  ].filter((bucket) => bucket.count > 0);

  alerts.sort((left, right) => {
    if (left.isCritical !== right.isCritical) return left.isCritical ? -1 : 1;
    const leftTread = left.treadDepthMm ?? Number.MAX_SAFE_INTEGER;
    const rightTread = right.treadDepthMm ?? Number.MAX_SAFE_INTEGER;
    return leftTread - rightTread;
  });

  return {
    totalTires: options.tireRows.length,
    installedTires,
    inventoryTires,
    criticalTires,
    installedByMachineId,
    tireHealthDistribution,
    tireAlerts: alerts.slice(0, 20),
  };
}

/**
 * Pure aggregator transforming raw Supabase engineering telemetry rows into
 * KPI cards, Recharts series, and detailed operational reporting tables.
 */
export function buildEngineeringHubMetrics(input: BuildEngineeringHubInput): EngineeringHubMetrics {
  const machineNameById = new Map<string, string>();
  const machineIdByNormalizedName = new Map<string, string>();
  let activeMachines = 0;

  for (const machine of input.machineRows) {
    machineNameById.set(machine.id, machine.name);
    machineIdByNormalizedName.set(machine.name.trim().toLowerCase(), machine.id);
    if (machine.active) {
      activeMachines += 1;
    }
  }

  const totalMachines = input.machineRows.length;
  const availabilityPct =
    totalMachines > 0 ? Math.round((activeMachines / totalMachines) * PERCENT_SCALE) : 0;

  const hoursLookup = buildMachineHoursLookup({
    machineHoursRows: input.machineHoursRows,
    machineOperationRows: input.machineOperationRows,
  });

  const tireTelemetry = buildTireTelemetry({
    tireRows: input.tireRows,
    tireInspectionRows: input.tireInspectionRows,
    machineNameById,
  });

  const breakdownsByMachineId = new Map<
    string,
    { total: number; active: number; downtimeHours: number }
  >();
  let completedDurationSum = 0;
  let completedWithDurationCount = 0;

  const breakdownReports: BreakdownReportRow[] = input.breakdownHistoryRows.map((row) => {
    const durationHours = resolveBreakdownDurationHours(row);
    if (row.status === 'completed' && durationHours > 0) {
      completedDurationSum += durationHours;
      completedWithDurationCount += 1;
    }

    const matchedMachineId =
      row.machine_id ??
      machineIdByNormalizedName.get((row.machine_name ?? '').trim().toLowerCase()) ??
      machineIdByNormalizedName.get((row.fleet_id ?? '').trim().toLowerCase());

    if (matchedMachineId) {
      const current = breakdownsByMachineId.get(matchedMachineId) ?? {
        total: 0,
        active: 0,
        downtimeHours: 0,
      };
      current.total += 1;
      if (row.status === 'active') current.active += 1;
      current.downtimeHours = roundOneDecimal(current.downtimeHours + durationHours);
      breakdownsByMachineId.set(matchedMachineId, current);
    }

    return {
      id: row.id,
      machineName: row.machine_name?.trim() || row.fleet_id?.trim() || 'Unassigned Machine',
      machineType: row.machine_type?.trim() || 'Unspecified',
      fleetId: row.fleet_id?.trim() || '—',
      siteCode: row.site_code?.trim() || '—',
      shiftType: row.shift_type?.trim() || '—',
      dateIn: row.date_in?.trim() || toIsoDay(row.created_at),
      timeIn: row.time_in?.trim() || '—',
      status: row.status === 'completed' ? 'completed' : 'active',
      durationHours,
      reason: row.reason,
    };
  });

  const machineSummaries: MachineMaintenanceSummaryRow[] = input.machineRows
    .map((machine) => {
      const bdStats = breakdownsByMachineId.get(machine.id) ?? {
        total: 0,
        active: 0,
        downtimeHours: 0,
      };
      return {
        id: machine.id,
        name: machine.name,
        machineType: machine.machine_type,
        active: machine.active,
        hoursWorked30d: roundOneDecimal(hoursLookup.byMachineId.get(machine.id) ?? 0),
        breakdownCount30d: bdStats.total,
        activeBreakdowns: bdStats.active,
        downtimeHours30d: bdStats.downtimeHours,
        installedTires: tireTelemetry.installedByMachineId.get(machine.id) ?? 0,
      };
    })
    .sort(
      (left, right) =>
        right.breakdownCount30d - left.breakdownCount30d ||
        right.downtimeHours30d - left.downtimeHours30d ||
        right.hoursWorked30d - left.hoursWorked30d
    );

  const recentBreakdowns: BreakdownSummary[] = input.recentActiveRows.map((row) => ({
    id: row.id,
    machine_name: row.machine_name ?? '',
    reason: row.reason,
    priority: row.priority ?? (row.status === 'active' ? 'high' : 'normal'),
    created_at: row.created_at,
  }));

  return {
    activeBreakdowns: input.activeBreakdownsCount,
    resolvedToday: input.resolvedTodayCount,
    recentBreakdowns,
    totalMachines,
    activeMachines,
    availabilityPct,
    totalTires: tireTelemetry.totalTires,
    installedTires: tireTelemetry.installedTires,
    inventoryTires: tireTelemetry.inventoryTires,
    criticalTires: tireTelemetry.criticalTires,
    totalHoursWorked30d: hoursLookup.totalHours,
    avgMttrHours:
      completedWithDurationCount > 0
        ? roundOneDecimal(completedDurationSum / completedWithDurationCount)
        : 0,
    trend14d: buildTrendBuckets({
      breakdownRows: input.breakdownHistoryRows,
      referenceDateIso: input.referenceDateIso,
    }),
    byMachineType: buildMachineTypeStats(input.breakdownHistoryRows),
    tireHealthDistribution: tireTelemetry.tireHealthDistribution,
    breakdownReports,
    tireAlerts: tireTelemetry.tireAlerts,
    machineSummaries,
  };
}
