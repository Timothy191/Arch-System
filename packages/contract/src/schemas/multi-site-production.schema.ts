import { z } from "zod";

export const operationalStatusEnum = z.enum([
  "ACTIVE",
  "STANDBY",
  "BREAKDOWN",
  "BREDELL",
  "NO_OPERATOR",
  "NO_SPACE",
  "OFFSITE",
]);

export const truckTallySchema = z.object({
  truck_id: z.string().uuid(),
  truck_name: z.string(),
  loads: z.number().int().nonnegative(),
});

export const excavatorHaulSchema = z.object({
  excavator_id: z.string().uuid(),
  excavator_name: z.string(),
  operator_name: z.string(),
  material_type: z.string(),
  block_id: z.string(),
  operating_hours: z.number().nonnegative(),
  delays: z.string().nullable().optional(),
  total_loads: z.number().int().nonnegative(),
  total_bcm: z.number().nonnegative(),
  total_tonnes: z.number().nonnegative(),
  rate_per_hour: z.number().nonnegative(),
  trucks: z.array(truckTallySchema),
});

export const dozerRolloverEntrySchema = z.object({
  machine_id: z.string().uuid(),
  machine_name: z.string(),
  operator_name: z.string().nullable().optional(),
  start_smu: z.number(),
  end_smu: z.number(),
  hours: z.number().nonnegative(),
  push_factor: z.number(),
  total_bcm: z.number().nonnegative(),
});

export const fleetSmuEntrySchema = z.object({
  machine_id: z.string().uuid(),
  machine_name: z.string(),
  machine_type: z.string(),
  start_smu: z.number().nullable().optional(),
  end_smu: z.number().nullable().optional(),
  hours_worked: z.number().nonnegative(),
  operator_name: z.string().nullable().optional(),
  operational_status: operationalStatusEnum,
  notes: z.string().nullable().optional(),
});

export const breakdownReportEntrySchema = z.object({
  id: z.string().uuid(),
  machine_id: z.string().uuid().nullable().optional(),
  machine_name: z.string(),
  site_code: z.string(),
  duration_hours: z.number().nonnegative(),
  reason: z.string(),
  repair_notes: z.string().nullable().optional(),
  is_operational_defect: z.boolean(),
  status: z.enum(["active", "completed"]),
});

export const ancillaryReportEntrySchema = z.object({
  machine_name: z.string(),
  site_code: z.string(),
  activity_type: z.string(),
  trip_loads: z.number().int().optional(),
  fuel_liters: z.number().optional(),
  notes: z.string().nullable().optional(),
});

export const bredellReportEntrySchema = z.object({
  machine_name: z.string(),
  reason: z.string(),
  date_in: z.string(),
});

export const multiSiteShiftReportSchema = z.object({
  meta: z.object({
    department_id: z.string().uuid(),
    shift_date: z.string(),
    shift_type: z.enum(["day", "night"]),
    status: z.enum(["open", "closed"]),
    closed_at: z.string().nullable().optional(),
    closed_by: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
  production: z.record(z.string(), z.array(excavatorHaulSchema)), // Keyed by 'BKF', 'EXT', etc.
  rollover: z.object({
    total_bcm: z.number().nonnegative(),
    entries: z.array(dozerRolloverEntrySchema),
  }),
  fleet_smu: z.record(z.string(), z.array(fleetSmuEntrySchema)), // Keyed by 'BKF', 'EXT', 'PLANT'
  ancillary: z.array(ancillaryReportEntrySchema),
  breakdowns: z.array(breakdownReportEntrySchema),
  bredell_workshop: z.array(bredellReportEntrySchema),
});

export type MultiSiteShiftReportInput = z.infer<typeof multiSiteShiftReportSchema>;
