import type { z } from "zod";
import type {
  dailyLogSchema,
  drillingDailyLogSchema,
  dozerRollSchema,
} from "../schemas/form.schema.js";

export type DailyLogFormValues = z.infer<typeof dailyLogSchema>;
export type DrillingDailyLogFormValues = z.infer<typeof drillingDailyLogSchema>;
export type DozerRollFormValues = z.infer<typeof dozerRollSchema>;
