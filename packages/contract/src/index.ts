/**
 * @repo/contract — Canonical Zod schemas and derived types for the Arch-System monorepo.
 *
 * This package is the single source of truth for all cross-boundary data contracts.
 * No other workspace should define Zod schemas for shared entities; import from here.
 */

// ---------------------------------------------------------------------------
// Re-exported Zod types (so consumers don't import "zod" directly)
// ---------------------------------------------------------------------------

export type { ZodError, ZodSchema } from "zod";
export { z } from "zod";

// ---------------------------------------------------------------------------
// Validation middleware (runtime)
// ---------------------------------------------------------------------------

export { ValidationError } from "./validation.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export { EmployeeProfileUpdateSchema, PrintRequestSchema } from "./schemas/access-card.schema.js";
export {
  adminAddSiteSchema,
  adminDataDeleteSchema,
  adminDataQuerySchema,
  adminDataUpdateSchema,
  adminUpdateSiteSchema,
} from "./schemas/admin.schema.js";
export {
  aiChatSchema,
  aiHandoffSchema,
  aiPredictSchema,
  aiSafetySchema,
  complianceResultSchema,
  riskAssessmentSchema,
} from "./schemas/ai.schema.js";
export {
  dateMonthSchema,
  dateSchema,
  nonEmptyString,
  uuidSchema,
} from "./schemas/common.schema.js";
export {
  complianceAuditRunSchema,
  createComplianceAuditRunSchema,
} from "./schemas/compliance-audit.schema.js";
export {
  controlRoomChecklistItemSchema,
  controlRoomChecklistSchema,
  controlRoomShiftReportSchema,
  healthCheckResponseSchema,
  shiftCloseoutSchema,
  shiftCompletenessSchema,
} from "./schemas/control-room.schema.js";
export { drillOperationSchema, drillTelemetryIngestSchema } from "./schemas/drill.schema.js";
export { exportQuerySchema } from "./schemas/export.schema.js";
export {
  equipmentSchema,
  equipmentStatusEnum,
  fleetCategoryEnum,
  fleetSchema,
  fleetStatusEnum,
} from "./schemas/fleet-equipment.schema.js";
export {
  bookOutSchema,
  createBreakdownSchema,
  dailyLogSchema,
  directCheckoutSchema,
  dozerRollSchema,
  drillingDailyLogSchema,
  monthlyReportInputSchema,
  productionDailyLogSchema,
  updateMachineSiteSchema,
} from "./schemas/form.schema.js";
export {
  ancillaryReportEntrySchema,
  breakdownReportEntrySchema,
  bredellReportEntrySchema,
  dozerRolloverEntrySchema,
  excavatorHaulSchema,
  fleetSmuEntrySchema,
  multiSiteShiftReportSchema,
  operationalStatusEnum,
  truckTallySchema,
} from "./schemas/multi-site-production.schema.js";
export { scannerBadgeSchema } from "./schemas/scanner.schema.js";
export {
  lockAndSignShiftSchema,
  machinePerformanceSchema,
  shiftBreakdownSummarySchema,
  shiftTireEventSchema,
  unifiedShiftReportSchema,
} from "./schemas/shift-compilation.schema.js";
export { syncPlaybackSchema } from "./schemas/sync.schema.js";
export { telemetryPushSchema } from "./schemas/telemetry.schema.js";
export {
  createTireSchema,
  logTireInspectionSchema,
  replaceTireSchema,
  tireConditionSchema,
  tireInspectionSchema,
  tirePositionSchema,
  tireSchema,
  tireStatusSchema,
} from "./schemas/tire-management.schema.js";
export { createWebhookSchema, updateWebhookSchema } from "./schemas/webhook.schema.js";

// ---------------------------------------------------------------------------
// Derived types (inferred from schemas)
// ---------------------------------------------------------------------------

export type {
  ComplianceAuditRun,
  CreateComplianceAuditRunInput,
} from "./schemas/compliance-audit.schema.js";
export type { DrillOperationInput, DrillTelemetryIngestInput } from "./schemas/drill.schema.js";
export type {
  Equipment,
  EquipmentStatus,
  Fleet,
  FleetCategory,
  FleetStatus,
} from "./schemas/fleet-equipment.schema.js";
export type { EmployeeProfileUpdateInput, PrintRequestInput } from "./types/access-card.types.js";
export type {
  AdminDataDeleteInput,
  AdminDataQueryInput,
  AdminDataUpdateInput,
} from "./types/admin.types.js";
export type {
  AiChatInput,
  AiHandoffInput,
  AiPredictInput,
  AiSafetyInput,
  ComplianceResult,
  RiskAssessment,
} from "./types/ai.types.js";
export type { DateMonthString, DateString, NonEmptyString, Uuid } from "./types/common.types.js";
export type {
  ControlRoomChecklistInput,
  ControlRoomChecklistItem,
  ControlRoomShiftReportInput,
  ShiftCompletenessInput,
} from "./types/control-room.types.js";
export type {
  HealthCheckResponse,
  ShiftCloseoutInput,
} from "./schemas/control-room.schema.js";
export type { ExportQueryInput } from "./types/export.types.js";
export type {
  BookOutInput,
  CreateBreakdownInput,
  DailyLogFormValues,
  DirectCheckoutInput,
  DozerRollFormValues,
  DrillingDailyLogFormValues,
  MonthlyReportInput,
  ProductionDailyLogFormValues,
  UpdateMachineSiteInput,
} from "./types/form.types.js";
export type {
  AncillaryReportEntry,
  BreakdownReportEntry,
  BredellReportEntry,
  DozerRolloverEntry,
  ExcavatorHaul,
  FleetSmuEntry,
  MachineOperationalStatus,
  MultiSiteShiftReport,
  TruckTally,
} from "./types/multi-site-production.types.js";
export type { ScannerBadgeInput } from "./types/scanner.types.js";
export type {
  LockAndSignShiftInput,
  MachinePerformance,
  ShiftBreakdownSummary,
  ShiftTireEvent,
  UnifiedShiftReport,
} from "./types/shift-compilation.types.js";
export type { SyncPlaybackInput } from "./types/sync.types.js";
export type { TelemetryPushInput } from "./types/telemetry.types.js";
export type {
  CreateTireInput,
  LogTireInspectionInput,
  ReplaceTireInput,
  Tire,
  TireCondition,
  TireInspection,
  TireStatus,
} from "./types/tire-management.types.js";
export type { CreateWebhookInput, UpdateWebhookInput } from "./types/webhook.types.js";
export * from './ultragoal';
export * from './agent-governance';
export * from './codemod';
