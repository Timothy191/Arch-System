import { z } from "zod";
import { dateSchema, nonEmptyString, uuidSchema } from "./common.schema";

export const coalTruckScanSchema = z.object({
  truck_license: nonEmptyString.max(50, "Truck license must be 50 characters or less"),
  driver_license: nonEmptyString.max(50, "Driver license must be 50 characters or less"),
  gate_location: z.string().max(100).default("SOUTH-WEIGHBRIDGE"),
  direction: z.enum(["IN", "OUT"]).default("IN"),
  operator: z.string().max(100).optional().nullable(),
  device_id: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type CoalTruckScanInput = z.infer<typeof coalTruckScanSchema>;

export const keyControlAssetSchema = z.object({
  id: uuidSchema.optional(),
  key_code: nonEmptyString.max(50),
  key_name: nonEmptyString.max(150),
  key_type: z.enum([
    "heavy_fleet",
    "drill_rig",
    "personal_vehicle",
    "building",
    "explosives_depot",
    "workshop",
  ]),
  required_role: z.string().max(100).optional().nullable(),
  required_cert: z.string().max(150).optional().nullable(),
  department_id: uuidSchema.optional().nullable(),
  status: z.enum(["In Depot", "Checked Out", "Maintenance", "Lost"]).default("In Depot"),
  current_holder_id: uuidSchema.optional().nullable(),
  checked_out_at: z.string().datetime().optional().nullable(),
});

export type KeyControlAsset = z.infer<typeof keyControlAssetSchema>;

export const keyScanTransactionSchema = z.object({
  key_code: nonEmptyString,
  employee_badge_or_id: nonEmptyString,
  action: z.enum(["CHECKOUT", "RETURN"]).default("CHECKOUT"),
  gate_location: z.string().max(100).default("KEY-DEPOT-1"),
  device_id: z.string().max(100).optional().nullable(),
  operator: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type KeyScanTransactionInput = z.infer<typeof keyScanTransactionSchema>;

export const accessCardMakerSchema = z.object({
  first_name: nonEmptyString.max(100, "First name is required"),
  surname: nonEmptyString.max(100, "Surname is required"),
  id_number: nonEmptyString.max(50, "National ID or Passport number is required"),
  job_role: nonEmptyString.max(100, "Job role is required"),
  area: nonEmptyString.max(100, "Operational area is required"),
  coy_number: nonEmptyString.max(50, "Company number (Coy Number) is required"),
  medical_expiry: dateSchema.nullable().optional(),
  induction_expiry: dateSchema.nullable().optional(),
  photo_url: z.string().nullable().optional(),
  background_url: z.string().nullable().optional(),
  background_template: z.string().default("default-arch-card"),
  department_id: uuidSchema.optional().nullable(),
  print_copies: z.number().int().min(1).max(5).default(1),
  printer_cups_name: z.string().default("Magicard_Neo300"),
});

export type AccessCardMakerInput = z.infer<typeof accessCardMakerSchema>;

export const rollCallQuerySchema = z.object({
  department_id: uuidSchema.optional().nullable(),
  entity_type: z
    .enum(["all", "personnel", "contractor", "visitor", "vehicle", "coal_truck"])
    .default("all"),
  zone: z.string().optional().nullable(),
  search: z.string().optional().nullable(),
});

export type RollCallQueryInput = z.infer<typeof rollCallQuerySchema>;

export const attendanceQuerySchema = z.object({
  query: z.string().optional().nullable(),
  date_from: dateSchema.optional().nullable(),
  date_to: dateSchema.optional().nullable(),
  department_id: uuidSchema.optional().nullable(),
  direction: z.enum(["ALL", "IN", "OUT"]).default("ALL").optional(),
  limit: z.number().int().min(1).max(500).default(100).optional(),
});

export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>;

export const gateLocationSchema = z.object({
  id: uuidSchema.optional(),
  code: nonEmptyString.max(50),
  name: nonEmptyString.max(150),
  zone: nonEmptyString.max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  active_scanners: z.number().int().min(0).default(1),
  is_active: z.boolean().default(true),
});

export type GateLocation = z.infer<typeof gateLocationSchema>;

export const overstayAlertSchema = z.object({
  threshold_hours: z.number().min(1).max(24).default(13),
  notify_devices: z.boolean().default(true),
});

export type OverstayAlertInput = z.infer<typeof overstayAlertSchema>;
