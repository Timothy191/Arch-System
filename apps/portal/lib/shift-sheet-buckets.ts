/**
 * Client-safe definitions for the machine-operations shift sheet and
 * the Engineering Notes -> Overview full-fleet ledger.
 *
 * This module is intentionally dependency-free. The shift sheet is rendered by a
 * client component, and importing these values from `lib/shift-completeness.ts`
 * would pull `@repo/redis` (and the Node Redis driver) into the browser bundle —
 * Next's client-boundary build fails on that. `lib/shift-completeness.ts`
 * imports from here; never the other way round.
 *
 * Buckets are backed by `delay_categories` names (seeded in migrations
 * 195_machine_operations_delay_categories.sql and
 * 208_engineering_notes_overview_delay_categories.sql) and aggregated from
 * `delay_entries`, not from per-bucket numeric columns.
 */
export const DELAY_BUCKET_KEYS = [
  'blasting',
  'natural',
  'noOperator',
  'otherProduction',
  'greasingStartup',
  'maintenanceGet',
  'breakdown',
] as const;

export type DelayBucketKey = (typeof DELAY_BUCKET_KEYS)[number];

export type DelayBucketMinutes = Record<DelayBucketKey, number>;

/**
 * Category-name → sheet bucket. Lowercased keys; aliases keep the historic
 * generic categories (seeded before the sheet buckets existed) landing in the
 * column a supervisor would expect. Unmapped categories (e.g. `External`) are
 * intentionally excluded so they never inflate a production bucket.
 */
export const DELAY_BUCKET_BY_CATEGORY: Record<string, DelayBucketKey> = {
  blasting: 'blasting',
  natural: 'natural',
  weather: 'natural',
  'no operator': 'noOperator',
  'operator unavailable': 'noOperator',
  'other production delay': 'otherProduction',
  production: 'otherProduction',
  other: 'otherProduction',
  lunches: 'otherProduction',
  'safety talks': 'otherProduction',
  refueling: 'otherProduction',
  standby: 'otherProduction',
  'greasing & startup': 'greasingStartup',
  'greasing and startup': 'greasingStartup',
  'greasing / startups': 'greasingStartup',
  'maintenance & get': 'maintenanceGet',
  'ges / maintenance': 'maintenanceGet',
  'tyres & tracks': 'maintenanceGet',
  'tyres / trams': 'maintenanceGet',
  maintenance: 'maintenanceGet',
  engineering: 'maintenanceGet',
  breakdown: 'breakdown',
  'equipment breakdown': 'breakdown',
};

export function emptyDelayBuckets(): DelayBucketMinutes {
  return {
    blasting: 0,
    natural: 0,
    noOperator: 0,
    otherProduction: 0,
    greasingStartup: 0,
    maintenanceGet: 0,
    breakdown: 0,
  };
}

/**
 * 12-column delay sequence for Control Room -> Engineering Notes -> "Overview"
 * in the exact column order specified by Pit Operations:
 * Natural Delays | Blasting delays | Lunches | Safety talks | Refueling |
 * No Operator | Standby | Other | GES / Maintance | Tyres / Trams |
 * Greasing / Startups | Breakdown
 */
export const OVERVIEW_DELAY_KEYS = [
  'natural',
  'blasting',
  'lunches',
  'safetyTalks',
  'refueling',
  'noOperator',
  'standby',
  'other',
  'gesMaintenance',
  'tyresTracks',
  'greasingStartups',
  'breakdown',
] as const;

export type OverviewDelayKey = (typeof OVERVIEW_DELAY_KEYS)[number];

export type OverviewDelayHours = Record<OverviewDelayKey, number>;

export const MAX_SHIFT_HOURS = 12;

export type OverviewDelayGroup = 'production' | 'nonProduction' | 'engineering';

export interface OverviewDelayColumnMeta {
  key: OverviewDelayKey;
  label: string;
  categoryName: string;
  standardDefault: number;
  isStandardAllowance: boolean;
  isDowntime: boolean;
  delayGroup: OverviewDelayGroup;
}

