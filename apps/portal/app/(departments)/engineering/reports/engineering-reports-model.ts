/* cspell:ignore mttr */

export const ENGINEERING_REPORT_RANGES = ['24h', '7d', '30d'] as const;
export const ENGINEERING_REPORT_TABS = ['dashboard', 'pdf-report', 'whatsapp-report'] as const;
export const CRITICAL_TREAD_THRESHOLD_MM = 15;
export const WARNING_TREAD_THRESHOLD_MM = 22;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const RANGE_DAYS_MAP: Readonly<Record<EngineeringReportRange, number>> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

export type EngineeringReportRange = (typeof ENGINEERING_REPORT_RANGES)[number];
export type EngineeringReportTab = (typeof ENGINEERING_REPORT_TABS)[number];

export interface RawBreakdownRecord {
  readonly id: string;
  readonly fleet_id: string;
  readonly machine_id: string | null;
  readonly machine_name: string | null;
  readonly machine_type: string;
  readonly reason: string;
  readonly status: string;
  readonly date_in: string;
  readonly time_in: string | null;
  readonly date_out: string | null;
  readonly time_out: string | null;
  readonly duration_hours: number | null;
  readonly repair_notes: string | null;
  readonly created_at: string;
}

export interface RawMachineRecord {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly serial_number: string | null;
  readonly active?: boolean | null;
}

export interface RawTireRecord {
  readonly id: string;
  readonly serial_number: string;
  readonly brand: string;
  readonly size: string;
  readonly position: string;
  readonly status: string;
  readonly machine_id: string | null;
  readonly installed_at: string;
  readonly installed_hours: number;
  readonly removed_at: string | null;
  readonly removed_hours: number | null;
  readonly scrapped_reason: string | null;
  readonly machines?: { id?: string; name?: string } | Array<{ id?: string; name?: string }> | null;
}

export interface RawTireInspectionRecord {
  readonly id: string;
  readonly tire_id: string;
  readonly inspection_date: string;
  readonly tread_depth_mm: number;
  readonly pressure_psi: number;
  readonly condition_status: string;
  readonly current_smu: number | null;
  readonly notes: string | null;
}

export interface RawMachineHoursRecord {
  readonly id?: string;
  readonly machine_id: string;
  readonly daily_log_date?: string | null;
  readonly hours_worked: number;
}

export interface RawMachineOperationRecord {
  readonly id?: string;
  readonly machine_id: string;
  readonly shift_date?: string;
  readonly hours_worked: number | null;
  readonly start_smu: number | null;
  readonly end_smu: number | null;
}

export interface EngineeringBreakdownRow {
  readonly id: string;
  readonly fleetId: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly reason: string;
  readonly status: string;
  readonly dateIn: string;
  readonly timeIn: string;
  readonly dateOut: string;
  readonly timeOut: string;
  readonly durationHours: number;
  readonly repairNotes: string;
}

export interface EngineeringTireRow {
  readonly id: string;
  readonly serialNumber: string;
  readonly brand: string;
  readonly size: string;
  readonly position: string;
  readonly status: string;
  readonly machineName: string;
  readonly installedHours: number;
  readonly removedAt: string | null;
  readonly removedHours: number | null;
  readonly scrappedReason: string | null;
  readonly latestTreadMm: number | null;
  readonly latestPsi: number | null;
  readonly conditionStatus: string;
}

export type EngineeringTireEventKind = 'removal' | 'replacement' | 'installation' | 'inspection';

export interface EngineeringTireActivityRow {
  readonly id: string;
  readonly tireId: string;
  readonly serialNumber: string;
  readonly brand: string;
  readonly machineName: string;
  readonly position: string;
  readonly inspectionDate: string;
  readonly treadDepthMm: number;
  readonly pressurePsi: number;
  readonly conditionStatus: string;
  readonly currentSmu: number | null;
  readonly notes: string;
  readonly activityKind: EngineeringTireEventKind;
}

export interface EngineeringMachineSummary {
  readonly machineId: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly serialNumber: string;
  readonly hoursWorked: number;
  readonly breakdownCount: number;
  readonly downtimeHours: number;
}

export interface EngineeringTrendPoint {
  readonly date: string;
  readonly activeCount: number;
  readonly resolvedCount: number;
  readonly downtimeHours: number;
}

