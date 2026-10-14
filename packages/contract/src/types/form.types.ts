import type { z } from 'zod';
import type {
  bookOutSchema,
  createBreakdownSchema,
  dailyLogSchema,
  directCheckoutSchema,
  dozerRollSchema,
  drillingDailyLogSchema,
  monthlyReportInputSchema,
  productionDailyLogSchema,
  saveExcavatorActivitySchema,
  saveHourlyLoadSchema,
  splitHourlyLoadSchema,
  updateExcavatorAssignmentConfigSchema,
  updateHourlyLoadExcavatorSchema,
  updateMachineSiteSchema,
} from '../schemas/form.schema.js';

export type DailyLogFormValues = z.infer<typeof dailyLogSchema>;
export type DrillingDailyLogFormValues = z.infer<typeof drillingDailyLogSchema>;
export type ProductionDailyLogFormValues = z.infer<typeof productionDailyLogSchema>;
export type DozerRollFormValues = z.infer<typeof dozerRollSchema>;
export type CreateBreakdownInput = z.infer<typeof createBreakdownSchema>;
export type BookOutInput = z.infer<typeof bookOutSchema>;
export type DirectCheckoutInput = z.infer<typeof directCheckoutSchema>;
export type MonthlyReportInput = z.infer<typeof monthlyReportInputSchema>;
export type UpdateMachineSiteInput = z.infer<typeof updateMachineSiteSchema>;
export type UpdateHourlyLoadExcavatorInput = z.infer<typeof updateHourlyLoadExcavatorSchema>;
export type SplitHourlyLoadInput = z.infer<typeof splitHourlyLoadSchema>;
export type SaveHourlyLoadInput = z.infer<typeof saveHourlyLoadSchema>;
export type SaveExcavatorActivityInput = z.infer<typeof saveExcavatorActivitySchema>;
export type UpdateExcavatorAssignmentConfigInput = z.infer<
  typeof updateExcavatorAssignmentConfigSchema
>;
