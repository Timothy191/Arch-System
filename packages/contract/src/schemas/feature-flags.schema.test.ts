import {
  evaluationContextSchema,
  featureEvaluationResultSchema,
  featureFlagDefinitionSchema,
  featureFlagTargetingRuleSchema,
} from './feature-flags.schema';

describe('featureFlagTargetingRuleSchema', () => {
  it('validates a department targeting rule', () => {
    const rule = {
      id: 'rule_control_room_beta',
      description: 'Enable predictive SMR diagnostics for Control Room',
      attribute: 'departmentId',
      operator: 'in',
      matchValues: ['control_room', 'engineering'],
      variationValue: true,
    };

    const parsed = featureFlagTargetingRuleSchema.safeParse(rule);
    expect(parsed.success).toBe(true);
  });

  it('validates a percentage rollout targeting rule', () => {
    const rule = {
      id: 'rule_gradual_rollout_25',
      attribute: 'employeeId',
      operator: 'percent_rollout',
      coveragePercent: 25,
      variationValue: 'v2-telemetry-hud',
      seed: 'exp_hud_2026_q4',
    };

    const parsed = featureFlagTargetingRuleSchema.safeParse(rule);
    expect(parsed.success).toBe(true);
  });

  it('rejects coveragePercent above 100', () => {
    const invalidRule = {
      id: 'rule_invalid',
      attribute: 'employeeId',
      operator: 'percent_rollout',
      coveragePercent: 150,
      variationValue: true,
    };

    const parsed = featureFlagTargetingRuleSchema.safeParse(invalidRule);
    expect(parsed.success).toBe(false);
  });
});

describe('featureFlagDefinitionSchema', () => {
  it('validates a complete feature flag definition with defaults', () => {
    const flag = {
      key: 'scada_fast_reconnect_jitter',
      defaultValue: false,
      description: 'Enables deterministic jitter backoff on OPC-UA bridge',
      rules: [
        {
          id: 'rule_cr',
          attribute: 'departmentId',
          operator: 'equals',
          matchValues: ['control_room'],
          variationValue: true,
        },
      ],
    };

    const parsed = featureFlagDefinitionSchema.safeParse(flag);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isEnabled).toBe(true);
      expect(parsed.data.rules).toHaveLength(1);
    }
  });
});

describe('evaluationContextSchema & featureEvaluationResultSchema', () => {
  it('validates an operator evaluation context and result', () => {
    const context = {
      employeeId: 'emp_0094',
      departmentId: 'control_room',
      siteId: 'BKF',
      role: 'supervisor',
      shiftType: 'day',
    };

    const result = {
      featureKey: 'scada_fast_reconnect_jitter',
      resolvedValue: true,
      source: 'ruleMatch',
      matchedRuleId: 'rule_cr',
      bucketPercent: 42.15,
    };

    expect(evaluationContextSchema.safeParse(context).success).toBe(true);
    expect(featureEvaluationResultSchema.safeParse(result).success).toBe(true);
  });
});
