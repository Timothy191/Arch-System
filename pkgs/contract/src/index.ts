/**
 * @repo/contract — Canonical Zod schemas and derived types for the Arch-System monorepo.
 *
 * This package is the single source of truth for all cross-boundary data contracts.
 * No other workspace should define Zod schemas for shared entities; import from here.
 */

// ---------------------------------------------------------------------------
// Re-exported Zod types (so consumers don't import "zod" directly)
// ---------------------------------------------------------------------------

export type { ZodSchema, ZodError } from "zod";

// ---------------------------------------------------------------------------
// Validation middleware (runtime)
// ---------------------------------------------------------------------------

export { ValidationError } from "./validation";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export {
  uuidSchema,
  dateSchema,
  dateMonthSchema,
  nonEmptyString,
} from "./schemas/common.schema";

export { createWebhookSchema, updateWebhookSchema } from "./schemas/webhook.schema";

export { exportQuerySchema, safetyExportQuerySchema } from "./schemas/export.schema";

export { scannerBadgeSchema } from "./schemas/scanner.schema";

export { telemetryPushSchema } from "./schemas/telemetry.schema";

export { syncPlaybackSchema } from "./schemas/sync.schema";

export { shiftCompletenessSchema } from "./schemas/control-room.schema";

export {
  adminDataQuerySchema,
  adminDataUpdateSchema,
  adminDataDeleteSchema,
} from "./schemas/admin.schema";

export { dailyLogSchema, dozerRollSchema } from "./schemas/form.schema";

export { EmployeeProfileUpdateSchema, PrintRequestSchema } from "./schemas/access-card.schema";

// ---------------------------------------------------------------------------
// Derived types (inferred from schemas)
// ---------------------------------------------------------------------------

export type { Uuid, DateString, DateMonthString, NonEmptyString } from "./types/common.types";

export type { CreateWebhookInput, UpdateWebhookInput } from "./types/webhook.types";

export type { ExportQueryInput, SafetyExportQueryInput } from "./types/export.types";

export type { ScannerBadgeInput } from "./types/scanner.types";

export type { TelemetryPushInput } from "./types/telemetry.types";

export type { SyncPlaybackInput } from "./types/sync.types";

export type { ShiftCompletenessInput } from "./types/control-room.types";

export type {
  AdminDataQueryInput,
  AdminDataUpdateInput,
  AdminDataDeleteInput,
} from "./types/admin.types";

export type { DailyLogFormValues, DozerRollFormValues } from "./types/form.types";

export type { EmployeeProfileUpdateInput, PrintRequestInput } from "./types/access-card.types";