export const OVERVIEW_DELAY_COLUMNS: ReadonlyArray<OverviewDelayColumnMeta> = [
  {
    key: 'natural',
    label: 'Natural Delays',
    categoryName: 'Natural',
    standardDefault: 0,
    isStandardAllowance: false,
    isDowntime: false,
    delayGroup: 'nonProduction',
  },
  {
    key: 'blasting',
    label: 'Blasting Delays',
    categoryName: 'Blasting',
    standardDefault: 0,
    isStandardAllowance: false,
    isDowntime: false,
    delayGroup: 'production',
  },
  {
    key: 'lunches',
    label: 'Lunches',
    categoryName: 'Lunches',
    standardDefault: 0.5,
    isStandardAllowance: true,
    isDowntime: false,
    delayGroup: 'production',
  },
  {
    key: 'safetyTalks',
    label: 'Safety Talks',
    categoryName: 'Safety Talks',
    standardDefault: 0.5,
    isStandardAllowance: true,
    isDowntime: false,
    delayGroup: 'production',
  },
  {
    key: 'refueling',
    label: 'Refueling',
    categoryName: 'Refueling',
    standardDefault: 0.2,
    isStandardAllowance: true,
    isDowntime: false,
    delayGroup: 'production',
  },
  {
    key: 'noOperator',
    label: 'No Operator',
    categoryName: 'No Operator',
    standardDefault: 0,
    isStandardAllowance: false,
    isDowntime: false,
    delayGroup: 'production',
  },
  {
    key: 'standby',
    label: 'Standby',
    categoryName: 'Standby',
    standardDefault: 0,
    isStandardAllowance: false,
    isDowntime: false,
    delayGroup: 'production',
  },
  {
    key: 'other',
    label: 'Other',
    categoryName: 'Other Production Delay',
    standardDefault: 0,
    isStandardAllowance: false,
    isDowntime: false,
    delayGroup: 'nonProduction',
  },
  {
    key: 'gesMaintenance',
    label: 'GES / Maintenance',
    categoryName: 'Maintenance & GET',
    standardDefault: 0.5,
    isStandardAllowance: true,
    isDowntime: true,
    delayGroup: 'engineering',
  },
  {
    key: 'tyresTracks',
    label: 'Tyres / Trams',
    categoryName: 'Tyres & Tracks',
    standardDefault: 0.2,
    isStandardAllowance: true,
    isDowntime: true,
    delayGroup: 'engineering',
  },
  {
    key: 'greasingStartups',
    label: 'Greasing / Startups',
    categoryName: 'Greasing & Startup',
    standardDefault: 0.5,
    isStandardAllowance: true,
    isDowntime: true,
    delayGroup: 'engineering',
  },
  {
    key: 'breakdown',
    label: 'Breakdown',
    categoryName: 'Breakdown',
    standardDefault: 0,
    isStandardAllowance: false,
    isDowntime: true,
    delayGroup: 'engineering',
  },
] as const;

export const STANDARD_OVERVIEW_DELAY_DEFAULTS: OverviewDelayHours = {
  natural: 0,
  blasting: 0,
  lunches: 0.5,
  safetyTalks: 0.5,
  refueling: 0.2,
  noOperator: 0,
  standby: 0,
  other: 0,
  gesMaintenance: 0.5,
  tyresTracks: 0.2,
  greasingStartups: 0.5,
  breakdown: 0,
};

export function createStandardOverviewDelays(): OverviewDelayHours {
  return { ...STANDARD_OVERVIEW_DELAY_DEFAULTS };
}

export function createZeroOverviewDelays(): OverviewDelayHours {
  return {
    natural: 0,
    blasting: 0,
    lunches: 0,
    safetyTalks: 0,
    refueling: 0,
    noOperator: 0,
    standby: 0,
    other: 0,
    gesMaintenance: 0,
    tyresTracks: 0,
    greasingStartups: 0,
    breakdown: 0,
  };
}

