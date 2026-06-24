import type { z } from "zod";
import type { dailyLogSchema, dozerRollSchema } from "../schemas/form.schema.js";

export type DailyLogFormValues = z.infer<typeof dailyLogSchema>;
export type DozerRollFormValues = z.infer<typeof dozerRollSchema>;
