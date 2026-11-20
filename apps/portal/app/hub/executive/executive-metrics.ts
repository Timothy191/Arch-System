/**
 * Pure aggregation helpers for the Executive Dashboard (`/hub/executive`).
 *
 * Every figure is derived from real Supabase rows (`get_production_summary`,
 * `machines`, `breakdowns`, `employees`, `production_monthly_targets`).
 * Missing denominators yield `null` instead of fabricated zeros so the UI can
 * render an explicit "unavailable" state.
 */

const ISO_DATE_LENGTH = 10;
const MS_PER_DAY = 86_400_000;
const PERCENT = 100;
const WEEK_DAYS = 7;
const MAX_FLEET_SEGMENTS = 6;
const MAX_CATEGORY_SEGMENTS = 6;
const MAX_DEPARTMENT_SEGMENTS = 8;
const OTHER_LABEL = 'Other';
const UNSPECIFIED_LABEL = 'Unspecified';
const UNASSIGNED_LABEL = 'Unassigned';
const OPEN_BREAKDOWN_STATUS = 'active';
const ACTIVE_FLEET_LABEL = 'Active';
const STANDBY_FLEET_LABEL = 'Inactive / standby';

const BREAKDOWN_STATUS_LABELS: Readonly<Record<string, string>> = {
  active: 'Open',
  completed: 'Completed',
};

export type NumericLike = number | string | null;

export interface ProductionSummaryRow {
  log_date: string | null;
  actual_coal_tonnes: NumericLike;
  actual_waste_tonnes: NumericLike;
  total_fuel_litres: NumericLike;
  total_hours_worked: NumericLike;
  reconciliation_drift_pct: NumericLike;
}

export interface DailyProductionPoint {
  date: string;
  coal: number;
  waste: number;
  total: number;
  fuelLitres: number;
  hours: number;
  /** Mean signed reconciliation drift (%) across the day's shift logs. */
  drift: number;
  /** Mean absolute reconciliation drift (%) across the day's shift logs. */
  absDrift: number;
  fuelPerTonne: number | null;
}

export interface PeriodSummary {
  days: number;
  coal: number;
  waste: number;
  total: number;
  fuelLitres: number;
  hours: number;
  avgAbsDriftPct: number;
  fuelPerTonne: number | null;
  stripRatio: number | null;
  tonnesPerHour: number | null;
}

export interface DayTotal {
  date: string;
  total: number;
}

export interface TrendStats {
  avgDailyTonnes: number | null;
  bestDay: DayTotal | null;
  latestDay: DayTotal | null;
  latestVsAvgPct: number | null;
  weekTonnes: number;
  priorWeekTonnes: number;
  weekOverWeekPct: number | null;
}

export interface LabeledCount {
  label: string;
  count: number;
}

export interface FleetMixEntry {
  label: string;
  active: number;
  inactive: number;
}

export interface MachineRow {
  machine_type: string | null;
  active: boolean | null;
}

export interface BreakdownRow {
  status: string | null;
  machine_type: string | null;
  duration_hours: NumericLike;
}

export interface BreakdownStats {
  total: number;
  open: number;
  downtimeHours: number;
  byStatus: LabeledCount[];
  byMachineType: LabeledCount[];
}

interface DepartmentRef {
  display_name: string | null;
}

export interface EmployeeDepartmentRow {
  departments: DepartmentRef | DepartmentRef[] | null;
}

export interface MonthlyTargetRow {
  coal_target_tonnes: NumericLike;
  waste_target_tonnes: NumericLike;
}

export interface TargetAttainment {
  coalTargetTonnes: number;
  wasteTargetTonnes: number;
  coalAttainmentPct: number;
  coalPacePct: number | null;
  plannedStripRatio: number | null;
}

export interface FleetSnapshot {
  active: number;
  total: number;
  availabilityPct: number | null;
  mix: FleetMixEntry[];
  status: LabeledCount[];
}

export interface ExecutiveData {
  today: string;
  monthStart: string;
  summaryAvailable: boolean;
  daily: DailyProductionPoint[];
  mtd: PeriodSummary;
  window: PeriodSummary;
  trend: TrendStats;
  fleet: FleetSnapshot;
  breakdowns: BreakdownStats;
  personnel: { total: number; byDepartment: LabeledCount[] };
  target: TargetAttainment | null;
}

export function toNumber(raw: NumericLike | undefined): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function shiftIsoDate(isoDay: string, days: number): string {
  const shifted = new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * MS_PER_DAY);
  return shifted.toISOString().slice(0, ISO_DATE_LENGTH);
}

export function safeRatio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function percentChange(current: number, baseline: number): number | null {
  const ratio = safeRatio(current - baseline, baseline);
  return ratio === null ? null : ratio * PERCENT;
}

interface DayAccumulator {
  coal: number;
  waste: number;
  fuelLitres: number;
  hours: number;
  driftSum: number;
  absDriftSum: number;
  driftSamples: number;
}