export const OVERVIEW_DELAY_BY_CATEGORY: Record<string, OverviewDelayKey> = {
  natural: 'natural',
  weather: 'natural',
  blasting: 'blasting',
  lunches: 'lunches',
  lunch: 'lunches',
  'safety talks': 'safetyTalks',
  'safety talk': 'safetyTalks',
  refueling: 'refueling',
  refuel: 'refueling',
  'no operator': 'noOperator',
  'operator unavailable': 'noOperator',
  standby: 'standby',
  'other production delay': 'other',
  production: 'other',
  other: 'other',
  'maintenance & get': 'gesMaintenance',
  'ges / maintenance': 'gesMaintenance',
  'ges / maintance': 'gesMaintenance',
  maintenance: 'gesMaintenance',
  engineering: 'gesMaintenance',
  'tyres & tracks': 'tyresTracks',
  'tyres and tracks': 'tyresTracks',
  'tyres / trams': 'tyresTracks',
  'greasing & startup': 'greasingStartups',
  'greasing and startup': 'greasingStartups',
  'greasing / startups': 'greasingStartups',
  breakdown: 'breakdown',
  'equipment breakdown': 'breakdown',
};

export interface MachineOverviewComputedMetrics {
  totalSmrWorked: number;
  productionDelayHours: number;
  nonProductionDelayHours: number;
  engineeringDelayHours: number;
  downtimeHours: number;
  operationalDelayHours: number;
  totalDelayHours: number;
  availableHours: number;
  availabilityPercent: number;
  utilizationPercent: number;
  maxDelaysAllowedHours: number;
  maxProductionAllowedHours: number;
  remainingShiftHours: number;
}

export function computeMachineOverviewMetrics(
  startSmr: number,
  stopSmr: number,
  delays: OverviewDelayHours,
  shiftHours = MAX_SHIFT_HOURS
): MachineOverviewComputedMetrics {
  const safeStart = Number.isFinite(startSmr) ? startSmr : 0;
  const safeStop = Number.isFinite(stopSmr) ? stopSmr : safeStart;
  const totalSmrWorked = Math.min(
    shiftHours,
    Math.max(0, Number((safeStop - safeStart).toFixed(2)))
  );

  const productionDelayHours = Number(
    (
      (delays.blasting || 0) +
      (delays.lunches || 0) +
      (delays.safetyTalks || 0) +
      (delays.refueling || 0) +
      (delays.noOperator || 0) +
      (delays.standby || 0)
    ).toFixed(2)
  );

  const nonProductionDelayHours = Number(((delays.natural || 0) + (delays.other || 0)).toFixed(2));

  const engineeringDelayHours = Number(
    (
      (delays.gesMaintenance || 0) +
      (delays.tyresTracks || 0) +
      (delays.greasingStartups || 0) +
      (delays.breakdown || 0)
    ).toFixed(2)
  );

  const downtimeHours = engineeringDelayHours;
  const operationalDelayHours = Number((productionDelayHours + nonProductionDelayHours).toFixed(2));
  const totalDelayHours = Number((downtimeHours + operationalDelayHours).toFixed(2));
  const availableHours = Math.max(0, Number((shiftHours - downtimeHours).toFixed(2)));

  const availabilityPercent =
    shiftHours > 0
      ? Math.min(100, Math.max(0, Number(((availableHours / shiftHours) * 100).toFixed(1))))
      : 0;

  const utilizationPercent =
    availableHours > 0
      ? Math.min(100, Math.max(0, Number(((totalSmrWorked / availableHours) * 100).toFixed(1))))
      : 0;

  const maxDelaysAllowedHours = Math.max(0, Number((shiftHours - totalSmrWorked).toFixed(2)));
  const maxProductionAllowedHours = Math.max(0, Number((shiftHours - totalDelayHours).toFixed(2)));
  const remainingShiftHours = Math.max(
    0,
    Number((shiftHours - totalSmrWorked - totalDelayHours).toFixed(2))
  );

  return {
    totalSmrWorked,
    productionDelayHours,
    nonProductionDelayHours,
    engineeringDelayHours,
    downtimeHours,
    operationalDelayHours,
    totalDelayHours,
    availableHours,
    availabilityPercent,
    utilizationPercent,
    maxDelaysAllowedHours,
    maxProductionAllowedHours,
    remainingShiftHours,
  };
}

