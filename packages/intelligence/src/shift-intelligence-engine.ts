import type {
  PredictiveMaintenancePrediction,
  ShiftHandoverBrief,
  TelemetryAnomalyAlert,
} from '@repo/contract';

const MINOR_DRIFT_PCT = 5;
const MODERATE_DRIFT_PCT = 10;
const CRITICAL_DRIFT_PCT = 15;
const TOP_DELAY_LIMIT = 3;
const MIN_COMPLETENESS_TARGET_PCT = 90;

export interface DelayCategorySummary {
  readonly category: string;
  readonly totalMinutes: number;
}

export interface SynthesizeShiftHandoverOptions {
  readonly shiftDate: string;
  readonly shiftType: 'day' | 'night';
  readonly completenessPct: number;
  readonly reconciliationDriftPct: number;
  readonly predictions: readonly PredictiveMaintenancePrediction[];
  readonly anomalies: readonly TelemetryAnomalyAlert[];
  readonly delays: readonly DelayCategorySummary[];
  readonly narrativeEnhancer?: (deterministicBrief: ShiftHandoverBrief) => Promise<string | null>;
}

function classifyDrift(driftPct: number): 'stable' | 'minor' | 'moderate' | 'critical' {
  const absDrift = Math.abs(driftPct);
  if (absDrift >= CRITICAL_DRIFT_PCT) return 'critical';
  if (absDrift >= MODERATE_DRIFT_PCT) return 'moderate';
  if (absDrift >= MINOR_DRIFT_PCT) return 'minor';
  return 'stable';
}

function buildPriorityActions(options: {
  readonly completenessPct: number;
  readonly reconciliationStatus: 'stable' | 'minor' | 'moderate' | 'critical';
  readonly highRiskPredictions: readonly PredictiveMaintenancePrediction[];
  readonly criticalAnomalies: readonly TelemetryAnomalyAlert[];
  readonly topDelays: readonly DelayCategorySummary[];
}): string[] {
  const actions: string[] = [];

  if (options.completenessPct < MIN_COMPLETENESS_TARGET_PCT) {
    actions.push(
      `Complete outstanding shift logs (${options.completenessPct.toFixed(0)}% logged vs ${MIN_COMPLETENESS_TARGET_PCT}% target).`
    );
  }

  if (options.reconciliationStatus === 'critical' || options.reconciliationStatus === 'moderate') {
    actions.push(
      `Audit tonnage reconciliation (${options.reconciliationStatus.toUpperCase()} variance) and verify bucket factor calibration.`
    );
  }

  for (const machine of options.highRiskPredictions.slice(0, TOP_DELAY_LIMIT)) {
    actions.push(`[${machine.riskLevel}] ${machine.machineName}: ${machine.recommendedAction}`);
  }

  for (const anomaly of options.criticalAnomalies.slice(0, TOP_DELAY_LIMIT)) {
    actions.push(`[${anomaly.severity}] ${anomaly.machineId}: ${anomaly.reason}`);
  }

  const topDelay = options.topDelays[0];
  if (topDelay && topDelay.totalMinutes > 0) {
    actions.push(
      `Address primary delay driver "${topDelay.category}" (${topDelay.totalMinutes} min lost).`
    );
  }

  if (actions.length === 0) {
    actions.push(
      'All shift metrics within nominal operating bounds. Proceed with standard handover.'
    );
  }

  return actions;
}

/**
 * Synthesizes a structured Shift Handover Brief deterministically from operational signals,
 * optionally enriching the narrative via an async LLM enhancer with zero-LLM fallback.
 */
export async function synthesizeShiftHandoverBrief(
  options: SynthesizeShiftHandoverOptions
): Promise<ShiftHandoverBrief> {
  const reconciliationStatus = classifyDrift(options.reconciliationDriftPct);
  const highRiskPredictions = options.predictions.filter(
    (prediction) => prediction.riskLevel === 'HIGH' || prediction.riskLevel === 'CRITICAL'
  );
  const criticalAnomalies = options.anomalies.filter(
    (anomaly) => anomaly.severity === 'CRITICAL' || anomaly.severity === 'SENSOR_FAULT'
  );

  const topDelayCategories = [...options.delays]
    .sort((left, right) => right.totalMinutes - left.totalMinutes)
    .slice(0, TOP_DELAY_LIMIT);

  const priorityActions = buildPriorityActions({
    completenessPct: options.completenessPct,
    reconciliationStatus,
    highRiskPredictions,
    criticalAnomalies,
    topDelays: topDelayCategories,
  });

  const deterministicNarrative = [
    `Shift ${options.shiftDate} (${options.shiftType.toUpperCase()}) closed at ${options.completenessPct.toFixed(0)}% completeness.`,
    `Reconciliation drift is ${options.reconciliationDriftPct.toFixed(1)}% (${reconciliationStatus}).`,
    `${highRiskPredictions.length} high/critical risk machine(s) and ${options.anomalies.length} telemetry anomaly alert(s) detected.`,
    `Top priority: ${priorityActions[0] ?? 'None'}`,
  ].join(' ');

  const baseBrief: ShiftHandoverBrief = {
    shiftDate: options.shiftDate,
    shiftType: options.shiftType,
    completenessPct: Number(options.completenessPct.toFixed(1)),
    reconciliationDriftPct: Number(options.reconciliationDriftPct.toFixed(2)),
    reconciliationStatus,
    highRiskMachineCount: highRiskPredictions.length,
    activeAnomalyCount: options.anomalies.length,
    topDelayCategories,
    priorityActions,
    narrativeSummary: deterministicNarrative,
    synthesisMode: 'deterministic_fallback',
  };

  if (!options.narrativeEnhancer) {
    return baseBrief;
  }

  try {
    const enhancedNarrative = await options.narrativeEnhancer(baseBrief);
    if (enhancedNarrative && enhancedNarrative.trim().length > 0) {
      return {
        ...baseBrief,
        narrativeSummary: enhancedNarrative.trim(),
        synthesisMode: 'llm',
      };
    }
  } catch {
    // Deterministic brief remains intact when LLM enhancement fails.
  }

  return baseBrief;
}
