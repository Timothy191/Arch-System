import type { z } from "zod";
import type {
  dailyLogSchema,
  drillingDailyLogSchema,
  dozerRollSchema,
  createBreakdownSchema,
  bookOutSchema,
  directCheckoutSchema,
  monthlyReportInputSchema,
  updateMachineSiteSchema,
} from "../schemas/form.schema.js";

export type DailyLogFormValues = z.infer<typeof dailyLogSchema>;
export type DrillingDailyLogFormValues = z.infer<typeof drillingDailyLogSchema>;
export type DozerRollFormValues = z.infer<typeof dozerRollSchema>;
export type CreateBreakdownInput = z.infer<typeof createBreakdownSchema>;
export type BookOutInput = z.infer<typeof bookOutSchema>;
export type DirectCheckoutInput = z.infer<typeof directCheckoutSchema>;
export type MonthlyReportInput = z.infer<typeof monthlyReportInputSchema>;
export type UpdateMachineSiteInput = z.infer<typeof updateMachineSiteSchema>;
