export interface MachineSiteSummary {
  readonly name: string | null;
  readonly site_code: string | null;
}

export interface DepartmentMachineRow {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly serial_number: string | null;
  readonly bin_factor: number | null;
  readonly active: boolean;
  readonly created_at: string;
  readonly site: MachineSiteSummary | MachineSiteSummary[] | null;
}

export interface RawMachineBreakdownRow {
  readonly id: string;
  readonly machine_id: string | null;
  readonly fleet_id: string;
  readonly machine_name: string | null;
  readonly status: string;
  readonly date_in: string;
  readonly created_at: string;
}

export interface RawMachineTireRow {
  readonly id: string;
  readonly machine_id: string | null;
  readonly status: string;
  readonly installed_at: string | null;
  readonly removed_at: string | null;
  readonly created_at: string;
}

export interface RawMachineTireInspectionRow {
  readonly id: string;
  readonly tire_id: string;
  readonly inspection_date: string;
  readonly created_at: string;
}

export interface RawMachineHoursRow {
  readonly machine_id: string;
  readonly daily_log_date: string | null;
  readonly hours_worked: number | null;
  readonly created_at: string;
}

export interface RawMachineOpsRow {
  readonly machine_id: string;
  readonly shift_date: string;
  readonly daily_log_date: string | null;
  readonly hours_worked: number | null;
  readonly start_smu: number | null;
  readonly end_smu: number | null;
  readonly created_at: string;
}

export interface MachineActivityDayPoint {
  readonly isoDate: string;
  readonly day: string;
  readonly breakdowns: number;
  readonly tireEvents: number;
  readonly hours: number;
}

export interface MachinePanelTelemetry {
  readonly totalHoursWorked: number;
  readonly current7dHours: number;
  readonly previous7dHours: number;
  readonly hoursDeltaPct: number;
  readonly totalBreakdowns: number;
  readonly activeBreakdowns: number;
  readonly installedTiresCount: number;
  readonly tireEventsCount: number;
  readonly activitySeries: MachineActivityDayPoint[];
}

export interface EnrichedDepartmentMachine extends DepartmentMachineRow {
  readonly telemetry: MachinePanelTelemetry;
}

export interface SiteMachineGroup {
  readonly siteKey: string;
  readonly siteCode: string;
  readonly siteName: string;
  readonly machines: EnrichedDepartmentMachine[];
}

export interface BuildMachineTelemetryOptions {
  readonly machines: readonly DepartmentMachineRow[];
  readonly breakdowns: readonly RawMachineBreakdownRow[];
  readonly tires: readonly RawMachineTireRow[];
  readonly tireInspections: readonly RawMachineTireInspectionRow[];
  readonly machineHours: readonly RawMachineHoursRow[];
  readonly machineOperations: readonly RawMachineOpsRow[];
  readonly today: string;
}

const MS_PER_DAY = 86_400_000;
const SPARKLINE_DAYS = 7;
const PERCENT_SCALE = 100;

function roundOneDecimal(num: number): number {
  return Math.round(num * 10) / 10;
}

export function shiftIsoDay(baseIsoDay: string, offsetDays: number): string {
  const baseMs = new Date(`${baseIsoDay}T00:00:00Z`).getTime();
  if (Number.isNaN(baseMs)) return baseIsoDay;
  return new Date(baseMs + offsetDays * MS_PER_DAY).toISOString().slice(0, 10);
}

