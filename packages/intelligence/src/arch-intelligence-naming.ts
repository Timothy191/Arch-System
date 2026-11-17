/**
 * Arch Intelligence — Branding and naming schema for the operational mining intelligence engine suite.
 *
 * This module provides the canonical naming, branding, and type definitions
 * that identify this intelligence stack as "Arch Intelligence" within the
 * Arch-System monorepo. All engine types, schema inferences, and exported
 * types ultimately resolve under this branding.
 *
 * Naming conventions enforced:
 * - Engine names: PascalCase (e.g. TelemetryAnomalyEngine)
 * - Schema suffixes: Schema (e.g. TelemetryAnomalyAlertSchema)
 * - Type prefixes: PascalCase matching engine names
 * - Package identity: @repo/intelligence → Arch Intelligence
 */
export interface ArchIntelligenceBranding {
  readonly name: 'Arch Intelligence';
  readonly version: '1.0.0';
  readonly description: string;
  readonly engines: {
    readonly telemetryAnomaly: string;
    readonly predictiveMaintenance: string;
    readonly productionForecast: string;
    readonly shiftIntelligence: string;
    readonly operationsCopilot: string;
  };
  readonly package: {
    readonly name: '@repo/intelligence';
    readonly repository: string;
    readonly documentation: string;
  };
}

export const archIntelligenceBrandingSchema: ArchIntelligenceBranding = {
  name: 'Arch Intelligence',
  version: '1.0.0',
  description:
    'Operational mining intelligence engines: telemetry anomaly detection, predictive maintenance FMEA, production forecasting, shift handover synthesis, and grounded operations copilot',
  engines: {
    telemetryAnomaly: 'TelemetryAnomalyEngine',
    predictiveMaintenance: 'PredictiveMaintenanceEngine',
    productionForecast: 'ProductionForecastEngine',
    shiftIntelligence: 'ShiftIntelligenceEngine',
    operationsCopilot: 'OperationsCopilotEngine',
  },
  package: {
    name: '@repo/intelligence',
    repository: 'Arch-System',
    documentation: 'packages/intelligence/README.md',
  },
};

/**
 * Maps each intelligence engine to its canonical exported type name
 * as recognized by the Arch Intelligence branding.
 */
export const archIntelligenceEngineExports = {
  telemetryAnomaly: 'TelemetryAnomalyEngine',
  predictiveMaintenance: 'PredictiveMaintenanceEngine',
  productionForecast: 'ProductionForecastEngine',
  shiftIntelligence: 'ShiftIntelligenceEngine',
  operationsCopilot: 'OperationsCopilotEngine',
} as const;

/**
 * Union type of all Arch Intelligence engine types, useful for
 * discriminated-union patterns across the entire suite.
 */
export type ArchIntelligenceEngine =
  | 'TelemetryAnomalyEngine'
  | 'PredictiveMaintenanceEngine'
  | 'ProductionForecastEngine'
  | 'ShiftIntelligenceEngine'
  | 'OperationsCopilotEngine';

/**
 * Registry of all Arch Intelligence engine types for iteration,
 * validation, and runtime dispatch.
 */
export const archIntelligenceEngineRegistry: ReadonlyArray<ArchIntelligenceEngine> = [
  'TelemetryAnomalyEngine',
  'PredictiveMaintenanceEngine',
  'ProductionForecastEngine',
  'ShiftIntelligenceEngine',
  'OperationsCopilotEngine',
];

/**
 * Returns true if the provided string is a recognized Arch Intelligence engine type.
 */
export function isArchIntelligenceEngine(
  possiblyEngine: string
): possiblyEngine is ArchIntelligenceEngine {
  return archIntelligenceEngineRegistry.includes(possiblyEngine as ArchIntelligenceEngine);
}

/**
 * Returns the human-readable display name for an Arch Intelligence engine.
 */
export function getArchIntelligenceEngineDisplayName(engine: ArchIntelligenceEngine): string {
  const names: Record<ArchIntelligenceEngine, string> = {
    TelemetryAnomalyEngine: 'Telemetry Anomaly Engine',
    PredictiveMaintenanceEngine: 'Predictive Maintenance Engine',
    ProductionForecastEngine: 'Production Forecast Engine',
    ShiftIntelligenceEngine: 'Shift Intelligence Engine',
    OperationsCopilotEngine: 'Operations Copilot Engine',
  };
  return names[engine];
}