function sumOverviewDelays(delays: OverviewDelayHours): number {
  let sum = 0;
  for (const key of OVERVIEW_DELAY_KEYS) {
    sum += Number(delays[key] ?? 0);
  }
  return Number(sum.toFixed(2));
}

function areAllStandardAllowancesAtDefault(delays: OverviewDelayHours): boolean {
  for (const col of OVERVIEW_DELAY_COLUMNS) {
    if (!col.isStandardAllowance) continue;
    const current = Number(delays[col.key] ?? 0);
    if (Math.abs(current - col.standardDefault) > 0.001) {
      return false;
    }
  }
  return true;
}

function trimDelaysToMaxBudget(
  delays: OverviewDelayHours,
  maxTotalDelays: number,
  protectedKey?: OverviewDelayKey
): OverviewDelayHours {
  const nextDelays: OverviewDelayHours = { ...delays };
  let excess = Number((sumOverviewDelays(nextDelays) - maxTotalDelays).toFixed(2));
  if (excess <= 0) return nextDelays;

  const standardAllowanceColsReversed = [...OVERVIEW_DELAY_COLUMNS]
    .filter((c) => c.isStandardAllowance && c.key !== protectedKey)
    .reverse();

  for (const col of standardAllowanceColsReversed) {
    if (excess <= 0) break;
    const current = Number(nextDelays[col.key] ?? 0);
    if (current <= 0) continue;
    const cut = Math.min(current, excess);
    nextDelays[col.key] = Number((current - cut).toFixed(2));
    excess = Number((excess - cut).toFixed(2));
  }

  if (excess > 0) {
    const otherColsReversed = [...OVERVIEW_DELAY_COLUMNS]
      .filter((c) => !c.isStandardAllowance && c.key !== protectedKey)
      .reverse();
    for (const col of otherColsReversed) {
      if (excess <= 0) break;
      const current = Number(nextDelays[col.key] ?? 0);
      if (current <= 0) continue;
      const cut = Math.min(current, excess);
      nextDelays[col.key] = Number((current - cut).toFixed(2));
      excess = Number((excess - cut).toFixed(2));
    }
  }

  return nextDelays;
}

/**
 * Enforces the 12-hour shift cap when Start SMR or Stop SMR changes:
 * - Total worked hours (`stopSmr - startSmr`) cannot exceed `12 - explicitNonStandardDelays`
 *   (e.g. if Breakdown = 10h, max worked hours = 2.0h).
 * - Remaining delay budget is `12 - workedHours` (e.g. if 10h worked, max delays = 2.0h);
 *   any excess standard allowances are trimmed to fit the 12h cap.
 */
export function reconcileOverviewShiftHoursOnSmrChange(params: {
  currentStartSmr: number;
  currentStopSmr: number;
  changedField: 'startSmr' | 'stopSmr';
  nextValue: number;
  delays: OverviewDelayHours;
  maxShiftHours?: number;
}): {
  startSmr: number;
  stopSmr: number;
  delays: OverviewDelayHours;
} {
  const {
    currentStartSmr,
    currentStopSmr,
    changedField,
    nextValue,
    delays,
    maxShiftHours = MAX_SHIFT_HOURS,
  } = params;

  let nonStandardDelaySum = 0;
  for (const col of OVERVIEW_DELAY_COLUMNS) {
    if (!col.isStandardAllowance) {
      nonStandardDelaySum += Number(delays[col.key] ?? 0);
    }
  }
  const maxAllowedWorked = Math.max(0, Number((maxShiftHours - nonStandardDelaySum).toFixed(2)));

  const startSmr =
    changedField === 'startSmr'
      ? Math.max(0, Number(nextValue.toFixed(2)))
      : Math.max(0, Number(currentStartSmr.toFixed(2)));

  const rawStopSmr =
    changedField === 'stopSmr'
      ? Math.max(startSmr, Number(nextValue.toFixed(2)))
      : Math.max(startSmr, Number(currentStopSmr.toFixed(2)));

  const rawWorked = Number((rawStopSmr - startSmr).toFixed(2));
  const clampedWorked = Math.min(maxAllowedWorked, Math.max(0, rawWorked));
  const stopSmr = Number((startSmr + clampedWorked).toFixed(2));

  const maxDelaysAllowed = Math.max(0, Number((maxShiftHours - clampedWorked).toFixed(2)));
  const reconciledDelays = trimDelaysToMaxBudget(delays, maxDelaysAllowed);

  return {
    startSmr,
    stopSmr,
    delays: reconciledDelays,
  };
}

