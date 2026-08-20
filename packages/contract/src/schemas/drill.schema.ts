import { z } from "zod";
import { uuidSchema, dateSchema } from "./common.schema.js";

// AGENT-TRACE: Zod schema for drill operations daily shift record
export const drillOperationSchema = z.object({
  id: uuidSchema.optional(),
  machine_id: uuidSchema,
  department_id: uuidSchema,
  operation_date: dateSchema,
  shift_type: z.enum(["day", "night"]),
  open_hours: z.number().min(0).max(99999).nullable().optional(),
  close_hours: z.number().min(0).max(99999).nullable().optional(),
  operator_name: z.string().max(255).nullable().optional(),
  block_drilled: z.string().max(255).nullable().optional(),
  site: z.string().max(255).nullable().optional(),
  holes: z.number().int().min(0).optional(),
  meters_drilled: z.number().min(0).optional(),

  // Granular Delays (in minutes)
  delay_blasting: z.number().min(0).optional(),
  delay_no_operator: z.number().min(0).optional(),
  delay_natural: z.number().min(0).optional(),
  delay_lunch_breaks: z.number().min(0).optional(),
  delay_safety_talks: z.number().min(0).optional(),
  delay_tramming: z.number().min(0).optional(),
  delay_non_prod_other: z.number().min(0).optional(),
  delay_get: z.number().min(0).optional(),
  delay_maintenance: z.number().min(0).optional(),
  delay_mech_breakdown: z.number().min(0).optional(),
  delay_elec_breakdown: z.number().min(0).optional(),

  // Generic / legacy delay fields
  external_delays_minutes: z.number().min(0).nullable().optional(),
  standard_delays_hours: z.number().min(0).nullable().optional(),
  production_delays_minutes: z.number().min(0).nullable().optional(),
  engineering_delays_minutes: z.number().min(0).nullable().optional(),

  comments: z.string().max(2000).nullable().optional(),
  status: z.enum(["active", "completed", "cancelled", "maintenance"]).optional(),
});

export type DrillOperationInput = z.infer<typeof drillOperationSchema>;

// AGENT-TRACE: Zod schema for drill rig telemetry ingestion
export const drillTelemetryIngestSchema = z.object({
  machine_id: uuidSchema,
  engine_rpm: z.number().min(0).max(6000).optional(),
  engine_temp: z.number().min(-50).max(250).optional(),
  hydraulic_pressure: z.number().min(0).max(60000).optional(),
  vibration_level: z.number().min(0).max(100).optional(),
  fuel_level: z.number().min(0).max(100).optional(),
  bit_depth: z.number().min(0).max(1000).optional(),
  penetration_rate: z.number().min(0).max(500).optional(),
  pull_down_force: z.number().min(0).max(100000).optional(),
  rotary_speed: z.number().min(0).max(1000).optional(),
  timestamp: z.string().optional(),
});

export type DrillTelemetryIngestInput = z.infer<typeof drillTelemetryIngestSchema>;
