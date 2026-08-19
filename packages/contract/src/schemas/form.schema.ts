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

export const productionDailyLogSchema = z.object({
  shift: z.enum(["day", "night"]),
  actualCoalTonnes: z
    .number({ message: "Coal tonnage must be a number" })
    .min(0, "Tonnage must be ≥ 0")
    .max(100000, "Unrealistic single-shift tonnage")
    .default(0),
  actualWasteTonnes: z
    .number({ message: "Waste tonnage must be a number" })
    .min(0, "Tonnage must be ≥ 0")
    .max(200000, "Unrealistic single-shift tonnage")
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

export const createBreakdownSchema = z.object({
  fleet_id: z.string().min(1, "Fleet ID is required"),
  machine_name: z.string().optional(),
  machine_type: z.string().min(1, "Machine type is required"),
  date_in: z.string().min(1, "Date in is required"),
  time_in: z.string().min(1, "Time in is required"),
  reason: z.string().min(1, "Reason is required"),
});

export const bookOutSchema = z.object({
  date_out: z.string().min(1, "Date out is required"),
  time_out: z.string().min(1, "Time out is required"),
  repair_notes: z.string().optional(),
});

export const directCheckoutSchema = z.object({
  fleet_id: z.string().min(1, "Fleet ID is required"),
  machine_type: z.string().min(1, "Machine type is required"),
  date_out: z.string().min(1, "Date out is required"),
  time_out: z.string().min(1, "Time out is required"),
  reason: z.string().min(1, "Reason is required"),
  repair_notes: z.string().optional(),
});

export const monthlyReportInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional().default(""),
  kpis: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .default([]),
  tableHeaders: z.array(z.string()).default([]),
  tableRows: z.array(z.array(z.string())).default([]),
});

export const updateMachineSiteSchema = z.object({
  machineId: z.string().uuid("Invalid machine ID format"),
  siteId: z.string().uuid("Invalid site ID format").nullable(),
});
