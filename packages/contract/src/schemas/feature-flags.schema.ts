import { z } from 'zod';
import { nonEmptyString } from './common.schema';

export const featureFlagRuleOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'in',
  'not_in',
  'percent_rollout',
]);
export type FeatureFlagRuleOperator = z.infer<typeof featureFlagRuleOperatorSchema>;

export const featureFlagValueSchema = z.union([
  z.boolean(),
  z.string(),
  z.number(),
  z.record(z.string(), z.unknown()),
]);
export type FeatureFlagValue = z.infer<typeof featureFlagValueSchema>;

export const featureFlagTargetingRuleSchema = z.object({
  id: nonEmptyString.max(80),
  description: z.string().max(300).optional(),
  attribute: z.enum(['departmentId', 'siteId', 'role', 'employeeId', 'shiftType']),
  operator: featureFlagRuleOperatorSchema,
  matchValues: z.array(z.string().min(1)).optional(),
  coveragePercent: z.number().min(0).max(100).optional(),
  variationValue: featureFlagValueSchema,
  seed: z.string().min(1).max(80).optional(),
});
export type FeatureFlagTargetingRule = z.infer<typeof featureFlagTargetingRuleSchema>;

export const featureFlagDefinitionSchema = z.object({
  key: nonEmptyString.max(100),
  defaultValue: featureFlagValueSchema,
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().default(true),
  rules: z.array(featureFlagTargetingRuleSchema).default([]),
});
export type FeatureFlagDefinition = z.infer<typeof featureFlagDefinitionSchema>;

export const evaluationContextSchema = z.object({
  employeeId: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  siteId: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  shiftType: z.enum(['day', 'night', 'swing']).optional(),
});
export type EvaluationContext = z.infer<typeof evaluationContextSchema>;

export const featureEvaluationSourceSchema = z.enum([
  'defaultValue',
  'disabledFlag',
  'ruleMatch',
  'rolloutAssigned',
  'rolloutExcluded',
]);
export type FeatureEvaluationSource = z.infer<typeof featureEvaluationSourceSchema>;

export const featureEvaluationResultSchema = z.object({
  featureKey: nonEmptyString.max(100),
  resolvedValue: featureFlagValueSchema,
  source: featureEvaluationSourceSchema,
  matchedRuleId: z.string().optional(),
  bucketPercent: z.number().min(0).max(100).optional(),
});
export type FeatureEvaluationResult = z.infer<typeof featureEvaluationResultSchema>;
