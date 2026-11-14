import type {
  AnomalySeverity,
  FailureModeCategory,
  MaintenanceRiskLevel,
  PredictiveMaintenancePrediction,
  TelemetryAnomalyAlert,
} from '@repo/contract';

const MAX_RISK_SCORE = 100;
const BREAKDOWN_WEIGHT_POINTS = 15;
const MAX_BREAKDOWN_SCORE = 45;
const PM_INTERVAL_HOURS = 250;
const PM_OVERDUE_BASE_POINTS = 25;
const PM_WARNING_WINDOW_HOURS = 35;
const PM_WARNING_POINTS = 15;
const BASE_CONFIDENCE = 0.55;
const CONFIDENCE_PER_SIGNAL = 0.12;
const MAX_CONFIDENCE = 0.96;
const CRITICAL_RUL_HOURS = 24;
const HIGH_RUL_HOURS = 72;
const MEDIUM_RUL_HOURS = 168;
const LOW_RUL_HOURS = 500;
const CRITICAL_RISK_THRESHOLD = 75;
const HIGH_RISK_THRESHOLD = 50;
const MEDIUM_RISK_THRESHOLD = 25;
const MAX_OCCURRENCE_SCORE = 10;
const MIN_FMEA_SCORE = 1;

export interface MachineHealthInput {
  readonly machineId: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly breakdownCount30d: number;
  readonly currentSmuHours?: number | null;
  readonly lastPmSmuHours?: number | null;
  readonly anomalies: readonly TelemetryAnomalyAlert[];
}

const ANOMALY_SEVERITY_POINTS: Readonly<Record<AnomalySeverity, number>> = {
  NORMAL: 0,
  WARNING: 15,
  SENSOR_FAULT: 10,
  CRITICAL: 30,
};

const FAILURE_MODE_BY_METRIC: Readonly<Record<string, FailureModeCategory>> = {
  hydraulic_pressure: 'HYDRAULIC',
  engine_temp: 'THERMAL',
  vibration_level: 'DRIVETRAIN',
  engine_rpm: 'DRIVETRAIN',
  fuel_level: 'RECURRING_GENERAL',
  tonnage_drift_pct: 'STRUCTURAL',
};

const RECOMMENDED_ACTION_BY_MODE: Readonly<Record<FailureModeCategory, string>> = {
  HYDRAULIC: 'Inspect hydraulic main pump, relief valves, and hose seals before next shift.',
  THERMAL: 'Flush radiator core, verify coolant circulation, and inspect thermostat housing.',
  DRIVETRAIN: 'Perform vibration/alignment check on drivetrain bearings, mounts, and couplings.',
  STRUCTURAL: 'Calibrate load cells/bucket factor and inspect frame pins for structural play.',
  PM_OVERDUE: 'Schedule overdue 250h PM service immediately (oil, filters, and fluid sampling).',
  RECURRING_GENERAL: 'Run full 8D root-cause diagnostic on recurring breakdown fault codes.',
};

const SEVERITY_RATING_BY_RISK: Readonly<Record<MaintenanceRiskLevel, number>> = {
  LOW: 3,
  MEDIUM: 5,
  HIGH: 8,
  CRITICAL: 10,
};

const DETECTION_RATING_BY_MODE: Readonly<Record<FailureModeCategory, number>> = {
  HYDRAULIC: 4,
  THERMAL: 3,
  DRIVETRAIN: 5,
  STRUCTURAL: 6,
  PM_OVERDUE: 2,
  RECURRING_GENERAL: 7,
};

/**
 * Computes FMEA Risk Priority Number (Severity x Occurrence x Detection, 1-1000).
 */
export function calculateFmeaRpn(options: {
  readonly riskLevel: MaintenanceRiskLevel;
  readonly breakdownCount30d: number;
  readonly failureMode: FailureModeCategory;
}): number {
  const severity = SEVERITY_RATING_BY_RISK[options.riskLevel];
  const occurrence = Math.min(
    MAX_OCCURRENCE_SCORE,
    Math.max(MIN_FMEA_SCORE, options.breakdownCount30d * 2 + 1)
  );
  const detection = DETECTION_RATING_BY_MODE[options.failureMode];
  return severity * occurrence * detection;
}

function classifyRiskLevel(riskScore: number): MaintenanceRiskLevel {
  if (riskScore >= CRITICAL_RISK_THRESHOLD) return 'CRITICAL';
  if (riskScore >= HIGH_RISK_THRESHOLD) return 'HIGH';
  if (riskScore >= MEDIUM_RISK_THRESHOLD) return 'MEDIUM';
  return 'LOW';
}

function estimateHoursToFailure(riskLevel: MaintenanceRiskLevel): number {
  const rulByLevel: Readonly<Record<MaintenanceRiskLevel, number>> = {
    CRITICAL: CRITICAL_RUL_HOURS,
    HIGH: HIGH_RUL_HOURS,
    MEDIUM: MEDIUM_RUL_HOURS,
    LOW: LOW_RUL_HOURS,
  };
  return rulByLevel[riskLevel];
}

