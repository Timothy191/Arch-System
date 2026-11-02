import {
  computeDeterministicBucketPercent,
  evaluateFeatureFlag,
  type FeatureFlagConfig,
} from './feature-flags';

describe('computeDeterministicBucketPercent', () => {
  it('When given identical subjectKey and seed, Then returns deterministic percentage in [0, 100)', () => {
    const firstBucket = computeDeterministicBucketPercent({
      subjectKey: 'emp_0042',
      seed: 'scada_telemetry_v2',
    });
    const secondBucket = computeDeterministicBucketPercent({
      subjectKey: 'emp_0042',
      seed: 'scada_telemetry_v2',
    });

    expect(firstBucket).toBe(secondBucket);
    expect(firstBucket).toBeGreaterThanOrEqual(0);
    expect(firstBucket).toBeLessThan(100);
  });

  it('When given different seeds, Then distributes subjects into distinct buckets', () => {
    const bucketA = computeDeterministicBucketPercent({
      subjectKey: 'emp_0042',
      seed: 'seed_alpha',
    });
    const bucketB = computeDeterministicBucketPercent({
      subjectKey: 'emp_0042',
      seed: 'seed_bravo',
    });

    expect(bucketA).not.toBe(bucketB);
  });
});

describe('evaluateFeatureFlag', () => {
  const sampleFlag: FeatureFlagConfig<boolean> = {
    key: 'monotonic_smr_strict_clamp',
    defaultValue: false,
    isEnabled: true,
    rules: [
      {
        id: 'rule_control_room_override',
        attribute: 'departmentId',
        operator: 'in',
        matchValues: ['control_room', 'engineering'],
        variationValue: true,
      },
      {
        id: 'rule_site_exclude',
        attribute: 'siteId',
        operator: 'equals',
        matchValues: ['BREDELL'],
        variationValue: false,
      },
      {
        id: 'rule_rollout_50',
        attribute: 'employeeId',
        operator: 'percent_rollout',
        coveragePercent: 100,
        variationValue: true,
      },
    ],
  };

  it('When flag is disabled, Then returns defaultValue with disabledFlag source', () => {
    const result = evaluateFeatureFlag(
      { ...sampleFlag, isEnabled: false },
      { employeeId: 'emp_1', departmentId: 'control_room' }
    );

    expect(result.resolvedValue).toBe(false);
    expect(result.source).toBe('disabledFlag');
  });

  it('When department matches targeting rule, Then returns ruleMatch variation', () => {
    const result = evaluateFeatureFlag(sampleFlag, {
      employeeId: 'emp_1',
      departmentId: 'control_room',
    });

    expect(result.resolvedValue).toBe(true);
    expect(result.source).toBe('ruleMatch');
    expect(result.matchedRuleId).toBe('rule_control_room_override');
  });

  it('When rollout rule has 100% coverage, Then assigns variation via rolloutAssigned', () => {
    const result = evaluateFeatureFlag(sampleFlag, {
      employeeId: 'emp_999',
      departmentId: 'drilling',
      siteId: 'BKF',
    });

    expect(result.resolvedValue).toBe(true);
    expect(result.source).toBe('rolloutAssigned');
    expect(result.matchedRuleId).toBe('rule_rollout_50');
    expect(typeof result.bucketPercent).toBe('number');
  });

  it('When no rules match and rollout is 0%, Then falls back to defaultValue', () => {
    const zeroRolloutFlag: FeatureFlagConfig<string> = {
      key: 'banner_variant',
      defaultValue: 'classic',
      rules: [
        {
          id: 'rule_zero',
          attribute: 'employeeId',
          operator: 'percent_rollout',
          coveragePercent: 0,
          variationValue: 'experimental',
        },
      ],
    };

    const result = evaluateFeatureFlag(zeroRolloutFlag, {
      employeeId: 'emp_999',
    });

    expect(result.resolvedValue).toBe('classic');
    expect(result.source).toBe('defaultValue');
  });
});