export interface EngineeringTireConditionSlice {
  readonly label: string;
  readonly count: number;
  readonly colorVar: string;
}

export interface EngineeringReportsSummary {
  readonly totalBreakdowns: number;
  readonly activeBreakdowns: number;
  readonly resolvedBreakdowns: number;
  readonly totalDowntimeHours: number;
  readonly mttrHours: number;
  readonly totalMachines: number;
  readonly activeMachinesCount: number;
  readonly fleetAvailabilityPct: number;
  readonly totalTires: number;
  readonly installedTires: number;
  readonly spareTires: number;
  readonly scrappedTires: number;
  readonly criticalTires: number;
  readonly totalHoursWorked: number;
  readonly tireRemovalsCount: number;
  readonly tireReplacementsCount: number;
}

export interface EngineeringReportsPayload {
  readonly departmentName: string;
  readonly range: EngineeringReportRange;
  readonly rangeLabel: string;
  readonly initialTab: EngineeringReportTab;
  readonly todayStr: string;
  readonly fromDateStr: string;
  readonly toDateStr: string;
  readonly summary: EngineeringReportsSummary;
  readonly breakdowns: readonly EngineeringBreakdownRow[];
  readonly tires: readonly EngineeringTireRow[];
  readonly recentTireActivities: readonly EngineeringTireActivityRow[];
  readonly topMachinesByHours: readonly EngineeringMachineSummary[];
  readonly topMachinesByBreakdowns: readonly EngineeringMachineSummary[];
  readonly breakdownTrend: readonly EngineeringTrendPoint[];
  readonly tireConditionBreakdown: readonly EngineeringTireConditionSlice[];
}

export function resolveEngineeringReportTab(rawTab?: string | null): EngineeringReportTab {
  if (rawTab === 'pdf-report' || rawTab === 'whatsapp-report' || rawTab === 'dashboard') {
    return rawTab;
  }
  return 'dashboard';
}

export function resolveEngineeringReportRange(rawRange?: string | null): EngineeringReportRange {
  if (rawRange === '24h' || rawRange === '7d' || rawRange === '30d') {
    return rawRange;
  }
  return '7d';
}

export function resolveRangeWindow(options: {
  readonly todayStr: string;
  readonly range: EngineeringReportRange;
}): { fromDateStr: string; toDateStr: string; rangeLabel: string } {
  const days = RANGE_DAYS_MAP[options.range];
  const endMs = new Date(`${options.todayStr}T00:00:00Z`).getTime();
  const safeEndMs = Number.isNaN(endMs) ? Date.now() : endMs;
  const fromDateStr = new Date(safeEndMs - (days - 1) * MS_PER_DAY).toISOString().slice(0, 10);
  const labelMap: Readonly<Record<EngineeringReportRange, string>> = {
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
  };
  return {
    fromDateStr,
    toDateStr: options.todayStr,
    rangeLabel: labelMap[options.range],
  };
}

function classifyTireEventKind(notes: string | null | undefined): EngineeringTireEventKind {
  const upper = (notes ?? '').trim().toUpperCase();
  if (upper.startsWith('[REMOVAL]')) return 'removal';
  if (upper.startsWith('[REPLACEMENT]')) return 'replacement';
  if (upper.startsWith('[INSTALLATION]')) return 'installation';
  return 'inspection';
}

function computeBreakdownHours(row: RawBreakdownRecord): number {
  if (row.duration_hours != null && Number(row.duration_hours) > 0) {
    return Number(Number(row.duration_hours).toFixed(2));
  }
  if (row.date_in && row.time_in && row.date_out && row.time_out) {
    const startMs = new Date(`${row.date_in}T${row.time_in}`).getTime();
    const endMs = new Date(`${row.date_out}T${row.time_out}`).getTime();
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
      return Number(((endMs - startMs) / MS_PER_HOUR).toFixed(2));
    }
  }
  return 0;
}

function extractTireMachineName(tire: RawTireRecord): string {
  const nested = Array.isArray(tire.machines) ? tire.machines[0] : tire.machines;
  return nested?.name || 'Unassigned';
}

