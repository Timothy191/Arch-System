export type AlertRuleState = 'NORMAL' | 'PENDING' | 'FIRING' | 'RESOLVED';

export interface AlertRuleDefinition {
  readonly ruleId: string;
  readonly label: string;
  readonly threshold: number;
  readonly recoveryThreshold?: number;
  readonly forDurationMs: number;
  readonly comparison?: 'gt' | 'lt';
}

export interface AlertEvaluationInput {
  readonly rule: AlertRuleDefinition;
  readonly sampleValue: number;
  readonly evaluatedAtMs?: number;
}

export interface AlertEvaluationResult {
  readonly ruleId: string;
  readonly label: string;
  readonly state: AlertRuleState;
  readonly sampleValue: number;
  readonly threshold: number;
  readonly breachStartedAtMs: number | null;
  readonly elapsedBreachMs: number;
}

export const MAX_ALERT_RULE_ENTRIES = 128;

const alertEvaluationsByRuleId = new Map<string, AlertEvaluationResult>();

function isSampleBreaching(
  input: AlertEvaluationInput,
  previousState: AlertRuleState | undefined
): boolean {
  const comparison = input.rule.comparison ?? 'gt';
  const activeThreshold =
    previousState === 'FIRING'
      ? (input.rule.recoveryThreshold ?? input.rule.threshold)
      : input.rule.threshold;

  if (comparison === 'lt') {
    return input.sampleValue < activeThreshold;
  }
  return input.sampleValue > activeThreshold;
}

function storeBoundedAlertEvaluation(evaluation: AlertEvaluationResult): AlertEvaluationResult {
  if (
    !alertEvaluationsByRuleId.has(evaluation.ruleId) &&
    alertEvaluationsByRuleId.size >= MAX_ALERT_RULE_ENTRIES
  ) {
    const oldestRuleId = alertEvaluationsByRuleId.keys().next().value;
    if (oldestRuleId) {
      alertEvaluationsByRuleId.delete(oldestRuleId);
    }
  }
  alertEvaluationsByRuleId.set(evaluation.ruleId, evaluation);
  return evaluation;
}

export function evaluateAlertRule(input: AlertEvaluationInput): AlertEvaluationResult {
  const evaluatedAtMs = input.evaluatedAtMs ?? Date.now();
  const previous = alertEvaluationsByRuleId.get(input.rule.ruleId);
  const hasBreach = isSampleBreaching(input, previous?.state);

  if (!hasBreach) {
    const nextState: AlertRuleState = previous?.state === 'FIRING' ? 'RESOLVED' : 'NORMAL';
    return storeBoundedAlertEvaluation({
      ruleId: input.rule.ruleId,
      label: input.rule.label,
      state: nextState,
      sampleValue: input.sampleValue,
      threshold: input.rule.threshold,
      breachStartedAtMs: null,
      elapsedBreachMs: 0,
    });
  }

  const breachStartedAtMs = previous?.breachStartedAtMs ?? evaluatedAtMs;
  const elapsedBreachMs = Math.max(0, evaluatedAtMs - breachStartedAtMs);
  const nextState: AlertRuleState =
    elapsedBreachMs >= input.rule.forDurationMs ? 'FIRING' : 'PENDING';

  return storeBoundedAlertEvaluation({
    ruleId: input.rule.ruleId,
    label: input.rule.label,
    state: nextState,
    sampleValue: input.sampleValue,
    threshold: input.rule.threshold,
    breachStartedAtMs,
    elapsedBreachMs,
  });
}

export function getActiveAlertEvaluations(): readonly AlertEvaluationResult[] {
  return Array.from(alertEvaluationsByRuleId.values());
}

export function resetAlertEvaluatorState(ruleId?: string): void {
  if (ruleId) {
    alertEvaluationsByRuleId.delete(ruleId);
    return;
  }
  alertEvaluationsByRuleId.clear();
}
