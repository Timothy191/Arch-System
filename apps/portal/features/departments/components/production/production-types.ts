import { z } from 'zod';

export interface MonthlyProductionTarget {
  target_month: string;
  coal_target_tonnes: number;
  waste_target_tonnes: number;
  bcm_target: number;
  notes: string | null;
  updated_at: string | null;
}

export interface DailyProductionRollupRow {
  date: string;
  hasData: boolean;
  dayShiftCoalTonnes: number;
  nightShiftCoalTonnes: number;
  totalCoalTonnes: number;
  dayShiftWasteTonnes: number;
  nightShiftWasteTonnes: number;
  totalWasteTonnes: number;
  haulTruckLoads: number;
  haulTruckBcm: number;
  excavatorBcm: number;
  dozerPushBcm: number;
  totalBcm: number;
  fleetOperatingHours: number;
  activeMachinesCount: number;
  stripRatio: number;
}

export interface ProductionMonthReportData {
  selectedMonth: string;
  monthLabel: string;
  availableMonths: Array<{ value: string; label: string; isPastMonth: boolean }>;
  target: MonthlyProductionTarget;
  totals: {
    coalTonnes: number;
    wasteTonnes: number;
    totalTonnes: number;
    haulTruckLoads: number;
    haulTruckBcm: number;
    excavatorBcm: number;
    dozerPushBcm: number;
    totalBcm: number;
    fleetOperatingHours: number;
    stripRatio: number;
    expectedTonnesFromBcm: number;
    reconciliationDriftPct: number;
    daysLogged: number;
    totalDaysInMonth: number;
    coalTargetProgressPct: number;
    wasteTargetProgressPct: number;
    bcmTargetProgressPct: number;
    remainingCoalTonnes: number;
    remainingWasteTonnes: number;
    requiredDailyCoalRate: number;
    requiredDailyWasteRate: number;
  };
  dailyRows: DailyProductionRollupRow[];
}

export type ProductionHorizonKey = 'shift' | 'daily' | 'weekly' | 'monthly';

export interface ProductionHorizonTargets {
  pitBcmTarget: number;
  coalTonnesTarget: number;
  wasteTonnesTarget: number;
  loadsTarget: number;
  rolloverTargetBcm: number;
  smrHoursTarget: number;
}

export interface ProductionPlatformTargets {
  shift: ProductionHorizonTargets;
  daily: ProductionHorizonTargets;
  weekly: ProductionHorizonTargets;
  monthly: ProductionHorizonTargets;
  notes?: string | null;
  updatedAt?: string | null;
}

const nonNegativeNumberSchema = z.coerce.number().finite().min(0, 'Target must be 0 or greater');

export const productionHorizonTargetsSchema = z.object({
  pitBcmTarget: nonNegativeNumberSchema,
  coalTonnesTarget: nonNegativeNumberSchema,
  wasteTonnesTarget: nonNegativeNumberSchema,
  loadsTarget: nonNegativeNumberSchema,
  rolloverTargetBcm: nonNegativeNumberSchema,
  smrHoursTarget: nonNegativeNumberSchema,
});

