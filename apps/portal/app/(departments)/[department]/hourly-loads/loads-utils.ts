/**
 * Framework-free helpers shared by HourlyLoadsGrid and its Jest tests.
 * No React/RevoGrid imports here so the regression tests never mount the grid.
 */

export type HourlyShift = 'day' | 'night';
export type HourlyMaterial = 'Waste' | 'Coal';

export interface HourlyLoad {
  id: string;
  machine_id: string;
  shift_type: HourlyShift;
  start_hour?: number;
  end_hour?: number;
  is_locked?: boolean;
  hour_01: number;
  hour_02: number;
  hour_03: number;
  hour_04: number;
  hour_05: number;
  hour_06: number;
  hour_07: number;
  hour_08: number;
  hour_09: number;
  hour_10: number;
  hour_11: number;
  hour_12: number;
  total_loads: number;
  material_type?: HourlyMaterial;
  excavator_id?: string | null;
}

export const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);

/** Maps a 0-based hour index to its DB column name, e.g. 0 -> "hour_01", 11 -> "hour_12". */
export function HOUR_PROP(hourIndex: number): string {
  return `hour_${(hourIndex + 1).toString().padStart(2, '0')}`;
}

/** Composite key for one machine+shift row. */
export function loadKey(machineId: string, shiftType: HourlyShift): string {
  return `${machineId}:${shiftType}`;
}

/**
 * Builds a lookup map keyed by `${machine_id}:${shift_type}` returning the primary/last load.
 */
export function buildHourlyLoadsMap(loads: HourlyLoad[]): Map<string, HourlyLoad> {
  const map = new Map<string, HourlyLoad>();
  loads.forEach((load) => map.set(loadKey(load.machine_id, load.shift_type), load));
  return map;
}

/**
 * Groups all hourly load segments by `${machine_id}:${shift_type}`, sorted by start_hour ascending.
 */
export function buildHourlyLoadsGroupedMap(loads: HourlyLoad[]): Map<string, HourlyLoad[]> {
  const map = new Map<string, HourlyLoad[]>();
  loads.forEach((load) => {
    const key = loadKey(load.machine_id, load.shift_type);
    const existing = map.get(key) || [];
    existing.push(load);
    map.set(key, existing);
  });

  // Sort each group by start_hour ascending
  for (const [key, group] of map.entries()) {
    group.sort((a, b) => (a.start_hour ?? 1) - (b.start_hour ?? 1));
  }

  return map;
}

/**
 * Checks whether a specific 1-based hour (1..12) is editable for a given HourlyLoad segment.
 */
export function isHourEditable(
  load: Partial<HourlyLoad> | Record<string, unknown> | undefined | null,
  hourNumber: number
): boolean {
  if (!load) return true;
  const record = load as Record<string, unknown>;
  if (record.is_locked || record.isLocked) return false;
  const start =
    typeof record.start_hour === 'number'
      ? record.start_hour
      : typeof record.startHour === 'number'
        ? record.startHour
        : 1;
  const end =
    typeof record.end_hour === 'number'
      ? record.end_hour
      : typeof record.endHour === 'number'
        ? record.endHour
        : 12;
  return hourNumber >= start && hourNumber <= end;
}

export const HAUL_TRUCK_MACHINE_TYPES = [
  'Dump Truck',
  'ADT',
  'Articulated Dump Truck',
  'RDT',
  'Rigid Dump Truck',
] as const;

export interface DerivedDumperAssignment {
  key: string;
  dumperMachineId: string;
  materialType: string;
  totalLoads: number;
  totalBcm: number;
  autoPlaced: boolean;
  segmentCount: number;
}

export interface HourlyLoadSegmentSummary {
  id?: string;
  machine_id: string;
  excavator_id?: string | null;
  material_type?: string | null;
  shift_type: string;
  total_loads?: number | null;
  start_hour?: number | null;
  end_hour?: number | null;
  is_locked?: boolean | null;
}

export interface DumperBinFactorRef {
  id: string;
  name?: string;
  bin_factor?: number | null;
}