function resolveSmuRemaining(
  currentSmuHours: number | null | undefined,
  lastPmSmuHours: number | null | undefined
): number | null {
  if (typeof currentSmuHours !== 'number' || !Number.isFinite(currentSmuHours)) {
    return null;
  }
  const baselinePm =
    typeof lastPmSmuHours === 'number' && Number.isFinite(lastPmSmuHours)
      ? lastPmSmuHours
      : Math.floor(currentSmuHours / PM_INTERVAL_HOURS) * PM_INTERVAL_HOURS;
  const nextPmTarget = baselinePm + PM_INTERVAL_HOURS;
  return Number((nextPmTarget - currentSmuHours).toFixed(1));
}

function evaluateSingleMachine(
  machine: MachineHealthInput
): PredictiveMaintenancePrediction | null {
  const breakdownPoints = Math.min(
    MAX_BREAKDOWN_SCORE,
    machine.breakdownCount30d * BREAKDOWN_WEIGHT_POINTS
  );

  const smuHoursRemaining = resolveSmuRemaining(machine.currentSmuHours, machine.lastPmSmuHours);
  let pmPoints = 0;
  if (smuHoursRemaining !== null && smuHoursRemaining <= 0) {
    pmPoints = PM_OVERDUE_BASE_POINTS;
  } else if (smuHoursRemaining !== null && smuHoursRemaining <= PM_WARNING_WINDOW_HOURS) {
    pmPoints = PM_WARNING_POINTS;
  }

  let anomalyPoints = 0;
  let topAnomaly: TelemetryAnomalyAlert | null = null;
  for (const alert of machine.anomalies) {
    const pts = ANOMALY_SEVERITY_POINTS[alert.severity];
    anomalyPoints += pts;
    if (!topAnomaly || pts > ANOMALY_SEVERITY_POINTS[topAnomaly.severity]) {
      topAnomaly = alert;
    }
  }

  const totalScore = Math.min(MAX_RISK_SCORE, breakdownPoints + pmPoints + anomalyPoints);
  if (totalScore < MEDIUM_RISK_THRESHOLD) return null;

  const riskLevel = classifyRiskLevel(totalScore);
  const failureMode: FailureModeCategory = topAnomaly
    ? (FAILURE_MODE_BY_METRIC[topAnomaly.metric] ?? 'RECURRING_GENERAL')
    : smuHoursRemaining !== null && smuHoursRemaining <= 0
      ? 'PM_OVERDUE'
      : 'RECURRING_GENERAL';

  const signalCount =
    (machine.breakdownCount30d > 0 ? 1 : 0) + (pmPoints > 0 ? 1 : 0) + machine.anomalies.length;
  const confidence = Number(
    Math.min(MAX_CONFIDENCE, BASE_CONFIDENCE + signalCount * CONFIDENCE_PER_SIGNAL).toFixed(2)
  );

  const reasonParts: string[] = [];
  if (machine.breakdownCount30d > 0) {
    reasonParts.push(`${machine.breakdownCount30d} breakdown(s) in last 30d`);
  }
  if (smuHoursRemaining !== null && smuHoursRemaining <= PM_WARNING_WINDOW_HOURS) {
    reasonParts.push(
      smuHoursRemaining <= 0
        ? `PM overdue by ${Math.abs(smuHoursRemaining)}h`
        : `PM due in ${smuHoursRemaining}h`
    );
  }
  if (topAnomaly) {
    reasonParts.push(topAnomaly.reason);
  }

  return {
    machineId: machine.machineId,
    machineName: machine.machineName,
    machineType: machine.machineType,
    riskLevel,
    riskScore: totalScore,
    fmeaRpn: calculateFmeaRpn({
      riskLevel,
      breakdownCount30d: machine.breakdownCount30d,
      failureMode,
    }),
    failureMode,
    confidence,
    estimatedHoursToFailure: estimateHoursToFailure(riskLevel),
    breakdownCount30d: machine.breakdownCount30d,
    smuHoursRemaining,
    reason: reasonParts.join(' | '),
    recommendedAction: RECOMMENDED_ACTION_BY_MODE[failureMode],
  };
}

/**
 * Evaluates fleet-wide predictive maintenance risk, sorted highest riskScore first.
 */
export function evaluateFleetMaintenanceRisk(
  machines: readonly MachineHealthInput[]
): readonly PredictiveMaintenancePrediction[] {
  const predictions: PredictiveMaintenancePrediction[] = [];
  for (const machine of machines) {
    const prediction = evaluateSingleMachine(machine);
    if (prediction) predictions.push(prediction);
  }
  return predictions.sort((left, right) => right.riskScore - left.riskScore);
}
