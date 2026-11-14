/* cspell:words ewma flatline */
import { z } from 'zod';

export const anomalySeveritySchema = z.enum(['NORMAL', 'WARNING', 'CRITICAL', 'SENSOR_FAULT']);
export type AnomalySeverity = z.infer<typeof anomalySeveritySchema>;

export const telemetryMetricNameSchema = z.enum([
  'engine_temp',
  'hydraulic_pressure',
  'vibration_level',
  'engine_rpm',
  'fuel_level',
  'tonnage_drift_pct',
]);
export type TelemetryMetricName = z.infer<typeof telemetryMetricNameSchema>;

export const telemetryAnomalyAlertSchema = z.object({
  machineId: z.string().min(1),
  metric: telemetryMetricNameSchema,
  severity: anomalySeveritySchema,
  latestValue: z.number(),
  baselineMedian: z.number(),
  modifiedZScore: z.number(),
  ewmaValue: z.number(),
  isFlatline: z.boolean(),
  reason: z.string().min(1),
  detectedAt: z.string(),
});
export type TelemetryAnomalyAlert = z.infer<typeof telemetryAnomalyAlertSchema>;

export const maintenanceRiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type MaintenanceRiskLevel = z.infer<typeof maintenanceRiskLevelSchema>;

export const failureModeCategorySchema = z.enum([
  'HYDRAULIC',
  'THERMAL',
  'DRIVETRAIN',
  'STRUCTURAL',
  'PM_OVERDUE',
  'RECURRING_GENERAL',
]);
export type FailureModeCategory = z.infer<typeof failureModeCategorySchema>;

export const predictiveMaintenancePredictionSchema = z.object({
  machineId: z.string().min(1),
  machineName: z.string().min(1),
  machineType: z.string().min(1),
  riskLevel: maintenanceRiskLevelSchema,
  riskScore: z.number().min(0).max(100),
  fmeaRpn: z.number().int().min(1).max(1000),
  failureMode: failureModeCategorySchema,
  confidence: z.number().min(0).max(1),
  estimatedHoursToFailure: z.number().nonnegative(),
  breakdownCount30d: z.number().int().nonnegative(),
  smuHoursRemaining: z.number().nullable(),
  reason: z.string().min(1),
  recommendedAction: z.string().min(1),
});
export type PredictiveMaintenancePrediction = z.infer<typeof predictiveMaintenancePredictionSchema>;

export const forecastPointSchema = z.object({
  periodIndex: z.number().int().positive(),
  pointForecast: z.number(),
  lowerBound95: z.number(),
  upperBound95: z.number(),
});
export type ForecastPoint = z.infer<typeof forecastPointSchema>;

export const productionForecastResultSchema = z.object({
  method: z.enum(['holts_damped', 'fallback_constant']),
  capacityFactor: z.number().min(0).max(1),
  points: z.array(forecastPointSchema),
});
export type ProductionForecastResult = z.infer<typeof productionForecastResultSchema>;

export const shiftHandoverBriefSchema = z.object({
  shiftDate: z.string().min(1),
  shiftType: z.enum(['day', 'night']),
  completenessPct: z.number().min(0).max(100),
  reconciliationDriftPct: z.number(),
  reconciliationStatus: z.enum(['stable', 'minor', 'moderate', 'critical']),
  highRiskMachineCount: z.number().int().nonnegative(),
  activeAnomalyCount: z.number().int().nonnegative(),
  topDelayCategories: z.array(
    z.object({
      category: z.string(),
      totalMinutes: z.number().nonnegative(),
    })
  ),
  priorityActions: z.array(z.string()),
  narrativeSummary: z.string().min(1),
  synthesisMode: z.enum(['llm', 'deterministic_fallback']),
});
export type ShiftHandoverBrief = z.infer<typeof shiftHandoverBriefSchema>;

export const groundedCopilotResponseSchema = z.object({
  answer: z.string().min(1),
  observedFacts: z.array(z.string()),
  recommendations: z.array(z.string()),
  citations: z.array(
    z.object({
      source: z.enum(['breakdown_rag', 'shift_note_rag', 'fleet_health', 'telemetry_anomaly']),
      referenceId: z.string(),
      summary: z.string(),
    })
  ),
  provider: z.enum(['groq', 'openrouter', 'deterministic_fallback']),
  model: z.string(),
  fallbackUsed: z.boolean(),
});
export type GroundedCopilotResponse = z.infer<typeof groundedCopilotResponseSchema>;
