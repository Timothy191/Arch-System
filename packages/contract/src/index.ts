/**
 * @repo/contract — Canonical Zod schemas and derived types for the Arch-System monorepo.
 *
 * This package is the single source of truth for all cross-boundary data contracts.
 * No other workspace should define Zod schemas for shared entities; import from here.
 */

// ---------------------------------------------------------------------------
// Re-exported Zod types (so consumers don't import "zod" directly)
// ---------------------------------------------------------------------------

export { z } from "zod";
export type { ZodSchema, ZodError } from "zod";

// ---------------------------------------------------------------------------
// Validation middleware (runtime)
// ---------------------------------------------------------------------------

export { ValidationError } from "./validation.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export {
  uuidSchema,
  dateSchema,
  dateMonthSchema,
  nonEmptyString,
} from "./schemas/common.schema.js";

export { createWebhookSchema, updateWebhookSchema } from "./schemas/webhook.schema.js";

export { exportQuerySchema, safetyExportQuerySchema } from "./schemas/export.schema.js";

export { scannerBadgeSchema } from "./schemas/scanner.schema.js";

export { telemetryPushSchema } from "./schemas/telemetry.schema.js";

export { syncPlaybackSchema } from "./schemas/sync.schema.js";

export {
  shiftCompletenessSchema,
  controlRoomChecklistItemSchema,
  controlRoomChecklistSchema,
  controlRoomShiftReportSchema,
} from "./schemas/control-room.schema.js";

export {
  aiChatSchema,
  aiSafetySchema,
  aiPredictSchema,
  aiHandoffSchema,
  riskAssessmentSchema,
  complianceResultSchema,
} from "./schemas/ai.schema.js";

export {
  adminDataQuerySchema,
  adminDataUpdateSchema,
  adminDataDeleteSchema,
  adminAddSiteSchema,
  adminUpdateSiteSchema,
} from "./schemas/admin.schema.js";

export {
  dailyLogSchema,
  drillingDailyLogSchema,
  productionDailyLogSchema,
  dozerRollSchema,
  createBreakdownSchema,
  bookOutSchema,
  directCheckoutSchema,
  monthlyReportInputSchema,
  updateMachineSiteSchema,
} from "./schemas/form.schema.js";

export { EmployeeProfileUpdateSchema, PrintRequestSchema } from "./schemas/access-card.schema.js";

export {
  tireStatusSchema,
  tireConditionSchema,
  tirePositionSchema,
  tireSchema,
  tireInspectionSchema,
  createTireSchema,
  logTireInspectionSchema,
  replaceTireSchema,
} from "./schemas/tire-management.schema.js";

// ---------------------------------------------------------------------------
// Derived types (inferred from schemas)
// ---------------------------------------------------------------------------

export type { Uuid, DateString, DateMonthString, NonEmptyString } from "./types/common.types.js";

export type { CreateWebhookInput, UpdateWebhookInput } from "./types/webhook.types.js";

export type { ExportQueryInput, SafetyExportQueryInput } from "./types/export.types.js";

export type { ScannerBadgeInput } from "./types/scanner.types.js";

export type { TelemetryPushInput } from "./types/telemetry.types.js";

export type { SyncPlaybackInput } from "./types/sync.types.js";

export type {
  ShiftCompletenessInput,
  ControlRoomChecklistItem,
  ControlRoomChecklistInput,
  ControlRoomShiftReportInput,
} from "./types/control-room.types.js";

export type {
  AiChatInput,
  AiSafetyInput,
  AiPredictInput,
  AiHandoffInput,
  RiskAssessment,
  ComplianceResult,
} from "./types/ai.types.js";

export type {
  AdminDataQueryInput,
  AdminDataUpdateInput,
  AdminDataDeleteInput,
} from "./types/admin.types.js";

export type {
  DailyLogFormValues,
  DrillingDailyLogFormValues,
  ProductionDailyLogFormValues,
  DozerRollFormValues,
  CreateBreakdownInput,
  BookOutInput,
  DirectCheckoutInput,
  MonthlyReportInput,
  UpdateMachineSiteInput,
} from "./types/form.types.js";

export type { EmployeeProfileUpdateInput, PrintRequestInput } from "./types/access-card.types.js";

export type {
  Tire,
  TireInspection,
  CreateTireInput,
  LogTireInspectionInput,
  ReplaceTireInput,
  TireStatus,
  TireCondition,
} from "./types/tire-management.types.js";
