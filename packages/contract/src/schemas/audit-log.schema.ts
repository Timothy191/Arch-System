import { z } from 'zod';
import { uuidSchema } from './common.schema';

export const auditActionTypeSchema = z.enum([
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'elevate_privilege',
  'export',
  'emergency_override',
  'shift_sign',
]);
export type AuditActionType = z.infer<typeof auditActionTypeSchema>;

export const auditLogStatusSchema = z.enum(['success', 'failed', 'denied']);
export type AuditLogStatus = z.infer<typeof auditLogStatusSchema>;

/**
 * Enterprise Audit Log Entry schema.
 * Conforms to ASP.NET Boilerplate and OWASP WSTG-SESS-06 / WSTG-ATHZ audit standards.
 */
export const auditLogEntrySchema = z.object({
  id: uuidSchema,
  timestamp: z.string().datetime(),
  actorId: z.string().min(1),
  actorRole: z.string().min(1),
  departmentId: z.string().min(1),
  action: auditActionTypeSchema,
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  status: auditLogStatusSchema,
  durationMs: z.number().int().nonnegative(),
  clientIp: z.string().optional(),
  userAgent: z.string().optional(),
  recordHash: z.string().length(64).optional(),
  previousHash: z.string().length(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const createAuditLogEntrySchema = auditLogEntrySchema.omit({
  id: true,
  timestamp: true,
});
export type CreateAuditLogEntry = z.infer<typeof createAuditLogEntrySchema>;
