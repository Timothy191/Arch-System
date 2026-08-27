import { z } from "zod";
import { uuidSchema } from "./common.schema.js";

export const complianceAuditRunSchema = z.object({
  id: uuidSchema.optional(),
  audit_type: z.string().min(1).max(64),
  status: z.enum(["passed", "failed", "warning"]).default("passed"),
  score: z.number().min(0).max(100).default(100.0),
  details: z.record(z.string(), z.unknown()).default({}),
  executed_by: uuidSchema.optional().nullable(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const createComplianceAuditRunSchema = complianceAuditRunSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type ComplianceAuditRun = z.infer<typeof complianceAuditRunSchema>;
export type CreateComplianceAuditRunInput = z.infer<typeof createComplianceAuditRunSchema>;
