/**
 * Framework-free helpers shared by HourlyLoadsGrid and its Jest tests.
 * No React/RevoGrid imports here so the regression tests never mount the grid.
 */

export type HourlyShift = "day" | "night";
export type HourlyMaterial = "Waste" | "Coal";

export interface HourlyLoad {
  id: string;
  machine_id: string;
  shift_type: HourlyShift;
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
}

export const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);

/** Maps a 0-based hour index to its DB column name, e.g. 0 -> "hour_01", 11 -> "hour_12". */
export function HOUR_PROP(hourIndex: number): string {
  return `hour_${(hourIndex + 1).toString().padStart(2, "0")}`;
}

/** Composite key for one machine+shift row. */
export function loadKey(machineId: string, shiftType: HourlyShift): string {
  return `${machineId}:${shiftType}`;
}

/**
 * Builds a lookup map keyed by `${machine_id}:${shift_type}` so day and night
 * rows for the same machine never overwrite each other (the original bug).
 */
export function buildHourlyLoadsMap(loads: HourlyLoad[]): Map<string, HourlyLoad> {
  const map = new Map<string, HourlyLoad>();
  loads.forEach((load) => map.set(loadKey(load.machine_id, load.shift_type), load));
  return map;
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
    return acc + (typeof value === "number" ? value : 0);
  }, 0);
}
