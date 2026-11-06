import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.schema';

/**
 * System log severity levels — mirrors the CHECK constraint on
 * public.system_logs.level (migration 216).
 */
export const systemLogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
export type SystemLogLevel = z.infer<typeof systemLogLevelSchema>;

/**
 * Origin of a system log entry — mirrors public.system_logs.source.
 */
export const systemLogSourceSchema = z.enum([
  'client',
  'server',
  'api',
  'cron',
  'csp',
  'integration',
  'auth',
]);
export type SystemLogSource = z.infer<typeof systemLogSourceSchema>;

/**
 * Free-form grouping label (e.g. 'runtime', 'api', 'scada', 'circuit-breaker').
 * Bounded so hostile payloads cannot bloat rows.
 */
export const systemLogCategorySchema = z.string().min(1).max(60);
export type SystemLogCategory = z.infer<typeof systemLogCategorySchema>;

/**
 * Payload accepted by POST /api/logs. Identity fields (employee_id,
 * department_id, ip_address, user_agent) are derived server-side from the
 * session/request and are intentionally NOT client-settable.
 */
export const createSystemLogEntrySchema = z.object({
  level: systemLogLevelSchema.default('error'),
  source: systemLogSourceSchema,
  category: systemLogCategorySchema.default('general'),
  message: nonEmptyString.max(2000),
  stack: z.string().max(8000).optional(),
  context: z.record(z.string(), z.unknown()).default({}),
  url: z.string().max(2000).optional(),
  method: z.string().max(10).optional(),
});
export type CreateSystemLogEntry = z.infer<typeof createSystemLogEntrySchema>;

/**
 * Full system_logs row as stored (snake_case to match the table, consistent
 * with other DB-mapped contract schemas such as machine-ledger).
 */
export const systemLogEntrySchema = z.object({
  id: uuidSchema,
  level: systemLogLevelSchema,
  source: systemLogSourceSchema,
  category: systemLogCategorySchema,
  message: z.string(),
  stack: z.string().nullable(),
  context: z.record(z.string(), z.unknown()),
  url: z.string().nullable(),
  method: z.string().nullable(),
  employee_id: uuidSchema.nullable(),
  department_id: uuidSchema.nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  resolved: z.boolean(),
  resolved_at: z.string().datetime().nullable(),
  resolved_by: uuidSchema.nullable(),
  created_at: z.string().datetime(),
});
export type SystemLogEntry = z.infer<typeof systemLogEntrySchema>;

/**
 * Query filters accepted by GET /api/logs.
 */
export const systemLogQuerySchema = z.object({
  level: systemLogLevelSchema.optional(),
  source: systemLogSourceSchema.optional(),
  category: systemLogCategorySchema.optional(),
  resolved: z.enum(['true', 'false']).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type SystemLogQuery = z.infer<typeof systemLogQuerySchema>;

/**
 * PATCH /api/logs body — admin triage action.
 */
export const updateSystemLogResolutionSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
  resolved: z.boolean(),
});
export type UpdateSystemLogResolution = z.infer<typeof updateSystemLogResolutionSchema>;

/**
 * Payload accepted by POST /api/log (browser logger transport).
 * Bounds message length and metadata to prevent unbounded log generation (Rule 9).
 */
export const clientLogPayloadSchema = z.object({
  level: z.string().max(20).optional().default('debug'),
  msg: z.string().trim().min(1).max(2000),
  timestamp: z.string().max(64).optional(),
  data: z.unknown().optional(),
});
export type ClientLogPayload = z.infer<typeof clientLogPayloadSchema>;

/**
 * Payload accepted by POST /api/feedback.
 */
export const submitFeedbackTypeSchema = z.enum([
  'bug',
  'feature',
  'general',
  'support',
  'improvement',
  'compliment',
  'other',
]);
export type SubmitFeedbackType = z.infer<typeof submitFeedbackTypeSchema>;

export const submitFeedbackSchema = z.object({
  type: submitFeedbackTypeSchema.default('general'),
  message: z.string().trim().min(1).max(2000),
  userEmail: z.string().email().max(320).optional(),
  pageUrl: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
