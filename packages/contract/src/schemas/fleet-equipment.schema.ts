import { z } from "zod";
import { uuidSchema, nonEmptyString } from "./common.schema.js";

export const fleetCategoryEnum = z.enum([
  "truck",
  "excavator",
  "dozer",
  "drill",
  "grader",
  "bowser",
  "ldv",
  "ancillary",
]);

export const fleetStatusEnum = z.enum(["operational", "breakdown", "standby", "maintenance"]);

export const fleetSchema = z.object({
  id: uuidSchema.optional(),
  code: nonEmptyString,
  category: fleetCategoryEnum,
  model: z.string().optional().nullable(),
  status: fleetStatusEnum.default("operational"),
  department_id: uuidSchema.optional().nullable(),
  current_site: z.string().optional().nullable(),
  hour_meter: z.number().min(0).default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const equipmentStatusEnum = z.enum(["available", "assigned", "maintenance", "retired"]);

export const equipmentSchema = z.object({
  id: uuidSchema.optional(),
  code: nonEmptyString,
  name: z.string().min(1).max(128),
  serial_number: z.string().optional().nullable(),
  assigned_to: uuidSchema.optional().nullable(),
  department_id: uuidSchema.optional().nullable(),
  status: equipmentStatusEnum.default("available"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Fleet = z.infer<typeof fleetSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type FleetCategory = z.infer<typeof fleetCategoryEnum>;
export type FleetStatus = z.infer<typeof fleetStatusEnum>;
export type EquipmentStatus = z.infer<typeof equipmentStatusEnum>;
