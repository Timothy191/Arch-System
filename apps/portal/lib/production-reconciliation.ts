/**
 * Production Reconciliation API
 * Handles calculations and thresholds for Actual (Yield) vs Expected (Extraction) tonnage.
 */

type ReconciliationLevel = "stable" | "minor" | "moderate" | "critical";

/**
 * Reconciliation Drift Thresholds (%)
 * Based on industrial auditing standards for open-cast mining.
 */
const RECONCILIATION_THRESHOLDS = {
  minor: 5, // 5% variance - Warning
  moderate: 10, // 10% variance - Action Required
  critical: 15, // 15% variance - Audit Trigger
};

/**
 * Classify the severity of reconciliation drift.
 * @param driftPct The absolute difference percentage between actual and expected tonnage.
 */
export function classifyReconciliationDrift(
  driftPct: number,
): ReconciliationLevel {
  const abs = Math.abs(driftPct);
  if (abs >= RECONCILIATION_THRESHOLDS.critical) return "critical";
  if (abs >= RECONCILIATION_THRESHOLDS.moderate) return "moderate";
  if (abs >= RECONCILIATION_THRESHOLDS.minor) return "minor";
  return "stable";
}

/**
 * UI Metadata for reconciliation levels.
 */
export const RECONCILIATION_UI = {
  stable: {
    color: "emerald",
    label: "Optimal",
    description: "Yield is within ±5% of extraction estimates.",
  },
  minor: {
    color: "amber",
    label: "Warning",
    description: "Minor variance detected. Verify bucket factor calibration.",
  },
  moderate: {
    color: "orange",
    label: "Action Required",
    description: "Significant drift. Supervisor verification required.",
  },
  critical: {
    color: "red",
    label: "Critical Variance",
    description: "Severe data misalignment. Automatic audit log triggered.",
  },
};
