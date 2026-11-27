import type { MachineOperationLogItem } from './reports-types';

export const SHIFT_ACTIVITY_PAGE_SIZE = 8;
const PERCENT_MULTIPLIER = 100;

export type ShiftActivityShiftFilter = 'all' | 'day' | 'night';
export type ShiftActivityStatusFilter = 'all' | 'active' | 'completed';
export type ShiftActivitySortKey =
  | 'date'
  | 'shift'
  | 'machineName'
  | 'siteName'
  | 'operatorName'
  | 'status'
  | 'hoursWorked'
  | 'bcmMoved'
  | 'delayMinutes';
export type ShiftActivitySortDirection = 'asc' | 'desc';

export interface ShiftActivityRow {
  id: string;
  date: string;
  shift: 'day' | 'night';
  machineName: string;
  machineType: string;
  operatorName: string;
  siteName: string;
  hoursWorked: number;
  bcmMoved: number;
  delayMinutes: number;
  status: 'active' | 'completed';
  material: string;
  blockMined: string;
}

export interface ShiftActivityFilters {
  shift: ShiftActivityShiftFilter;
  status: ShiftActivityStatusFilter;
  date: string;
  search: string;
}

export interface ShiftActivityKpis {
  activeMachines: number;
  totalDelayMinutes: number;
  totalBcm: number;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
}

export function deriveShiftActivityRows(
  logs: readonly MachineOperationLogItem[]
): ShiftActivityRow[] {
  return logs.map((log) => ({
    id: log.id,
    date: log.date,
    shift: log.shift,
    machineName: log.machineName,
    machineType: log.machineType,
    operatorName: log.operatorName,
    siteName: log.siteName,
    hoursWorked: log.hoursWorked,
    bcmMoved: log.bcmMoved,
    delayMinutes: log.delayMinutes,
    status: log.status,
    material: log.material ?? '',
    blockMined: log.blockMined ?? '',
  }));
}

export function deriveShiftActivityDates(rows: readonly ShiftActivityRow[]): string[] {
  return Array.from(new Set(rows.map((row) => row.date))).sort((a, b) => b.localeCompare(a));
}

export function computeShiftActivityKpis(rows: readonly ShiftActivityRow[]): ShiftActivityKpis {
  const activeMachineNames = new Set<string>();
  let totalDelayMinutes = 0;
  let totalBcm = 0;
  let completedCount = 0;

  for (const row of rows) {
    if (row.status === 'active') activeMachineNames.add(row.machineName);
    if (row.status === 'completed') completedCount += 1;
    totalDelayMinutes += row.delayMinutes;
    totalBcm += row.bcmMoved;
  }

  return {
    activeMachines: activeMachineNames.size,
    totalDelayMinutes,
    totalBcm,
    completedCount,
    totalCount: rows.length,
    completionPercent:
      rows.length > 0 ? Math.round((completedCount / rows.length) * PERCENT_MULTIPLIER) : 0,
  };
}

export function filterShiftActivityRows(
  rows: readonly ShiftActivityRow[],
  filters: ShiftActivityFilters
): ShiftActivityRow[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.shift !== 'all' && row.shift !== filters.shift) return false;
    if (filters.status !== 'all' && row.status !== filters.status) return false;
    if (filters.date !== 'all' && row.date !== filters.date) return false;
    if (!normalizedSearch) return true;

    return [
      row.machineName,
      row.machineType,
      row.operatorName,
      row.siteName,
      row.date,
      row.shift,
      row.material,
      row.blockMined,
    ].some((field) => field.toLowerCase().includes(normalizedSearch));
  });
}

const NUMERIC_SORT_KEYS: ReadonlySet<ShiftActivitySortKey> = new Set([
  'hoursWorked',
  'bcmMoved',
  'delayMinutes',
]);

export function sortShiftActivityRows(
  rows: readonly ShiftActivityRow[],
  sortKey: ShiftActivitySortKey,
  direction: ShiftActivitySortDirection
): ShiftActivityRow[] {
  const directionMultiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = left[sortKey];
    const rightValue = right[sortKey];
    const comparison = NUMERIC_SORT_KEYS.has(sortKey)
      ? Number(leftValue) - Number(rightValue)
      : String(leftValue).localeCompare(String(rightValue));

    if (comparison !== 0) return comparison * directionMultiplier;
    return left.date.localeCompare(right.date) * -1 || left.id.localeCompare(right.id);
  });
}

export function paginateShiftActivityRows(
  rows: readonly ShiftActivityRow[],
  page: number,
  pageSize: number
): { rows: ShiftActivityRow[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const startIndex = (safePage - 1) * pageSize;

  return {
    rows: rows.slice(startIndex, startIndex + pageSize),
    page: safePage,
    pageCount,
  };
}
