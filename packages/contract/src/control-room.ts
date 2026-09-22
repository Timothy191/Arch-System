import { z } from 'zod';

export const shiftTypeSchema = z.enum(['day', 'night']);

// Schema for querying shift completeness
export const shiftCompletenessQuerySchema = z.object({
  deptId: z.string().uuid('Invalid department ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  shift: shiftTypeSchema,
});

export type ShiftCompletenessQuery = z.infer<typeof shiftCompletenessQuerySchema>;

// Detailed item for checklist state (JSON payload)
export const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['pending', 'completed', 'failed', 'n_a']),
  notes: z.string().optional(),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;

// Closeout Payload sent from UI to API
export const shiftCloseoutPayloadSchema = z.object({
  deptId: z.string().uuid('Invalid department ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  shift: shiftTypeSchema,
  operatorName: z.string().min(2, 'Operator name is required'),
  alarmResponseAvgSeconds: z.number().min(0).default(0),
  incidentAckAvgSeconds: z.number().min(0).default(0),
  systemUptimePercent: z.number().min(0).max(100).default(100),
  missedIncidentsCount: z.number().int().min(0).default(0),
  summaryNotes: z.string().optional(),
  checklistItems: z.array(checklistItemSchema).default([]),
  supervisorSignature: z.string().min(2, 'Supervisor signature required').optional(),
  machineIds: z.array(z.string().uuid()).optional(),
  idempotencyKey: z.string().min(10, 'Idempotency key required'),
});

export type ShiftCloseoutPayload = z.infer<typeof shiftCloseoutPayloadSchema>;

// Shift completeness result
export const shiftCompletenessResultSchema = z.object({
  isComplete: z.boolean(),
  missingItems: z.array(
    z.object({
      category: z.string(),
      reason: z.string(),
    })
  ),
});

export type ShiftCompletenessResult = z.infer<typeof shiftCompletenessResultSchema>;

export const ScadaMessageSchema = z.object({
  type: z.enum(['SCADA_STATUS_UPDATE', 'SCADA_ALARM']),
  payload: z.any(),
});
export type ScadaMessage = z.infer<typeof ScadaMessageSchema>;
