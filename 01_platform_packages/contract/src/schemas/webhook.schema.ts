import { z } from "zod";
import { uuidSchema } from "./common.schema";

export const createWebhookSchema = z.object({
  url: z.string().url("Must be a valid URL").max(2048, "URL too long"),
  description: z.string().max(500).optional(),
  event_types: z
    .array(z.string().min(1))
    .min(1, "At least one event type required")
    .max(20, "Too many event types"),
  department_id: uuidSchema,
  secret: z.string().min(16, "Secret must be at least 16 chars").optional(),
  active: z.boolean().optional().default(true),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().max(2048).optional(),
  description: z.string().max(500).optional(),
  event_types: z.array(z.string().min(1)).min(1).max(20).optional(),
  active: z.boolean().optional(),
  secret: z.string().min(16).optional(),
});
