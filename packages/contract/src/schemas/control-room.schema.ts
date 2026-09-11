import { z } from "zod";
import { dateSchema, nonEmptyString, uuidSchema } from "./common.schema";

export const shiftCompletenessSchema = z.object({
  deptId: uuidSchema,
  deptSlug: nonEmptyString.max(100),
  date: dateSchema,
  shift: z.enum(["day", "night"]),
});

export const controlRoomChecklistItemSchema = z.object({
  id: nonEmptyString.max(64),
  label: nonEmptyString.max(255),
  category: z.enum(["daily", "weekly", "monthly", "incident", "compliance"]),
  completed: z.boolean(),
  completedAt: z.string().datetime().optional().nullable(),
  completedBy: nonEmptyString.max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const controlRoomChecklistSchema = z.object({
  departmentId: uuidSchema,
  date: dateSchema,
  shift: z.enum(["day", "night"]),
  items: z.array(controlRoomChecklistItemSchema),
  supervisorSignature: nonEmptyString.max(100).optional().nullable(),
});

export const controlRoomShiftReportSchema = z.object({
  departmentId: uuidSchema,
  date: dateSchema,
  shift: z.enum(["day", "night"]),
  alarmResponseAvgSeconds: z.number().nonnegative(),
  incidentAckAvgSeconds: z.number().nonnegative(),
  systemUptimePercent: z.number().min(0).max(100),
  missedIncidentsCount: z.number().int().nonnegative(),
  summaryNotes: z.string().max(4000),
  operatorName: nonEmptyString.max(100),
  completedChecklistCount: z.number().int().nonnegative(),
  totalChecklistCount: z.number().int().positive(),
  checklistItems: z.array(controlRoomChecklistItemSchema).optional().default([]),
  supervisorSignature: nonEmptyString.max(100).optional().nullable(),
});

export const shiftCloseoutSchema = z.object({
  shiftId: uuidSchema,
  department: z.literal("control_room"),
  supervisorId: uuidSchema,
  supervisorPin: z.string().regex(/^\d{4,6}$/, "Supervisor PIN must be 4 to 6 digits"),
  totalLoads: z.number().int().nonnegative(),
  totalOperatingHours: z.number().min(0).max(24),
  breakdownHours: z.number().min(0).max(24),
  operatorNotes: z.string().max(1000).optional(),
});

export const healthCheckResponseSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  timestamp: z.string(),
  latencyMs: z.number().nonnegative(),
  services: z.object({
    supabase: z.object({
      status: z.enum(["healthy", "degraded", "unhealthy"]),
      latencyMs: z.number().nonnegative(),
      error: z.string().optional(),
    }),
    redis: z.object({
      status: z.enum(["healthy", "degraded", "unhealthy"]),
      latencyMs: z.number().nonnegative(),
      error: z.string().optional(),
    }),
    fuxa: z.object({
      status: z.enum(["healthy", "degraded", "unhealthy"]),
      latencyMs: z.number().nonnegative(),
      statusCode: z.number().optional().nullable(),
      error: z.string().optional(),
    }),
  }),
});

export type ShiftCloseoutInput = z.infer<typeof shiftCloseoutSchema>;
export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;

