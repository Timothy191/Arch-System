import { z } from "zod";

export const dailyLogSchema = z.object({
  shift: z.enum(["day", "night"]),
  notes: z.string().optional().or(z.literal("")),
});

export const dozerRollSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID"),
  machineId: z.string().uuid("Please select a dozer"),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  shiftType: z.enum(["day", "night"]),
  bladePasses: z
    .number()
    .int()
    .min(0, "Blade passes must be a positive integer"),
  pushCount: z.number().int().min(0, "Push count must be a positive integer"),
  hoursOperated: z
    .number()
    .min(0, "Hours operated must be positive")
    .max(24, "Hours operated cannot exceed 24"),
  area: z.number().min(0, "Area must be positive"),
});
