import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.schema';

export const telemetryPushSchema = z.object({
  name: nonEmptyString.max(200),
  value: z.union([z.number(), z.string()]),
  timestamp: z.string().datetime().optional(),
  machine_id: uuidSchema.optional(),
  department_id: uuidSchema.optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
});

export const tkphAlertSchema = z.object({
  equipment_id: nonEmptyString,
  tkph_value: z.number().min(0),
  threshold_exceeded: z.boolean(),
  timestamp: z.string().datetime().optional(),
  location: z.string().optional(),
});
