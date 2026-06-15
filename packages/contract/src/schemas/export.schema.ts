import { z } from "zod";
import { dateSchema, dateMonthSchema } from "./common.schema.js";

export const exportQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  dept: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const safetyExportQuerySchema = z.object({
  month: dateMonthSchema.optional(),
  dept: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
