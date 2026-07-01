import type { z } from "zod";
import type { createWebhookSchema, updateWebhookSchema } from "../schemas/webhook.schema";

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
