import type { PlantDelayEntry, PlantHourlySheetRecord } from './types';

export const PLANT_HOURLY_SHEETS_STORAGE_KEY = 'arch_plant_processing_hourly_sheets_v1';
export const PLANT_DELAYS_STORAGE_KEY = 'arch_plant_processing_delays_v1';

export function loadStoredPlantSheets(
  fallback: PlantHourlySheetRecord[]
): PlantHourlySheetRecord[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PLANT_HOURLY_SHEETS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PlantHourlySheetRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const byId = new Map<string, PlantHourlySheetRecord>();
    for (const item of fallback) {
      byId.set(item.id, item);
    }
    for (const item of parsed) {
      byId.set(item.id, item);
    }
    return Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return fallback;
  }
}

export function saveStoredPlantSheet(
  sheet: PlantHourlySheetRecord,
  existing: PlantHourlySheetRecord[]
): PlantHourlySheetRecord[] {
  const byId = new Map<string, PlantHourlySheetRecord>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  byId.set(sheet.id, sheet);
  const next = Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PLANT_HOURLY_SHEETS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function loadStoredPlantDelays(fallback: PlantDelayEntry[]): PlantDelayEntry[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PLANT_DELAYS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PlantDelayEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const byId = new Map<string, PlantDelayEntry>();
    for (const item of fallback) {
      byId.set(item.id, item);
    }
    for (const item of parsed) {
      byId.set(item.id, item);
    }
    return Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return fallback;
  }
}

export function saveStoredPlantDelays(delays: PlantDelayEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLANT_DELAYS_STORAGE_KEY, JSON.stringify(delays));
  } catch {
    // Ignore storage quota errors
  }
}
