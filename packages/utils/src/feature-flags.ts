import { createHash } from 'node:crypto';

const HASH_ALGORITHM = 'sha256';
const HEX_SLICE_END = 8;
const HEX_RADIX = 16;
const MAX_UINT32_PLUS_ONE = 0x100000000;
const PERCENT_SCALE = 100;
const PERCENT_DECIMALS = 100;
const FULL_COVERAGE_PERCENT = 100;
const ZERO_COVERAGE_PERCENT = 0;

export type FeatureVariationValue = boolean | string | number | Readonly<Record<string, unknown>>;

export type TargetingAttributeKey = 'departmentId' | 'siteId' | 'role' | 'employeeId' | 'shiftType';

export type TargetingRuleOperator = 'equals' | 'not_equals' | 'in' | 'not_in' | 'percent_rollout';

export interface FeatureTargetingRule<T extends FeatureVariationValue = FeatureVariationValue> {
  readonly id: string;
  readonly description?: string;
  readonly attribute: TargetingAttributeKey;
  readonly operator: TargetingRuleOperator;
  readonly matchValues?: readonly string[];
  readonly coveragePercent?: number;
  readonly variationValue: T;
  readonly seed?: string;
}

export interface FeatureFlagConfig<T extends FeatureVariationValue = FeatureVariationValue> {
  readonly key: string;
  readonly defaultValue: T;
  readonly description?: string;
  readonly isEnabled?: boolean;
  readonly rules?: readonly FeatureTargetingRule<T>[];
}

export interface FeatureEvaluationContext {
  readonly employeeId: string;
  readonly departmentId?: string;
  readonly siteId?: string;
  readonly role?: string;
  readonly shiftType?: 'day' | 'night' | 'swing';
}

export type FeatureResolutionSource =
  | 'defaultValue'
  | 'disabledFlag'
  | 'ruleMatch'
  | 'rolloutAssigned'
  | 'rolloutExcluded';

export interface FeatureResolution<T extends FeatureVariationValue = FeatureVariationValue> {
  readonly featureKey: string;
  readonly resolvedValue: T;
  readonly source: FeatureResolutionSource;
  readonly matchedRuleId?: string;
  readonly bucketPercent?: number;
}

export interface ComputeRolloutBucketOptions {
  readonly subjectKey: string;
  readonly seed: string;
}

/**
 * Computes a deterministic rollout bucket in [0, 100) using SHA-256 hashing.
 * Ensures sticky cohort assignment across sessions and Pit tablets without network calls.
 */
export function computeDeterministicBucketPercent(
  options: Readonly<ComputeRolloutBucketOptions>
): number {
  const digestHex = createHash(HASH_ALGORITHM)
    .update(`${options.seed}:${options.subjectKey}`, 'utf8')
    .digest('hex')
    .slice(0, HEX_SLICE_END);

  const uint32Number = Number.parseInt(digestHex, HEX_RADIX);
  const rawPercent = (uint32Number / MAX_UINT32_PLUS_ONE) * PERCENT_SCALE;
  return Math.floor(rawPercent * PERCENT_DECIMALS) / PERCENT_DECIMALS;
}

function resolveAttributeString(
  context: Readonly<FeatureEvaluationContext>,
  attribute: TargetingAttributeKey
): string | undefined {
  const attributeMap: Record<TargetingAttributeKey, string | undefined> = {
    departmentId: context.departmentId,
    siteId: context.siteId,
    role: context.role,
    employeeId: context.employeeId,
    shiftType: context.shiftType,
  };
  return attributeMap[attribute];
}

function matchesDeterministicListRule(
  candidate: string | undefined,
  rule: Readonly<FeatureTargetingRule>
): boolean {
  if (!candidate) {
    return false;
  }
  const matchSet = rule.matchValues ?? [];
  const operatorHandlers: Record<
    Exclude<TargetingRuleOperator, 'percent_rollout'>,
    () => boolean
  > = {
    equals: () => matchSet[0] === candidate,
    not_equals: () => matchSet[0] !== undefined && matchSet[0] !== candidate,
    in: () => matchSet.includes(candidate),
    not_in: () => matchSet.length > 0 && !matchSet.includes(candidate),
  };

  if (rule.operator === 'percent_rollout') {
    return false;
  }
  return operatorHandlers[rule.operator]();
}

/**
 * Evaluates a GrowthBook-style feature flag definition against an operator/department context.
 * Pure, synchronous, and zero-dependency for deterministic RSC and client evaluation.
 */
export function evaluateFeatureFlag<T extends FeatureVariationValue>(
  flag: Readonly<FeatureFlagConfig<T>>,
  context: Readonly<FeatureEvaluationContext>
): FeatureResolution<T> {
  if (flag.isEnabled === false) {
    return {
      featureKey: flag.key,
      resolvedValue: flag.defaultValue,
      source: 'disabledFlag',
    };
  }

  const rules = flag.rules ?? [];
  for (const rule of rules) {
    const attributeString = resolveAttributeString(context, rule.attribute);

    if (rule.operator === 'percent_rollout') {
      if (!attributeString) {
        continue;
      }
      const coverage = Math.min(
        FULL_COVERAGE_PERCENT,
        Math.max(ZERO_COVERAGE_PERCENT, rule.coveragePercent ?? ZERO_COVERAGE_PERCENT)
      );
      const bucketPercent = computeDeterministicBucketPercent({
        subjectKey: attributeString,
        seed: rule.seed ?? flag.key,
      });

      if (bucketPercent < coverage) {
        return {
          featureKey: flag.key,
          resolvedValue: rule.variationValue,
          source: 'rolloutAssigned',
          matchedRuleId: rule.id,
          bucketPercent,
        };
      }
      continue;
    }

    if (matchesDeterministicListRule(attributeString, rule)) {
      return {
        featureKey: flag.key,
        resolvedValue: rule.variationValue,
        source: 'ruleMatch',
        matchedRuleId: rule.id,
      };
    }
  }

  return {
    featureKey: flag.key,
    resolvedValue: flag.defaultValue,
    source: 'defaultValue',
  };
}
