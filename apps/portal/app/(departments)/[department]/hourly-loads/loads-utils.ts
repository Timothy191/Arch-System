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
