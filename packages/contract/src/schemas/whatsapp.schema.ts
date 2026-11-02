import { z } from 'zod';
import { dateSchema, nonEmptyString, uuidSchema } from './common.schema';

export const whatsappShiftTypeSchema = z.enum(['day', 'night', 'swing']);
export type WhatsappShiftType = z.infer<typeof whatsappShiftTypeSchema>;

export const whatsappDepartmentSchema = z.enum([
  'drilling',
  'production',
  'engineering',
  'access_control',
  'control_room',
]);
export type WhatsappDepartment = z.infer<typeof whatsappDepartmentSchema>;

export const whatsappSafetyStatusSchema = z.enum([
  'all_clear',
  'minor_incident',
  'major_incident',
  'stoppage',
]);
export type WhatsappSafetyStatus = z.infer<typeof whatsappSafetyStatusSchema>;

/**
 * Standardized operational shift summary for WhatsApp dispatch.
 * Conforms to the `whatsapp-shift-dispatch` action bridge.
 */
export const whatsappShiftDispatchSchema = z.object({
  department: whatsappDepartmentSchema,
  shiftType: whatsappShiftTypeSchema,
  shiftDate: dateSchema,
  supervisorName: nonEmptyString.max(120),
  safetyStatus: whatsappSafetyStatusSchema,
  targetMetersOrTons: z.number().nonnegative().optional(),
  achievedMetersOrTons: z.number().nonnegative().optional(),
  activeFleetCount: z.number().int().nonnegative().optional(),
  operationalNotes: z.string().max(2000),
  recipientGroupOrPhone: z
    .string()
    .min(5)
    .max(50)
    .regex(/^[+0-9a-zA-Z_\-\s]+$/, 'Must be a valid group name or international phone number'),
});
export type WhatsappShiftDispatch = z.infer<typeof whatsappShiftDispatchSchema>;

export const whatsappMusterIncidentTypeSchema = z.enum([
  'fire',
  'pit_wall_instability',
  'gas_leak',
  'power_failure',
  'evacuation_drill',
  'medical_emergency',
]);
export type WhatsappMusterIncidentType = z.infer<typeof whatsappMusterIncidentTypeSchema>;

export const whatsappMusterSeveritySchema = z.enum(['critical', 'high', 'moderate', 'drill']);
export type WhatsappMusterSeverity = z.infer<typeof whatsappMusterSeveritySchema>;

/**
 * Emergency muster alert for instant WhatsApp broadcast to all mining teams.
 */
export const whatsappMusterAlertSchema = z.object({
  alertId: uuidSchema.optional(),
  incidentType: whatsappMusterIncidentTypeSchema,
  evacuationZone: nonEmptyString.max(100),
  musterPoint: nonEmptyString.max(100),
  severity: whatsappMusterSeveritySchema,
  broadcastMessage: z.string().min(10).max(1000),
  initiatedBy: nonEmptyString.max(120),
  recipientGroup: z.string().min(3).max(50),
});
export type WhatsappMusterAlert = z.infer<typeof whatsappMusterAlertSchema>;

/**
 * Standard response envelope returned by the WhatsApp action bridge.
 */
export const whatsappDispatchResponseSchema = z.object({
  success: z.boolean(),
  dispatchId: z.string().min(1),
  timestamp: z.string().datetime(),
  deliveredCount: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type WhatsappDispatchResponse = z.infer<typeof whatsappDispatchResponseSchema>;