/**
 * Enforces the 12-hour shift cap when any Delay column changes:
 * - Total delays cannot exceed `12 - workedHours` (e.g. if 10h worked, max 2.0h for delays).
 * - When `breakdown` is entered on a row that still has default standard allowances,
 *   untouched standard allowances are zeroed so e.g. `10h breakdown` leaves `2.0h` for production.
 */
export function reconcileOverviewShiftHoursOnDelayChange(params: {
  startSmr: number;
  stopSmr: number;
  delays: OverviewDelayHours;
  changedKey: OverviewDelayKey;
  nextDelayValue: number;
  maxShiftHours?: number;
}): {
  startSmr: number;
  stopSmr: number;
  delays: OverviewDelayHours;
} {
  const {
    startSmr,
    stopSmr,
    delays,
    changedKey,
    nextDelayValue,
    maxShiftHours = MAX_SHIFT_HOURS,
  } = params;

  const workedHours = Math.min(maxShiftHours, Math.max(0, Number((stopSmr - startSmr).toFixed(2))));
  const maxDelaysAllowed = Math.max(0, Number((maxShiftHours - workedHours).toFixed(2)));
  const requested = Math.min(maxDelaysAllowed, Math.max(0, Number(nextDelayValue.toFixed(2))));

  let candidateDelays: OverviewDelayHours = {
    ...delays,
    [changedKey]: requested,
  };

  if (changedKey === 'breakdown' && requested > 0 && areAllStandardAllowancesAtDefault(delays)) {
    for (const col of OVERVIEW_DELAY_COLUMNS) {
      if (col.isStandardAllowance) {
        candidateDelays[col.key] = 0;
      }
    }
  }

  candidateDelays = trimDelaysToMaxBudget(candidateDelays, maxDelaysAllowed, changedKey);

  let otherSum = 0;
  for (const key of OVERVIEW_DELAY_KEYS) {
    if (key !== changedKey) {
      otherSum += Number(candidateDelays[key] ?? 0);
    }
  }
  const maxForChangedKey = Math.max(0, Number((maxDelaysAllowed - otherSum).toFixed(2)));
  candidateDelays[changedKey] = Math.min(requested, maxForChangedKey);

  return {
    startSmr,
    stopSmr,
    delays: candidateDelays,
  };
}

export interface OverviewCommentValidationResult {
  valid: boolean;
  hasRecordedDelay: boolean;
  hasNonStandardDelay: boolean;
  activeDelayLabels: string[];
  error: string | null;
}

export function validateOverviewRowDelaysAndComment(
  delays: OverviewDelayHours,
  comment: string | null | undefined
): OverviewCommentValidationResult {
  const activeDelayLabels: string[] = [];
  let hasNonStandardDelay = false;

  for (const col of OVERVIEW_DELAY_COLUMNS) {
    const val = Number(delays[col.key] ?? 0);
    if (val > 0) {
      activeDelayLabels.push(`${col.label} (${val.toFixed(1)}h)`);
      if (!col.isStandardAllowance || Math.abs(val - col.standardDefault) > 0.001) {
        hasNonStandardDelay = true;
      }
    }
  }

  const hasRecordedDelay = activeDelayLabels.length > 0;
  const trimmedComment = (comment ?? '').trim();

  if (hasRecordedDelay && trimmedComment.length === 0) {
    return {
      valid: false,
      hasRecordedDelay,
      hasNonStandardDelay,
      activeDelayLabels,
      error: `A matching comment is required when any delay is recorded (${activeDelayLabels.join(', ')}).`,
    };
  }

  return {
    valid: true,
    hasRecordedDelay,
    hasNonStandardDelay,
    activeDelayLabels,
    error: null,
  };
}
