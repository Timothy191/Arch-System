import { z } from "zod";
import { nonEmptyString } from "./common.schema.js";

export const tireStatusSchema = z.enum(["installed", "inventory", "scrapped"]);
export const tireConditionSchema = z.enum(["good", "warning", "critical"]);

export const tirePositionSchema = z.enum([
  "Front Left",
  "Front Right",
  "Rear Inner Left",
  "Rear Outer Left",
  "Rear Inner Right",
  "Rear Outer Right",
]);

export const tireIdSchema = z.string().min(1, "Tire ID is required");

export const tireSchema = z.object({
  id: tireIdSchema,
  serial_number: nonEmptyString,
  brand: nonEmptyString,
  size: nonEmptyString,
  machine_id: z.string().nullable().optional(),
  position: z.string().min(1),
  status: tireStatusSchema,
  installed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  installed_hours: z.number().int().min(0),
  removed_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  removed_hours: z.number().int().min(0).nullable().optional(),
  scrapped_reason: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const tireInspectionSchema = z.object({
  id: z.string().optional(),
  tire_id: tireIdSchema,
  inspection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  tread_depth_mm: z.number().min(0).max(150),
  pressure_psi: z.number().min(0).max(250),
  condition_status: tireConditionSchema,
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

export const createTireSchema = z.object({
  serial_number: nonEmptyString,
  brand: nonEmptyString,
  size: nonEmptyString,
  machine_id: z.string().nullable().optional(),
  position: z.string().min(1),
  status: tireStatusSchema.default("installed"),
  installed_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().split("T")[0] ?? ""),
  installed_hours: z.number().int().min(0).default(0),
});

export const logTireInspectionSchema = z.object({
  tire_id: tireIdSchema,
  inspection_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().split("T")[0] ?? ""),
  tread_depth_mm: z.number().min(0).max(150),
  pressure_psi: z.number().min(0).max(250),
  condition_status: tireConditionSchema,
  notes: z.string().optional(),
});

export const replaceTireSchema = z.object({
  old_tire_id: tireIdSchema,
  removed_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().split("T")[0] ?? ""),
  removed_hours: z.number().int().min(0),
  scrapped_reason: nonEmptyString,
  new_tire: createTireSchema.optional(),
});