export function escapeEngineeringReportCsvCell(cellText: string): string {
  const sanitized = CSV_FORMULA_PREFIX.test(cellText) ? `'${cellText}` : cellText;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

export function buildEngineeringCsvContent(payload: EngineeringReportsPayload): string {
  const headers = [
    'Section',
    'Reference / Serial',
    'Machine / Asset',
    'Type / Brand',
    'Status / Condition',
    'Date',
    'Metric (Hours / Tread)',
    'Details / Notes',
  ];

  const breakdownRows = payload.breakdowns.map((b) => [
    'Breakdown',
    b.fleetId,
    b.machineName,
    b.machineType,
    b.status.toUpperCase(),
    b.dateIn,
    b.durationHours > 0 ? `${b.durationHours.toFixed(1)}h` : 'Ongoing',
    b.repairNotes || b.reason,
  ]);

  const tireRows = payload.tires.map((t) => [
    'Tire',
    t.serialNumber,
    `${t.machineName} (${t.position})`,
    `${t.brand} ${t.size}`,
    t.status.toUpperCase(),
    t.removedAt || 'Active',
    t.latestTreadMm != null ? `${t.latestTreadMm}mm` : `${t.installedHours}h`,
    t.scrappedReason || t.conditionStatus,
  ]);

  const machineRows = payload.topMachinesByHours.map((m) => [
    'Machine Hours',
    m.serialNumber || m.machineId,
    m.machineName,
    m.machineType,
    `${m.breakdownCount} breakdowns`,
    payload.toDateStr,
    `${m.hoursWorked.toFixed(1)}h`,
    `Downtime: ${m.downtimeHours.toFixed(1)}h`,
  ]);

  const allRows = [...breakdownRows, ...tireRows, ...machineRows];
  return [
    headers.map((h) => escapeEngineeringReportCsvCell(h)).join(','),
    ...allRows.map((row) =>
      row.map((cell) => escapeEngineeringReportCsvCell(String(cell))).join(',')
    ),
  ].join('\n');
}

export function buildEngineeringReportsPayload(options: {
  readonly departmentName: string;
  readonly range: EngineeringReportRange;
  readonly initialTab: EngineeringReportTab;
  readonly todayStr: string;
  readonly fromDateStr: string;
  readonly toDateStr: string;
  readonly rangeLabel: string;
  readonly rawBreakdowns: readonly RawBreakdownRecord[];
  readonly rawMachines: readonly RawMachineRecord[];
  readonly rawTires: readonly RawTireRecord[];
  readonly rawTireInspections: readonly RawTireInspectionRecord[];
  readonly rawMachineHours: readonly RawMachineHoursRecord[];
  readonly rawMachineOperations: readonly RawMachineOperationRecord[];
}): EngineeringReportsPayload {
  const activeMachines = options.rawMachines.filter((m) => m.active !== false);
  const machineById = new Map(options.rawMachines.map((m) => [m.id, m]));

  // Map inspections to tires (newest first)
  const latestInspectionByTire = new Map<string, RawTireInspectionRecord>();
  for (const insp of options.rawTireInspections) {
    if (!latestInspectionByTire.has(insp.tire_id)) {
      latestInspectionByTire.set(insp.tire_id, insp);
    }
  }

  // Build breakdown rows and aggregate downtime + trend + machine breakdowns
  let activeBreakdowns = 0;
  let resolvedBreakdowns = 0;
  let totalDowntimeHours = 0;
  let resolvedDurationSum = 0;
  let resolvedDurationCount = 0;
  const activeDownMachineKeys = new Set<string>();
  const trendMap = new Map<
    string,
    { date: string; activeCount: number; resolvedCount: number; downtimeHours: number }
  >();
  const machineBreakdownStats = new Map<string, { count: number; downtime: number }>();

  const breakdowns: EngineeringBreakdownRow[] = options.rawBreakdowns.map((b) => {
    const durationHours = computeBreakdownHours(b);
    totalDowntimeHours += durationHours;

    const isActive = b.status === 'active';
    if (isActive) {
      activeBreakdowns += 1;
      activeDownMachineKeys.add(b.machine_id || b.fleet_id);
    } else {
      resolvedBreakdowns += 1;
      if (durationHours > 0) {
        resolvedDurationSum += durationHours;
        resolvedDurationCount += 1;
      }
    }

    const trendEntry = trendMap.get(b.date_in) ?? {
      date: b.date_in,
      activeCount: 0,
      resolvedCount: 0,
      downtimeHours: 0,
    };
    if (isActive) {
      trendEntry.activeCount += 1;
    } else {
      trendEntry.resolvedCount += 1;
    }
    trendEntry.downtimeHours = Number((trendEntry.downtimeHours + durationHours).toFixed(2));
    trendMap.set(b.date_in, trendEntry);

    if (b.machine_id) {
      const mStats = machineBreakdownStats.get(b.machine_id) ?? { count: 0, downtime: 0 };
      mStats.count += 1;
      mStats.downtime += durationHours;
      machineBreakdownStats.set(b.machine_id, mStats);
    }

    return {
      id: b.id,
      fleetId: b.fleet_id,
      machineName: b.machine_name || b.fleet_id,
      machineType: b.machine_type,
      reason: b.reason,
      status: b.status,
      dateIn: b.date_in,
      timeIn: b.time_in ?? '',
      dateOut: b.date_out ?? '',
      timeOut: b.time_out ?? '',
      durationHours,
      repairNotes: b.repair_notes ?? '',
    };
  });

  // Aggregate machine hours: prefer machine_hours, fallback to machine_operations
  const hoursByMachine = new Map<string, number>();
  for (const mh of options.rawMachineHours) {
    const prev = hoursByMachine.get(mh.machine_id) ?? 0;
    hoursByMachine.set(mh.machine_id, prev + (Number(mh.hours_worked) || 0));
  }
  if (options.rawMachineHours.length === 0) {
    for (const op of options.rawMachineOperations) {
      const opHours =
        op.hours_worked != null
          ? Number(op.hours_worked)
          : op.start_smu != null && op.end_smu != null && op.end_smu >= op.start_smu
            ? Number(op.end_smu) - Number(op.start_smu)
            : 0;
      const prev = hoursByMachine.get(op.machine_id) ?? 0;
      hoursByMachine.set(op.machine_id, prev + opHours);
    }
  }

  let totalHoursWorked = 0;
  const machineSummaries: EngineeringMachineSummary[] = activeMachines.map((m) => {
    const hours = Number((hoursByMachine.get(m.id) ?? 0).toFixed(1));
    totalHoursWorked += hours;
    const bd = machineBreakdownStats.get(m.id) ?? { count: 0, downtime: 0 };
    return {
      machineId: m.id,
      machineName: m.name,
      machineType: m.machine_type,
      serialNumber: m.serial_number ?? '',
      hoursWorked: hours,
      breakdownCount: bd.count,
      downtimeHours: Number(bd.downtime.toFixed(1)),
    };
  });

  // Also include hours from machines not in activeMachines if present
  for (const [mId, hrs] of hoursByMachine.entries()) {
    if (!activeMachines.some((m) => m.id === mId)) {
      totalHoursWorked += Number(hrs.toFixed(1));
    }
  }

  const topMachinesByHours = [...machineSummaries]
    .sort((a, b) => b.hoursWorked - a.hoursWorked || a.machineName.localeCompare(b.machineName))
    .slice(0, 8);

  const topMachinesByBreakdowns = [...machineSummaries]
    .filter((m) => m.breakdownCount > 0)
    .sort((a, b) => b.breakdownCount - a.breakdownCount || b.downtimeHours - a.downtimeHours)
    .slice(0, 8);

  // Tires aggregation
  let installedTires = 0;
  let spareTires = 0;
  let scrappedTires = 0;
  let criticalTires = 0;
  let goodCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  const tireLookup = new Map<string, RawTireRecord>();
  const tires: EngineeringTireRow[] = options.rawTires.map((t) => {
    tireLookup.set(t.id, t);
    const latestInsp = latestInspectionByTire.get(t.id);
    const tread = latestInsp ? Number(latestInsp.tread_depth_mm) : null;
    const psi = latestInsp ? Number(latestInsp.pressure_psi) : null;
    const cond =
      latestInsp?.condition_status ??
      (tread !== null && tread < CRITICAL_TREAD_THRESHOLD_MM ? 'critical' : 'good');

    if (t.status === 'installed') installedTires += 1;
    else if (t.status === 'inventory') spareTires += 1;
    else if (t.status === 'scrapped') scrappedTires += 1;

    const isCrit = cond === 'critical' || (tread !== null && tread < CRITICAL_TREAD_THRESHOLD_MM);
    const isWarn =
      !isCrit && (cond === 'warning' || (tread !== null && tread < WARNING_TREAD_THRESHOLD_MM));

    if (t.status === 'installed' && isCrit) {
      criticalTires += 1;
    }

    if (isCrit) criticalCount += 1;
    else if (isWarn) warningCount += 1;
    else goodCount += 1;

    return {
      id: t.id,
      serialNumber: t.serial_number,
      brand: t.brand,
      size: t.size,
      position: t.position,
      status: t.status,
      machineName: extractTireMachineName(t),
      installedHours: Number(t.installed_hours) || 0,
      removedAt: t.removed_at,
      removedHours: t.removed_hours,
      scrappedReason: t.scrapped_reason,
      latestTreadMm: tread,
      latestPsi: psi,
      conditionStatus: cond,
    };
  });

  let tireRemovalsCount = 0;
  let tireReplacementsCount = 0;
  const recentTireActivities: EngineeringTireActivityRow[] = options.rawTireInspections.map(
    (insp) => {
      const tire = tireLookup.get(insp.tire_id);
      const activityKind = classifyTireEventKind(insp.notes);
      if (activityKind === 'removal') tireRemovalsCount += 1;
      if (activityKind === 'replacement' || activityKind === 'installation') {
        tireReplacementsCount += 1;
      }
      const fallbackMachine = tire?.machine_id ? machineById.get(tire.machine_id)?.name : undefined;

      return {
        id: insp.id,
        tireId: insp.tire_id,
        serialNumber: tire?.serial_number ?? 'Unknown',
        brand: tire?.brand ?? '',
        machineName: tire ? extractTireMachineName(tire) : (fallbackMachine ?? 'Unassigned'),
        position: tire?.position ?? '—',
        inspectionDate: insp.inspection_date,
        treadDepthMm: Number(insp.tread_depth_mm) || 0,
        pressurePsi: Number(insp.pressure_psi) || 0,
        conditionStatus: insp.condition_status,
        currentSmu: insp.current_smu != null ? Number(insp.current_smu) : null,
        notes: insp.notes ?? '',
        activityKind,
      };
    }
  );

  const activeMachinesCount = activeMachines.length;
  const downMachinesCount = Math.min(activeMachinesCount, activeDownMachineKeys.size);
  const fleetAvailabilityPct =
    activeMachinesCount > 0
      ? Number((((activeMachinesCount - downMachinesCount) / activeMachinesCount) * 100).toFixed(1))
      : 100;

  const mttrHours =
    resolvedDurationCount > 0
      ? Number((resolvedDurationSum / resolvedDurationCount).toFixed(1))
      : 0;

  const breakdownTrend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const tireConditionBreakdown: EngineeringTireConditionSlice[] = [
    { label: 'Good', count: goodCount, colorVar: 'var(--accent-green)' },
    { label: 'Warning', count: warningCount, colorVar: 'var(--accent-amber)' },
    { label: 'Critical', count: criticalCount, colorVar: 'var(--accent-red)' },
  ];

  return {
    departmentName: options.departmentName,
    range: options.range,
    rangeLabel: options.rangeLabel,
    initialTab: options.initialTab,
    todayStr: options.todayStr,
    fromDateStr: options.fromDateStr,
    toDateStr: options.toDateStr,
    summary: {
      totalBreakdowns: breakdowns.length,
      activeBreakdowns,
      resolvedBreakdowns,
      totalDowntimeHours: Number(totalDowntimeHours.toFixed(1)),
      mttrHours,
      totalMachines: options.rawMachines.length,
      activeMachinesCount,
      fleetAvailabilityPct,
      totalTires: tires.length,
      installedTires,
      spareTires,
      scrappedTires,
      criticalTires,
      totalHoursWorked: Number(totalHoursWorked.toFixed(1)),
      tireRemovalsCount,
      tireReplacementsCount,
    },
    breakdowns,
    tires,
    recentTireActivities,
    topMachinesByHours,
    topMachinesByBreakdowns,
    breakdownTrend,
    tireConditionBreakdown,
  };
}
