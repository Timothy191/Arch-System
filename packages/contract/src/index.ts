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

export { ValidationError } from "./validation";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export { EmployeeProfileUpdateSchema, PrintRequestSchema } from "./schemas/access-card.schema";
export {
  adminAddSiteSchema,
  adminDataDeleteSchema,
  adminDataQuerySchema,
  adminDataUpdateSchema,
  adminUpdateSiteSchema,
} from "./schemas/admin.schema";
export {
  aiChatSchema,
  aiHandoffSchema,
  aiPredictSchema,
  aiSafetySchema,
  complianceResultSchema,
  riskAssessmentSchema,
} from "./schemas/ai.schema";
export { dateMonthSchema, dateSchema, nonEmptyString, uuidSchema } from "./schemas/common.schema";
export {
  complianceAuditRunSchema,
  createComplianceAuditRunSchema,
} from "./schemas/compliance-audit.schema";
export {
  controlRoomChecklistItemSchema,
  controlRoomChecklistSchema,
  controlRoomShiftReportSchema,
  healthCheckResponseSchema,
  shiftCloseoutSchema,
  shiftCompletenessSchema,
} from "./schemas/control-room.schema";
export { drillOperationSchema, drillTelemetryIngestSchema } from "./schemas/drill.schema";
export { exportQuerySchema } from "./schemas/export.schema";
export {
  equipmentSchema,
  equipmentStatusEnum,
  fleetCategoryEnum,
  fleetSchema,
  fleetStatusEnum,
} from "./schemas/fleet-equipment.schema";
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
} from "./schemas/form.schema";
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
} from "./schemas/multi-site-production.schema";
export { scannerBadgeSchema } from "./schemas/scanner.schema";
export {
  lockAndSignShiftSchema,
  machinePerformanceSchema,
  shiftBreakdownSummarySchema,
  shiftTireEventSchema,
  unifiedShiftReportSchema,
} from "./schemas/shift-compilation.schema";
export { syncPlaybackSchema } from "./schemas/sync.schema";
export { telemetryPushSchema } from "./schemas/telemetry.schema";
export {
  createTireSchema,
  logTireInspectionSchema,
  replaceTireSchema,
  tireConditionSchema,
  tireInspectionSchema,
  tirePositionSchema,
  tireSchema,
  tireStatusSchema,
} from "./schemas/tire-management.schema";
export { createWebhookSchema, updateWebhookSchema } from "./schemas/webhook.schema";

// ---------------------------------------------------------------------------
// Derived types (inferred from schemas)
// ---------------------------------------------------------------------------

export type {
  ComplianceAuditRun,
  CreateComplianceAuditRunInput,
} from "./schemas/compliance-audit.schema";
export type { DrillOperationInput, DrillTelemetryIngestInput } from "./schemas/drill.schema";
export type {
  Equipment,
  EquipmentStatus,
  Fleet,
  FleetCategory,
  FleetStatus,
} from "./schemas/fleet-equipment.schema";
export type { EmployeeProfileUpdateInput, PrintRequestInput } from "./types/access-card.types";
export type {
  AdminDataDeleteInput,
  AdminDataQueryInput,
  AdminDataUpdateInput,
} from "./types/admin.types";
export type {
  AiChatInput,
  AiHandoffInput,
  AiPredictInput,
  AiSafetyInput,
  ComplianceResult,
  RiskAssessment,
} from "./types/ai.types";
export type { DateMonthString, DateString, NonEmptyString, Uuid } from "./types/common.types";
export type {
  ControlRoomChecklistInput,
  ControlRoomChecklistItem,
  ControlRoomShiftReportInput,
  ShiftCompletenessInput,
} from "./types/control-room.types";
export type { HealthCheckResponse, ShiftCloseoutInput } from "./schemas/control-room.schema";
export type { ExportQueryInput } from "./types/export.types";
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
} from "./types/form.types";
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
} from "./types/multi-site-production.types";
export type { ScannerBadgeInput } from "./types/scanner.types";
export type {
  LockAndSignShiftInput,
  MachinePerformance,
  ShiftBreakdownSummary,
  ShiftTireEvent,
  UnifiedShiftReport,
} from "./types/shift-compilation.types";
export type { SyncPlaybackInput } from "./types/sync.types";
export type { TelemetryPushInput } from "./types/telemetry.types";
export type {
  CreateTireInput,
  LogTireInspectionInput,
  ReplaceTireInput,
  Tire,
  TireCondition,
  TireInspection,
  TireStatus,
} from "./types/tire-management.types";
export type { CreateWebhookInput, UpdateWebhookInput } from "./types/webhook.types";
export * from "./ultragoal";
export * from "./agent-governance";
export * from "./codemod";
