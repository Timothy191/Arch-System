import { z } from 'zod';

export const scadaTelemetryTagsSchema = z.object({
  id: z.string().uuid(),
  tag_id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  department_id: z.string().uuid().nullable().optional(),
  equipment: z.string().max(200).nullable().optional(),
  source_protocol: z.enum(['OPC-UA', 'Modbus-TCP', 'Modbus-RTU', 'MQTT', 'REST']),
  node_id: z.string().max(200).nullable().optional(),
  register_address: z.string().max(120).nullable().optional(),
  data_type: z.string().max(40).default('FLOAT32'),
  unit: z.string().max(40).nullable().optional(),
  base_value: z.number().nullable().optional(),
  variance: z.number().default(0),
  polling_rate_hz: z.number().default(1),
  quality: z.string().max(40).default('GOOD (0x00)'),
  active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});
export type ScadaTelemetryTags = z.infer<typeof scadaTelemetryTagsSchema>;

export const scadaTelemetryReadingsSchema = z.object({
  id: z.string().uuid().optional(),
  tag_id: z.string().min(1).max(120),
  value: z.number(),
  quality: z.string().max(40).default('GOOD (0x00)'),
  recorded_at: z.string().datetime().optional(),
});
export type ScadaTelemetryReadings = z.infer<typeof scadaTelemetryReadingsSchema>;
