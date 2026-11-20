import { classifyReconciliationDrift, RECONCILIATION_UI } from '@/lib/production-reconciliation';
import { formatNumber, formatPercent, formatRatio, formatTonnes } from './executive-format';
import type { ExecutiveData } from './executive-metrics';

export type GaugeTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface GaugeSpec {
  id: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  unit: string;
  decimals: number;
  tone: GaugeTone;
  caption: string;
}

interface ToneThresholds {
  good: number;
  warn: number;
}

type DriftLevel = ReturnType<typeof classifyReconciliationDrift>;

const FLEET_THRESHOLDS: ToneThresholds = { good: 80, warn: 60 };
const PACE_THRESHOLDS: ToneThresholds = { good: 95, warn: 80 };
const PERCENT_GAUGE_MAX = 100;
const PACE_GAUGE_MAX = 150;
const DRIFT_GAUGE_MAX = 20;
const REFERENCE_HEADROOM = 2;
const WARN_TOLERANCE = 1.1;
const MIN_GAUGE_SPAN = 1;
const RATE_DECIMALS = 2;
const SUMMARY_UNAVAILABLE = 'Production summary unavailable';

const DRIFT_TONE: Readonly<Record<DriftLevel, GaugeTone>> = {
  stable: 'good',
  minor: 'warn',
  moderate: 'warn',
  critical: 'bad',
};

export function toneHigherIsBetter(score: number | null, thresholds: ToneThresholds): GaugeTone {
  if (score === null) return 'neutral';
  if (score >= thresholds.good) return 'good';
  return score >= thresholds.warn ? 'warn' : 'bad';
}

export function toneLowerIsBetter(score: number | null, thresholds: ToneThresholds): GaugeTone {
  if (score === null) return 'neutral';
  if (score <= thresholds.good) return 'good';
  return score <= thresholds.warn ? 'warn' : 'bad';
}

function referenceThresholds(reference: number): ToneThresholds {
  return { good: reference, warn: reference * WARN_TOLERANCE };
}

function gaugeMax(reference: number | null, fallback: number | null): number {
  const basis = reference ?? fallback ?? 0;
  return Math.max(basis * REFERENCE_HEADROOM, MIN_GAUGE_SPAN);
}

function fleetGauge(data: ExecutiveData): GaugeSpec {
  const { availabilityPct, active, total } = data.fleet;
  return {
    id: 'fleet-availability',
    label: 'Availability',
    value: availabilityPct,
    min: 0,
    max: PERCENT_GAUGE_MAX,
    unit: '%',
    decimals: 0,
    tone: toneHigherIsBetter(availabilityPct, FLEET_THRESHOLDS),
    caption: `${formatNumber(active)} of ${formatNumber(total)} machines active`,
  };
}

function paceCaption(data: ExecutiveData): string {
  if (!data.summaryAvailable) return SUMMARY_UNAVAILABLE;
  if (!data.target) return 'No monthly coal target set';
  const attained = formatPercent(data.target.coalAttainmentPct);
  return `${attained} of ${formatTonnes(data.target.coalTargetTonnes)} monthly target`;
}

function paceGauge(data: ExecutiveData): GaugeSpec {
  const pace = data.summaryAvailable ? (data.target?.coalPacePct ?? null) : null;
  return {
    id: 'coal-target-pace',
    label: 'Coal Target Pace',
    value: pace,
    min: 0,
    max: PACE_GAUGE_MAX,
    unit: '%',
    decimals: 0,
    tone: toneHigherIsBetter(pace, PACE_THRESHOLDS),
    caption: paceCaption(data),
  };
}

function driftGauge(data: ExecutiveData): GaugeSpec {
  const drift = data.summaryAvailable ? data.mtd.avgAbsDriftPct : null;
  const level = classifyReconciliationDrift(drift ?? 0);
  return {
    id: 'reconciliation-drift',
    label: 'Drift Control',
    value: drift,
    min: 0,
    max: DRIFT_GAUGE_MAX,
    unit: '%',
    decimals: 1,
    tone: drift === null ? 'neutral' : DRIFT_TONE[level],
    caption: drift === null ? SUMMARY_UNAVAILABLE : RECONCILIATION_UI[level].label,
  };
}

function fuelGauge(data: ExecutiveData): GaugeSpec {
  const fuel = data.summaryAvailable ? data.mtd.fuelPerTonne : null;
  const reference = data.summaryAvailable ? data.window.fuelPerTonne : null;
  const caption =
    reference === null
      ? 'No 30-day baseline'
      : `30-day avg ${formatNumber(reference, RATE_DECIMALS)} L/t`;
  return {
    id: 'fuel-efficiency',
    label: 'Fuel Burn',
    value: fuel,
    min: 0,
    max: gaugeMax(reference, fuel),
    unit: ' L/t',
    decimals: RATE_DECIMALS,
    tone: reference === null ? 'neutral' : toneLowerIsBetter(fuel, referenceThresholds(reference)),
    caption: data.summaryAvailable ? caption : SUMMARY_UNAVAILABLE,
  };
}

function stripGauge(data: ExecutiveData): GaugeSpec {
  const strip = data.summaryAvailable ? data.mtd.stripRatio : null;
  const planned = data.target?.plannedStripRatio ?? null;
  const caption = planned === null ? 'No planned strip ratio' : `Plan ${formatRatio(planned)}`;
  return {
    id: 'strip-ratio',
    label: 'Strip Ratio vs Plan',
    value: strip,
    min: 0,
    max: gaugeMax(planned, strip),
    unit: ' : 1',
    decimals: RATE_DECIMALS,
    tone: planned === null ? 'neutral' : toneLowerIsBetter(strip, referenceThresholds(planned)),
    caption: data.summaryAvailable ? caption : SUMMARY_UNAVAILABLE,
  };
}

export function buildGaugeSpecs(data: ExecutiveData): GaugeSpec[] {
  return [fleetGauge(data), paceGauge(data), driftGauge(data), fuelGauge(data), stripGauge(data)];
}
