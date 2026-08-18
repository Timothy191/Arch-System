import { z } from "zod";
import { uuidSchema, dateSchema, nonEmptyString } from "./common.schema.js";

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