const EMPTY_DAY: DayAccumulator = {
  coal: 0,
  waste: 0,
  fuelLitres: 0,
  hours: 0,
  driftSum: 0,
  absDriftSum: 0,
  driftSamples: 0,
};

function accumulateRow(acc: DayAccumulator, row: ProductionSummaryRow): DayAccumulator {
  const hasDrift = row.reconciliation_drift_pct !== null && row.reconciliation_drift_pct !== '';
  const drift = toNumber(row.reconciliation_drift_pct);
  return {
    coal: acc.coal + toNumber(row.actual_coal_tonnes),
    waste: acc.waste + toNumber(row.actual_waste_tonnes),
    fuelLitres: acc.fuelLitres + toNumber(row.total_fuel_litres),
    hours: acc.hours + toNumber(row.total_hours_worked),
    driftSum: acc.driftSum + drift,
    absDriftSum: acc.absDriftSum + Math.abs(drift),
    driftSamples: acc.driftSamples + (hasDrift ? 1 : 0),
  };
}

function toDailyPoint(date: string, acc: DayAccumulator): DailyProductionPoint {
  const total = acc.coal + acc.waste;
  const samples = Math.max(acc.driftSamples, 1);
  return {
    date,
    coal: acc.coal,
    waste: acc.waste,
    total,
    fuelLitres: acc.fuelLitres,
    hours: acc.hours,
    drift: acc.driftSum / samples,
    absDrift: acc.absDriftSum / samples,
    fuelPerTonne: safeRatio(acc.fuelLitres, total),
  };
}

/** Collapses per-shift/per-department summary rows into one point per day. */
export function aggregateDailyProduction(
  rows: readonly ProductionSummaryRow[]
): DailyProductionPoint[] {
  const byDate = new Map<string, DayAccumulator>();
  for (const row of rows) {
    if (!row.log_date) continue;
    const date = row.log_date.slice(0, ISO_DATE_LENGTH);
    byDate.set(date, accumulateRow(byDate.get(date) ?? EMPTY_DAY, row));
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, acc]) => toDailyPoint(date, acc));
}

export function pointsSince(
  points: readonly DailyProductionPoint[],
  fromIsoDay: string
): DailyProductionPoint[] {
  return points.filter((point) => point.date >= fromIsoDay);
}

export function summarizePeriod(points: readonly DailyProductionPoint[]): PeriodSummary {
  const totals = points.reduce(
    (acc, point) => ({
      coal: acc.coal + point.coal,
      waste: acc.waste + point.waste,
      fuelLitres: acc.fuelLitres + point.fuelLitres,
      hours: acc.hours + point.hours,
      absDrift: acc.absDrift + point.absDrift,
    }),
    { coal: 0, waste: 0, fuelLitres: 0, hours: 0, absDrift: 0 }
  );
  const total = totals.coal + totals.waste;
  return {
    days: points.length,
    coal: totals.coal,
    waste: totals.waste,
    total,
    fuelLitres: totals.fuelLitres,
    hours: totals.hours,
    avgAbsDriftPct: safeRatio(totals.absDrift, points.length) ?? 0,
    fuelPerTonne: safeRatio(totals.fuelLitres, total),
    stripRatio: safeRatio(totals.waste, totals.coal),
    tonnesPerHour: safeRatio(total, totals.hours),
  };
}

function sumTotal(points: readonly DailyProductionPoint[]): number {
  return points.reduce((sum, point) => sum + point.total, 0);
}

function pickBestDay(points: readonly DailyProductionPoint[]): DayTotal | null {
  return points.reduce<DayTotal | null>(
    (best, point) =>
      best === null || point.total > best.total ? { date: point.date, total: point.total } : best,
    null
  );
}

export function computeTrendStats(
  points: readonly DailyProductionPoint[],
  todayIso: string
): TrendStats {
  const weekStart = shiftIsoDate(todayIso, 1 - WEEK_DAYS);
  const priorStart = shiftIsoDate(todayIso, 1 - 2 * WEEK_DAYS);
  const weekTonnes = sumTotal(pointsSince(points, weekStart));
  const priorWeekTonnes = sumTotal(
    points.filter((point) => point.date >= priorStart && point.date < weekStart)
  );
  const avgDailyTonnes = safeRatio(sumTotal(points), points.length);
  const last = points.at(-1);
  const latestDay = last ? { date: last.date, total: last.total } : null;
  const latestVsAvgPct =
    latestDay && avgDailyTonnes !== null ? percentChange(latestDay.total, avgDailyTonnes) : null;
  return {
    avgDailyTonnes,
    bestDay: pickBestDay(points),
    latestDay,
    latestVsAvgPct,
    weekTonnes,
    priorWeekTonnes,
    weekOverWeekPct: percentChange(weekTonnes, priorWeekTonnes),
  };
}

function labelOrFallback(raw: string | null | undefined, fallback: string): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : fallback;
}