function formatDayTick(isoDay: string): string {
  const parsed = new Date(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDay;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function toIsoDay(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.slice(0, 10);
}

function resolveOperationHours(row: RawMachineOpsRow): number {
  if (row.hours_worked != null && Number(row.hours_worked) >= 0) {
    return Number(row.hours_worked);
  }
  if (row.end_smu != null && row.start_smu != null && row.end_smu >= row.start_smu) {
    return Number(row.end_smu) - Number(row.start_smu);
  }
  return 0;
}

export function createEmptyMachineTelemetry(today: string): MachinePanelTelemetry {
  const activitySeries: MachineActivityDayPoint[] = [];
  for (let offset = SPARKLINE_DAYS - 1; offset >= 0; offset -= 1) {
    const isoDate = shiftIsoDay(today, -offset);
    activitySeries.push({
      isoDate,
      day: formatDayTick(isoDate),
      breakdowns: 0,
      tireEvents: 0,
      hours: 0,
    });
  }
  return {
    totalHoursWorked: 0,
    current7dHours: 0,
    previous7dHours: 0,
    hoursDeltaPct: 0,
    totalBreakdowns: 0,
    activeBreakdowns: 0,
    installedTiresCount: 0,
    tireEventsCount: 0,
    activitySeries,
  };
}

/**
 * Computes per-machine 7-day Tyre & Breakdown activity series, hours worked totals,
 * and week-over-week % delta for every machine panel.
 */
export function buildMachineTelemetryMap(
  options: BuildMachineTelemetryOptions
): Record<string, MachinePanelTelemetry> {
  const currentStart = shiftIsoDay(options.today, -(SPARKLINE_DAYS - 1));
  const previousStart = shiftIsoDay(options.today, -(SPARKLINE_DAYS * 2 - 1));
  const machineIdByLowerName = new Map<string, string>();

  for (const machine of options.machines) {
    machineIdByLowerName.set(machine.name.trim().toLowerCase(), machine.id);
  }

  // Build daily hours map deduplicated between machine_hours and machine_operations per machine+day
  const mhByMachineDay = new Map<string, number>();
  for (const row of options.machineHours) {
    const isoDay = toIsoDay(row.daily_log_date ?? row.created_at);
    if (!isoDay) continue;
    const key = `${row.machine_id}::${isoDay}`;
    mhByMachineDay.set(
      key,
      (mhByMachineDay.get(key) ?? 0) + Math.max(0, Number(row.hours_worked ?? 0))
    );
  }

  const opByMachineDay = new Map<string, number>();
  for (const row of options.machineOperations) {
    const isoDay = toIsoDay(row.shift_date ?? row.daily_log_date ?? row.created_at);
    if (!isoDay) continue;
    const key = `${row.machine_id}::${isoDay}`;
    opByMachineDay.set(key, (opByMachineDay.get(key) ?? 0) + resolveOperationHours(row));
  }

  const allMachineDayKeys = new Set<string>([...mhByMachineDay.keys(), ...opByMachineDay.keys()]);
  const combinedHoursByMachineDay = new Map<string, number>();
  for (const key of allMachineDayKeys) {
    combinedHoursByMachineDay.set(
      key,
      Math.max(mhByMachineDay.get(key) ?? 0, opByMachineDay.get(key) ?? 0)
    );
  }

  // Group breakdowns by resolved machine ID
  const breakdownsByMachine = new Map<string, RawMachineBreakdownRow[]>();
  for (const bd of options.breakdowns) {
    const resolvedId =
      bd.machine_id ??
      machineIdByLowerName.get((bd.machine_name ?? '').trim().toLowerCase()) ??
      machineIdByLowerName.get(bd.fleet_id.trim().toLowerCase());
    if (!resolvedId) continue;
    const existing = breakdownsByMachine.get(resolvedId) ?? [];
    existing.push(bd);
    breakdownsByMachine.set(resolvedId, existing);
  }

  // Map tires and tire inspections to machine ID
  const tireToMachineId = new Map<string, string>();
  const tiresByMachine = new Map<string, RawMachineTireRow[]>();
  for (const tire of options.tires) {
    if (!tire.machine_id) continue;
    tireToMachineId.set(tire.id, tire.machine_id);
    const existing = tiresByMachine.get(tire.machine_id) ?? [];
    existing.push(tire);
    tiresByMachine.set(tire.machine_id, existing);
  }

  const inspectionsByMachine = new Map<string, RawMachineTireInspectionRow[]>();
  for (const insp of options.tireInspections) {
    const machineId = tireToMachineId.get(insp.tire_id);
    if (!machineId) continue;
    const existing = inspectionsByMachine.get(machineId) ?? [];
    existing.push(insp);
    inspectionsByMachine.set(machineId, existing);
  }

  const result: Record<string, MachinePanelTelemetry> = {};

  for (const machine of options.machines) {
    const baseSeries: MachineActivityDayPoint[] = [];
    const seriesByIso = new Map<
      string,
      { breakdowns: number; tireEvents: number; hours: number }
    >();

    for (let offset = SPARKLINE_DAYS - 1; offset >= 0; offset -= 1) {
      const isoDate = shiftIsoDay(options.today, -offset);
      const point = { breakdowns: 0, tireEvents: 0, hours: 0 };
      seriesByIso.set(isoDate, point);
      baseSeries.push({
        isoDate,
        day: formatDayTick(isoDate),
        breakdowns: 0,
        tireEvents: 0,
        hours: 0,
      });
    }

    // Aggregate current 7d vs previous 7d hours
    let current7dHours = 0;
    let previous7dHours = 0;
    for (const [key, dayHours] of combinedHoursByMachineDay.entries()) {
      const [rowMachineId, isoDay] = key.split('::');
      if (rowMachineId !== machine.id || !isoDay) continue;
      if (isoDay >= currentStart && isoDay <= options.today) {
        current7dHours += dayHours;
        const point = seriesByIso.get(isoDay);
        if (point) point.hours = roundOneDecimal(point.hours + dayHours);
      } else if (isoDay >= previousStart && isoDay < currentStart) {
        previous7dHours += dayHours;
      }
    }

    const machineBreakdowns = breakdownsByMachine.get(machine.id) ?? [];
    let activeBreakdowns = 0;
    for (const bd of machineBreakdowns) {
      if (bd.status === 'active') activeBreakdowns += 1;
      const bdDay = toIsoDay(bd.date_in || bd.created_at);
      const point = seriesByIso.get(bdDay);
      if (point) point.breakdowns += 1;
    }

    const machineTires = tiresByMachine.get(machine.id) ?? [];
    const machineInspections = inspectionsByMachine.get(machine.id) ?? [];
    let installedTiresCount = 0;
    let tireEventsCount = 0;

    for (const tire of machineTires) {
      if (tire.status === 'installed') installedTiresCount += 1;
      tireEventsCount += 1;
      const installDay = toIsoDay(tire.installed_at ?? tire.created_at);
      const installPoint = seriesByIso.get(installDay);
      if (installPoint) installPoint.tireEvents += 1;

      if (tire.removed_at) {
        tireEventsCount += 1;
        const removalDay = toIsoDay(tire.removed_at);
        const removalPoint = seriesByIso.get(removalDay);
        if (removalPoint) removalPoint.tireEvents += 1;
      }
    }

    for (const insp of machineInspections) {
      tireEventsCount += 1;
      const inspDay = toIsoDay(insp.inspection_date || insp.created_at);
      const inspPoint = seriesByIso.get(inspDay);
      if (inspPoint) inspPoint.tireEvents += 1;
    }

    const roundedCurrent = roundOneDecimal(current7dHours);
    const roundedPrevious = roundOneDecimal(previous7dHours);
    const totalHoursWorked = roundOneDecimal(roundedCurrent + roundedPrevious);
    const hoursDeltaPct =
      roundedPrevious > 0
        ? roundOneDecimal(((roundedCurrent - roundedPrevious) / roundedPrevious) * PERCENT_SCALE)
        : roundedCurrent > 0
          ? PERCENT_SCALE
          : 0;

    const activitySeries = baseSeries.map((entry) => {
      const counts = seriesByIso.get(entry.isoDate);
      return {
        ...entry,
        breakdowns: counts?.breakdowns ?? 0,
        tireEvents: counts?.tireEvents ?? 0,
        hours: roundOneDecimal(counts?.hours ?? 0),
      };
    });

    result[machine.id] = {
      totalHoursWorked,
      current7dHours: roundedCurrent,
      previous7dHours: roundedPrevious,
      hoursDeltaPct,
      totalBreakdowns: machineBreakdowns.length,
      activeBreakdowns,
      installedTiresCount,
      tireEventsCount,
      activitySeries,
    };
  }

  return result;
}

/** Groups machines by site code while preserving `'Unassigned'` last. */
export function groupMachinesBySite(options: {
  readonly machines: readonly DepartmentMachineRow[];
  readonly telemetryByMachineId: Readonly<Record<string, MachinePanelTelemetry>>;
  readonly today: string;
}): SiteMachineGroup[] {
  const siteMap = new Map<string, SiteMachineGroup>();

  for (const machine of options.machines) {
    const site = Array.isArray(machine.site) ? machine.site[0] : machine.site;
    const siteKey = site?.site_code ?? '__none__';
    if (!siteMap.has(siteKey)) {
      siteMap.set(siteKey, {
        siteCode: site?.site_code ?? '',
        siteName: site?.name ?? 'Unassigned',
        siteKey,
        machines: [],
      });
    }
    const telemetry =
      options.telemetryByMachineId[machine.id] ?? createEmptyMachineTelemetry(options.today);
    siteMap.get(siteKey)!.machines.push({ ...machine, telemetry });
  }

  return Array.from(siteMap.values()).sort((left, right) => {
    if (left.siteKey === '__none__') return 1;
    if (right.siteKey === '__none__') return -1;
    return left.siteKey.localeCompare(right.siteKey);
  });
}