export const productionPlatformTargetsSchema = z.object({
  shift: productionHorizonTargetsSchema,
  daily: productionHorizonTargetsSchema,
  weekly: productionHorizonTargetsSchema,
  monthly: productionHorizonTargetsSchema,
  notes: z.string().max(500).nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export const DEFAULT_PRODUCTION_PLATFORM_TARGETS: ProductionPlatformTargets = {
  shift: {
    pitBcmTarget: 2900,
    coalTonnesTarget: 2250,
    wasteTonnesTarget: 6300,
    loadsTarget: 160,
    rolloverTargetBcm: 650,
    smrHoursTarget: 96,
  },
  daily: {
    pitBcmTarget: 5800,
    coalTonnesTarget: 4500,
    wasteTonnesTarget: 12600,
    loadsTarget: 320,
    rolloverTargetBcm: 1300,
    smrHoursTarget: 192,
  },
  weekly: {
    pitBcmTarget: 40600,
    coalTonnesTarget: 31500,
    wasteTonnesTarget: 88200,
    loadsTarget: 2240,
    rolloverTargetBcm: 9100,
    smrHoursTarget: 1344,
  },
  monthly: {
    pitBcmTarget: 174000,
    coalTonnesTarget: 135000,
    wasteTonnesTarget: 378000,
    loadsTarget: 9600,
    rolloverTargetBcm: 39000,
    smrHoursTarget: 5760,
  },
  notes: 'Baseline opencast production targets scaled from 12-hour shift plan',
  updatedAt: null,
};

const SHIFT_MULTIPLIERS = {
  daily: 2,
  weekly: 14,
  monthly: 60,
} as const;

function multiplyHorizon(
  shift: ProductionHorizonTargets,
  factor: number
): ProductionHorizonTargets {
  return {
    pitBcmTarget: Math.round(shift.pitBcmTarget * factor),
    coalTonnesTarget: Math.round(shift.coalTonnesTarget * factor),
    wasteTonnesTarget: Math.round(shift.wasteTonnesTarget * factor),
    loadsTarget: Math.round(shift.loadsTarget * factor),
    rolloverTargetBcm: Math.round(shift.rolloverTargetBcm * factor),
    smrHoursTarget: Math.round(shift.smrHoursTarget * factor * 10) / 10,
  };
}

export function scaleTargetsFromShift(
  shift: ProductionHorizonTargets
): Pick<ProductionPlatformTargets, 'shift' | 'daily' | 'weekly' | 'monthly'> {
  return {
    shift: { ...shift },
    daily: multiplyHorizon(shift, SHIFT_MULTIPLIERS.daily),
    weekly: multiplyHorizon(shift, SHIFT_MULTIPLIERS.weekly),
    monthly: multiplyHorizon(shift, SHIFT_MULTIPLIERS.monthly),
  };
}

// ─── Item 3: Production Machines Target Compliance ──────────────────────────

export type ProductionMachineHorizonKey = 'shift' | 'daily' | 'monthly';

export type ProductionMachineComplianceStatus = 'meeting' | 'below' | 'idle';

export interface ProductionMachineHorizonMetrics {
  actualLoads: number;
  targetLoads: number;
  actualPitBcm: number;
  targetPitBcm: number;
  actualRolloverBcm: number;
  targetRolloverBcm: number;
  actualHours: number;
  targetHours: number;
  attainmentPct: number;
  status: ProductionMachineComplianceStatus;
}

export interface ProductionMachineComplianceRow {
  machineId: string;
  name: string;
  machineType: string;
  serialNumber: string | null;
  siteName: string;
  roleCategory: 'haulage' | 'excavation' | 'dozer' | 'support';
  horizons: Record<ProductionMachineHorizonKey, ProductionMachineHorizonMetrics>;
}

export interface ProductionMachinesHorizonSummary {
  totalFleet: number;
  meetingCount: number;
  belowCount: number;
  idleCount: number;
  avgAttainmentPct: number;
}

export interface ProductionMachinesTargetReport {
  asOfDate: string;
  activeShiftLabel: string;
  targets: ProductionPlatformTargets;
  summaryByHorizon: Record<ProductionMachineHorizonKey, ProductionMachinesHorizonSummary>;
  machines: ProductionMachineComplianceRow[];
}

// ─── Items 4, 5, 7: Performance, Combined Delays & Foreman PDF ─────────────

export type CombinedDelayGroupKey = 'production' | 'engineering' | 'natural' | 'nonSite';

export const COMBINED_DELAY_GROUP_ORDER: readonly CombinedDelayGroupKey[] = [
  'production',
  'engineering',
  'natural',
  'nonSite',
];

export const COMBINED_DELAY_GROUP_LABELS: Record<CombinedDelayGroupKey, string> = {
  production: 'Production Delays',
  engineering: 'Engineering Delays',
  natural: 'Natural / Weather Delays',
  nonSite: 'Non-Site Delays',
};

export function classifyDelayGroup(categoryName: string | null | undefined): CombinedDelayGroupKey {
  const normalized = (categoryName ?? '').trim().toLowerCase();
  if (!normalized) return 'production';
  if (/natural|weather|rain|storm|lightning|fog/.test(normalized)) {
    return 'natural';
  }
  if (/external|non-?site|non site|power|grid|community|strike|client|off-?site/.test(normalized)) {
    return 'nonSite';
  }
  if (
    /engineering|breakdown|maintenance|ges|get|tyre|tire|track|tram|greasing|startup|mechanical|electrical/.test(
      normalized
    )
  ) {
    return 'engineering';
  }
  return 'production';
}

export interface CombinedDelayGroupSummary {
  key: CombinedDelayGroupKey;
  label: string;
  delayHours: number;
  delayMinutes: number;
  sharePct: number;
  estimatedPitBcmImpact: number;
  eventCount: number;
}

export interface ProductionShiftPerformanceRow {
  id: string;
  date: string;
  shiftType: 'day' | 'night';
  pitBcm: number;
  pitBcmTarget: number;
  pitBcmAttainmentPct: number;
  coalTonnes: number;
  wasteTonnes: number;
  haulLoads: number;
  rolloverBcm: number;
  smrHours: number;
  combinedDelayHours: number;
  productiveEfficiencyPct: number;
}

export interface ProductionDailyPerformanceRow {
  date: string;
  hasData: boolean;
  pitBcm: number;
  pitBcmTarget: number;
  pitBcmVariance: number;
  pitBcmAttainmentPct: number;
  coalTonnes: number;
  wasteTonnes: number;
  haulLoads: number;
  rolloverBcm: number;
  smrHours: number;
  combinedDelayHours: number;
}

export interface ProductionWeeklyPerformanceRow {
  weekLabel: string;
  dateRangeLabel: string;
  startDate: string;
  endDate: string;
  daysCaptured: number;
  pitBcm: number;
  pitBcmTarget: number;
  pitBcmAttainmentPct: number;
  coalTonnes: number;
  wasteTonnes: number;
  haulLoads: number;
  rolloverBcm: number;
  smrHours: number;
  combinedDelayHours: number;
}

export interface ProductionMonthlyPerformanceRow {
  month: string;
  monthLabel: string;
  pitBcm: number;
  pitBcmTarget: number;
  pitBcmAttainmentPct: number;
  coalTonnes: number;
  coalTarget: number;
  wasteTonnes: number;
  wasteTarget: number;
  haulLoads: number;
  loadsTarget: number;
  rolloverBcm: number;
  rolloverTarget: number;
  smrHours: number;
  smrHoursTarget: number;
  combinedDelayHours: number;
  stripRatio: number;
}

export interface ForemanReportSummary {
  reportDate: string;
  supervisorSummary: string;
  pitBenchProgress: string;
  productiveEfficiencyPct: number;
  totalPitBcm: number;
  pitBcmTarget: number;
  pitBcmAttainmentPct: number;
  totalCoalTonnes: number;
  totalWasteTonnes: number;
  totalHaulLoads: number;
  totalRolloverBcm: number;
  totalSmrHours: number;
  totalCombinedDelayHours: number;
  delayGroups: CombinedDelayGroupSummary[];
  keyVariances: string[];
  handoverNotes: string[];
}

export interface ProductionPerformanceData {
  selectedMonth: string;
  monthLabel: string;
  availableMonths: Array<{ value: string; label: string; isPastMonth: boolean }>;
  targets: ProductionPlatformTargets;
  shiftRows: ProductionShiftPerformanceRow[];
  dailyRows: ProductionDailyPerformanceRow[];
  weeklyRows: ProductionWeeklyPerformanceRow[];
  monthlyRows: ProductionMonthlyPerformanceRow[];
  delayGroups: CombinedDelayGroupSummary[];
  foremanSummary: ForemanReportSummary;
}

export type ProductionReportTab = 'foreman' | 'daily' | 'monthly' | 'pdf-report';

export type ProductionPdfScope = 'full' | 'foreman-delays' | 'daily-monthly';
