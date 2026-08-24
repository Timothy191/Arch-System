import { z } from "zod";
import { uuidSchema, dateSchema, nonEmptyString } from "./common.schema.js";

export const machinePerformanceSchema = z.object({
  machine_id: uuidSchema,
  machine_name: z.string(),
  machine_type: z.string(),
  hours_worked: z.number().nonnegative(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  breakdown_hours: z.number().nonnegative(),
  delay_hours: z.number().nonnegative(),
  mechanical_availability_pct: z.number().min(0).max(100),
});

export const shiftBreakdownSummarySchema = z.object({
  id: uuidSchema,
  machine_id: uuidSchema.nullable().optional(),
  machine_name: z.string(),
  time_in: z.string(),
  time_out: z.string().nullable().optional(),
  reason: z.string(),
  repair_notes: z.string().nullable().optional(),
  status: z.enum(["active", "completed"]),
});

export const shiftTireEventSchema = z.object({
  id: uuidSchema,
  tire_id: uuidSchema,
  serial_number: z.string(),
  machine_name: z.string().nullable().optional(),
  position: z.string(),
  pressure_psi: z.number().nullable().optional(),
  tread_depth_mm: z.number().nullable().optional(),
  condition_status: z.enum(["good", "warning", "critical"]),
  notes: z.string().nullable().optional(),
});

export const unifiedShiftReportSchema = z.object({
  meta: z.object({
    department_id: uuidSchema,
    shift_date: dateSchema,
    shift_type: z.enum(["day", "night"]),
    compiled_at: z.string(),
  }),
  shift_status: z.object({
    id: uuidSchema.optional(),
    status: z.enum(["open", "closed"]).default("open"),
    closed_at: z.string().nullable().optional(),
    closed_by: uuidSchema.nullable().optional(),
    approved_by: uuidSchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
  production: z.object({
    total_loads: z.number().int().nonnegative(),
    machines: z.array(
      z.object({
        machine_id: uuidSchema,
        machine_name: z.string(),
        machine_type: z.string(),
        total_loads: z.number().int().nonnegative(),
        hourly_distribution: z.record(z.string(), z.number()),
      }),
    ),
  }),
  fleet_performance: z.array(machinePerformanceSchema),
  breakdowns: z.array(shiftBreakdownSummarySchema),
  tire_management: z.array(shiftTireEventSchema),
});

export const lockAndSignShiftSchema = z.object({
  departmentId: uuidSchema,
  shiftDate: dateSchema,
  shiftType: z.enum(["day", "night"]),
  notes: z.string().max(2000).optional().nullable(),
  pin: nonEmptyString.max(20),
  approvedById: uuidSchema.optional(),
});
