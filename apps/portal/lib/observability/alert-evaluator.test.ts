import {
  type AlertRuleDefinition,
  evaluateAlertRule,
  getActiveAlertEvaluations,
  resetAlertEvaluatorState,
} from './alert-evaluator';

const BASE_TIME_MS = 1_700_000_000_000;
const HALF_HOLD_MS = 15_000;
const FULL_HOLD_MS = 30_000;
const AFTER_RECOVERY_MS = 45_000;
const FINAL_NORMAL_MS = 60_000;

const LATENCY_THRESHOLD_MS = 200;
const LATENCY_RECOVERY_MS = 150;
const NORMAL_LATENCY_MS = 80;
const BREACHING_LATENCY_MS = 260;
const HYSTERESIS_BAND_LATENCY_MS = 175;
const RECOVERED_LATENCY_MS = 120;

const HIT_RATE_THRESHOLD_PCT = 85;
const LOW_HIT_RATE_PCT = 70;
const HEALTHY_HIT_RATE_PCT = 96;

const REDIS_LATENCY_RULE: AlertRuleDefinition = {
  ruleId: 'redis_p95_latency',
  label: 'Redis p95 Latency',
  threshold: LATENCY_THRESHOLD_MS,
  recoveryThreshold: LATENCY_RECOVERY_MS,
  forDurationMs: FULL_HOLD_MS,
  comparison: 'gt',
};

const CACHE_HIT_RATE_RULE: AlertRuleDefinition = {
  ruleId: 'redis_hit_rate_low',
  label: 'Redis Hit Rate Floor',
  threshold: HIT_RATE_THRESHOLD_PCT,
  forDurationMs: 0,
  comparison: 'lt',
};

describe('Given the Grafana-style stateful Alert Rule Evaluator', () => {
  beforeEach(() => {
    resetAlertEvaluatorState();
  });

  it('When a metric transitions through breach, hold window, hysteresis, and recovery, Then state follows NORMAL -> PENDING -> FIRING -> RESOLVED -> NORMAL', () => {
    const stepNormal = evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: NORMAL_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS,
    });
    expect(stepNormal.state).toBe('NORMAL');
    expect(stepNormal.breachStartedAtMs).toBeNull();
    expect(stepNormal.elapsedBreachMs).toBe(0);

    const stepFirstBreach = evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: BREACHING_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS,
    });
    expect(stepFirstBreach.state).toBe('PENDING');
    expect(stepFirstBreach.breachStartedAtMs).toBe(BASE_TIME_MS);
    expect(stepFirstBreach.elapsedBreachMs).toBe(0);

    const stepMidHold = evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: BREACHING_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS + HALF_HOLD_MS,
    });
    expect(stepMidHold.state).toBe('PENDING');
    expect(stepMidHold.elapsedBreachMs).toBe(HALF_HOLD_MS);

    const stepFiring = evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: BREACHING_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS + FULL_HOLD_MS,
    });
    expect(stepFiring.state).toBe('FIRING');
    expect(stepFiring.elapsedBreachMs).toBe(FULL_HOLD_MS);

    const stepHysteresisHold = evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: HYSTERESIS_BAND_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS + FULL_HOLD_MS + HALF_HOLD_MS,
    });
    expect(stepHysteresisHold.state).toBe('FIRING');

    const stepResolved = evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: RECOVERED_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS + AFTER_RECOVERY_MS,
    });
    expect(stepResolved.state).toBe('RESOLVED');
    expect(stepResolved.breachStartedAtMs).toBeNull();
    expect(stepResolved.elapsedBreachMs).toBe(0);

    const stepBackToNormal = evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: NORMAL_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS + FINAL_NORMAL_MS,
    });
    expect(stepBackToNormal.state).toBe('NORMAL');
  });

  it('When a PENDING alert recovers before forDurationMs elapses, Then it returns directly to NORMAL without FIRING', () => {
    evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: BREACHING_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS,
    });

    const recovered = evaluateAlertRule({
      rule: REDIS_LATENCY_RULE,
      sampleValue: NORMAL_LATENCY_MS,
      evaluatedAtMs: BASE_TIME_MS + HALF_HOLD_MS,
    });
    expect(recovered.state).toBe('NORMAL');
    expect(recovered.breachStartedAtMs).toBeNull();
  });

  it('When comparison is lt and forDurationMs is 0, Then breaching immediately transitions to FIRING', () => {
    const firingResult = evaluateAlertRule({
      rule: CACHE_HIT_RATE_RULE,
      sampleValue: LOW_HIT_RATE_PCT,
      evaluatedAtMs: BASE_TIME_MS,
    });
    expect(firingResult.state).toBe('FIRING');

    const resolvedResult = evaluateAlertRule({
      rule: CACHE_HIT_RATE_RULE,
      sampleValue: HEALTHY_HIT_RATE_PCT,
      evaluatedAtMs: BASE_TIME_MS + HALF_HOLD_MS,
    });
    expect(resolvedResult.state).toBe('RESOLVED');

    expect(getActiveAlertEvaluations()).toHaveLength(1);
    resetAlertEvaluatorState(CACHE_HIT_RATE_RULE.ruleId);
    expect(getActiveAlertEvaluations()).toHaveLength(0);
  });
});
