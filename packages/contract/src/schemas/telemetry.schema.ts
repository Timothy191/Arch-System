import { z } from "zod";
import { uuidSchema, nonEmptyString } from "./common.schema";

export const telemetryPushSchema = z.object({
  name: nonEmptyString.max(200),
  value: z.union([z.number(), z.string()]),
  timestamp: z.string().datetime().optional(),
  machine_id: uuidSchema.optional(),
  department_id: uuidSchema.optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
});