function countBy<T>(rows: readonly T[], labelOf: (row: T) => string): LabeledCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = labelOf(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function keepTop(entries: readonly LabeledCount[], max: number): LabeledCount[] {
  if (entries.length <= max) return [...entries];
  const tailCount = entries.slice(max - 1).reduce((sum, entry) => sum + entry.count, 0);
  return [...entries.slice(0, max - 1), { label: OTHER_LABEL, count: tailCount }];
}

function fleetTotal(entry: FleetMixEntry): number {
  return entry.active + entry.inactive;
}

function collapseFleetTail(sorted: readonly FleetMixEntry[]): FleetMixEntry[] {
  if (sorted.length <= MAX_FLEET_SEGMENTS) return [...sorted];
  const tail = sorted.slice(MAX_FLEET_SEGMENTS - 1);
  const other: FleetMixEntry = {
    label: OTHER_LABEL,
    active: tail.reduce((sum, entry) => sum + entry.active, 0),
    inactive: tail.reduce((sum, entry) => sum + entry.inactive, 0),
  };
  return [...sorted.slice(0, MAX_FLEET_SEGMENTS - 1), other];
}

/** Fleet composition by `machines.machine_type`, split active vs inactive. */
export function buildFleetMix(rows: readonly MachineRow[]): FleetMixEntry[] {
  const byType = new Map<string, FleetMixEntry>();
  for (const row of rows) {
    const label = labelOrFallback(row.machine_type, UNSPECIFIED_LABEL);
    const prev = byType.get(label) ?? { label, active: 0, inactive: 0 };
    byType.set(
      label,
      row.active ? { ...prev, active: prev.active + 1 } : { ...prev, inactive: prev.inactive + 1 }
    );
  }
  const sorted = [...byType.values()].sort(
    (a, b) => fleetTotal(b) - fleetTotal(a) || a.label.localeCompare(b.label)
  );
  return collapseFleetTail(sorted);
}

export function buildFleetStatus(active: number, total: number): LabeledCount[] {
  return [
    { label: ACTIVE_FLEET_LABEL, count: active },
    { label: STANDBY_FLEET_LABEL, count: Math.max(total - active, 0) },
  ];
}

export function computeAvailabilityPct(active: number, total: number): number | null {
  const ratio = safeRatio(active, total);
  return ratio === null ? null : Math.round(ratio * PERCENT);
}

function breakdownStatusLabel(row: BreakdownRow): string {
  return (
    BREAKDOWN_STATUS_LABELS[row.status ?? ''] ?? labelOrFallback(row.status, UNSPECIFIED_LABEL)
  );
}

/** Month-to-date breakdown counts by status and by `breakdowns.machine_type`. */
export function buildBreakdownStats(rows: readonly BreakdownRow[]): BreakdownStats {
  const byMachineType = countBy(rows, (row) =>
    labelOrFallback(row.machine_type, UNSPECIFIED_LABEL)
  );
  return {
    total: rows.length,
    open: rows.filter((row) => row.status === OPEN_BREAKDOWN_STATUS).length,
    downtimeHours: rows.reduce((sum, row) => sum + toNumber(row.duration_hours), 0),
    byStatus: countBy(rows, breakdownStatusLabel),
    byMachineType: keepTop(byMachineType, MAX_CATEGORY_SEGMENTS),
  };
}

function departmentName(ref: EmployeeDepartmentRow['departments']): string {
  const first = Array.isArray(ref) ? ref[0] : ref;
  return labelOrFallback(first?.display_name, UNASSIGNED_LABEL);
}

/** Headcount by `departments.display_name` (via `employees.department_id`). */
export function buildPersonnelByDepartment(rows: readonly EmployeeDepartmentRow[]): LabeledCount[] {
  const counts = countBy(rows, (row) => departmentName(row.departments));
  return keepTop(counts, MAX_DEPARTMENT_SEGMENTS);
}

function daysInMonth(day: Date): number {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
}

interface TargetAttainmentOptions {
  target: MonthlyTargetRow | null;
  coalMtd: number;
  todayIso: string;
}

/** Compares MTD coal against `production_monthly_targets` (full month and pro-rata pace). */
export function computeTargetAttainment({
  target,
  coalMtd,
  todayIso,
}: TargetAttainmentOptions): TargetAttainment | null {
  if (!target) return null;
  const coalTargetTonnes = toNumber(target.coal_target_tonnes);
  if (coalTargetTonnes <= 0) return null;
  const wasteTargetTonnes = toNumber(target.waste_target_tonnes);
  const day = new Date(`${todayIso}T00:00:00Z`);
  const proRataTarget = (coalTargetTonnes * day.getUTCDate()) / daysInMonth(day);
  const pace = safeRatio(coalMtd, proRataTarget);
  return {
    coalTargetTonnes,
    wasteTargetTonnes,
    coalAttainmentPct: (coalMtd / coalTargetTonnes) * PERCENT,
    coalPacePct: pace === null ? null : pace * PERCENT,
    plannedStripRatio: safeRatio(wasteTargetTonnes, coalTargetTonnes),
  };
}