/**
 * Derives auto-placed dumper assignments for a selected Excavator + Shift from hourly_loads.
 * Aggregates multiple mid-shift segments by (machine_id, material_type) so a haul truck that
 * hauled Waste in segment 1 and Coal in segment 2 produces two distinct rows with exact load & BCM totals.
 */
export function deriveExcavatorDumperAssignments(
  hourlyLoads: readonly HourlyLoadSegmentSummary[],
  dumpers: readonly DumperBinFactorRef[],
  excavatorId: string,
  shiftType: HourlyShift
): DerivedDumperAssignment[] {
  if (!excavatorId) return [];

  const dumperMap = new Map<string, DumperBinFactorRef>();
  for (const d of dumpers) {
    dumperMap.set(d.id, d);
  }

  const grouped = new Map<
    string,
    {
      dumperMachineId: string;
      materialType: string;
      totalLoads: number;
      segmentCount: number;
    }
  >();

  for (const load of hourlyLoads) {
    if (load.excavator_id !== excavatorId || load.shift_type !== shiftType) {
      continue;
    }
    const materialType = load.material_type || 'Waste';
    const groupKey = `${load.machine_id}|${materialType}`;
    const loads = typeof load.total_loads === 'number' ? load.total_loads : 0;

    const existing = grouped.get(groupKey);
    if (existing) {
      existing.totalLoads += loads;
      existing.segmentCount += 1;
    } else {
      grouped.set(groupKey, {
        dumperMachineId: load.machine_id,
        materialType,
        totalLoads: loads,
        segmentCount: 1,
      });
    }
  }

  const result: DerivedDumperAssignment[] = [];
  for (const [groupKey, entry] of grouped.entries()) {
    const dumper = dumperMap.get(entry.dumperMachineId);
    const binFactor = dumper?.bin_factor ?? 0;
    const totalBcm = Math.round(entry.totalLoads * binFactor * 100) / 100;

    result.push({
      key: `auto-${excavatorId}-${shiftType}-${groupKey}`,
      dumperMachineId: entry.dumperMachineId,
      materialType: entry.materialType,
      totalLoads: entry.totalLoads,
      totalBcm,
      autoPlaced: true,
      segmentCount: entry.segmentCount,
    });
  }

  return result;
}

/**
 * Computes total loads and BCM for a specific dumper + shift (+ optional excavator and material)
 * across all matching hourly_loads segments.
 */
export function computeDumperLoadsAndBcm(
  hourlyLoads: readonly HourlyLoadSegmentSummary[],
  dumperId: string,
  shiftType: HourlyShift,
  binFactor: number,
  options?: { excavatorId?: string; materialType?: string }
): { totalLoads: number; totalBcm: number } {
  if (!dumperId) return { totalLoads: 0, totalBcm: 0 };

  const matching = hourlyLoads.filter((l) => {
    if (l.machine_id !== dumperId || l.shift_type !== shiftType) return false;
    if (options?.excavatorId && l.excavator_id && l.excavator_id !== options.excavatorId) {
      return false;
    }
    if (
      options?.materialType &&
      l.material_type &&
      l.material_type.toLowerCase() !== options.materialType.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  // Fallback to all segments for that dumper+shift if material/excavator filter had no direct match
  const sourceRows =
    matching.length > 0
      ? matching
      : hourlyLoads.filter((l) => l.machine_id === dumperId && l.shift_type === shiftType);

  const totalLoads = sourceRows.reduce(
    (sum, row) => sum + (typeof row.total_loads === 'number' ? row.total_loads : 0),
    0
  );
  const totalBcm = Math.round(totalLoads * (binFactor || 0) * 100) / 100;
  return { totalLoads, totalBcm };
}

/**
 * Mirrors the DB's GENERATED ALWAYS AS (hour_01 + ... + hour_12) STORED column
 * for optimistic updates that happen before the write round-trips.
 */
export function sumHourlyTotal(load: HourlyLoad | Record<string, unknown>): number {
  const record = load as Record<string, unknown>;
  // HOURS_12 is 1-based; HOUR_PROP expects a 0-based hour index.
  return HOURS_12.reduce((acc, i) => {
    const value = record[HOUR_PROP(i - 1)];
    return acc + (typeof value === 'number' ? value : 0);
  }, 0);
}
