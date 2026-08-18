import { z } from "zod";

export const dailyLogSchema = z.object({
  shift: z.enum(["day", "night"]),
  notes: z.string().optional().or(z.literal("")),
});

export const drillingDailyLogSchema = z.object({
  shift: z.enum(["day", "night"]),
  holesDrilled: z
    .number({ message: "Holes drilled must be a number" })
    .int("Holes drilled must be an integer")
    .min(0, "Holes drilled must be ≥ 0")
    .max(500, "Unrealistic single-shift count"),
  totalDepthMeters: z
    .number({ message: "Total depth must be a number" })
    .min(0, "Total depth must be ≥ 0")
    .max(5000, "Max depth exceeded"),
  penetrationRate: z.number().min(0, "Penetration rate must be positive").max(100).optional(),
  bitWearPercentage: z
    .number()
    .min(0, "Bit wear cannot be negative")
    .max(100, "Bit wear cannot exceed 100%")
    .optional(),
  drillPatternId: z.string().max(50).optional().or(z.literal("")),
  delayCategory: z
    .enum(["none", "bit_replacement", "rod_jam", "collar_setup", "mechanical_breakdown", "weather"])
    .default("none"),
  delayMinutes: z
    .number()
    .int("Delay minutes must be an integer")
    .min(0, "Delay minutes must be ≥ 0")
    .max(720, "Delay cannot exceed 12 hours")
    .default(0),
  notes: z.string().max(2000, "Notes cannot exceed 2000 characters").optional().or(z.literal("")),
});

export const dozerRollSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID"),
  machineId: z.string().uuid("Please select a dozer"),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  shiftType: z.enum(["day", "night"]),
  bladePasses: z.number().int().min(0, "Blade passes must be a positive integer"),
  pushCount: z.number().int().min(0, "Push count must be a positive integer"),
  hoursOperated: z
    .number()
    .min(0, "Hours operated must be positive")
    .max(24, "Hours operated cannot exceed 24"),
  area: z.number().min(0, "Area must be positive"),
});
