import { z } from 'zod';

export const vibemonEventTypeSchema = z.enum(['test', 'session_start', 'activity', 'stop']);

export const vibemonAgentSchema = z.enum([
  'antigravity',
  'claude_code',
  'gemini_cli',
  'cursor',
  'codex_cli',
  'cline',
  'qoder',
]);

export const vibemonKeyModeSchema = z.enum(['remote', 'local-only', 'unconfigured']);

export const vibemonHealthStatusSchema = z.enum(['healthy', 'degraded', 'unavailable']);

export const vibemonTodoStatusSchema = z.enum(['idea', 'pending', 'in_progress', 'review', 'done']);

export const vibemonTodoPrioritySchema = z.enum(['high', 'medium', 'low']);

export const vibemonHookEventSchema = z.object({
  v: z.literal(2).default(2),
  event: vibemonEventTypeSchema,
  agent: vibemonAgentSchema,
  cwd: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  project_root: z.string().optional(),
  repo_identifier: z.string().optional(),
  branch: z.string().optional(),
  head_sha: z.string().optional(),
  session_id: z.string().optional(),
  local_hour: z.number().int().min(0).max(23).optional(),
  local_dow: z.number().int().min(0).max(6).optional(),
  local_tz: z.string().optional(),
  signals: z.record(z.string(), z.unknown()).default({}),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const vibemonHealthDetailsSchema = z.object({
  mcpUrl: z.string().url(),
  hookUrl: z.string().url(),
  version: z.string(),
  httpStatus: z.number().int().nullable(),
  localLedgerEvents: z.number().int().nonnegative(),
  activeTeamId: z.string().uuid().nullable(),
  openTodosCount: z.number().int().nonnegative().nullable(),
  activeSessionsCount: z.number().int().nonnegative().nullable(),
  error: z.string().nullable(),
});

export const vibemonHealthResponseSchema = z.object({
  status: vibemonHealthStatusSchema,
  optional: z.literal(true),
  configured: z.boolean(),
  keyMode: vibemonKeyModeSchema,
  backendStatus: z.literal('normal'),
  latencyMs: z.number().nonnegative(),
  lastCheck: z.string().datetime({ offset: true }),
  details: vibemonHealthDetailsSchema,
});

export type VibemonEventType = z.infer<typeof vibemonEventTypeSchema>;
export type VibemonAgent = z.infer<typeof vibemonAgentSchema>;
export type VibemonKeyMode = z.infer<typeof vibemonKeyModeSchema>;
export type VibemonHealthStatus = z.infer<typeof vibemonHealthStatusSchema>;
export type VibemonTodoStatus = z.infer<typeof vibemonTodoStatusSchema>;
export type VibemonTodoPriority = z.infer<typeof vibemonTodoPrioritySchema>;
export type VibemonHookEvent = z.infer<typeof vibemonHookEventSchema>;
export type VibemonHealthDetails = z.infer<typeof vibemonHealthDetailsSchema>;
export type VibemonHealthResponse = z.infer<typeof vibemonHealthResponseSchema>;
