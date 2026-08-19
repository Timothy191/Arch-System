import type { z } from "zod";
import type {
  tireSchema,
  tireInspectionSchema,
  createTireSchema,
  logTireInspectionSchema,
  replaceTireSchema,
  tireStatusSchema,
  tireConditionSchema,
} from "../schemas/tire-management.schema.js";

export type Tire = z.infer<typeof tireSchema>;
export type TireInspection = z.infer<typeof tireInspectionSchema>;
export type CreateTireInput = z.infer<typeof createTireSchema>;
export type LogTireInspectionInput = z.infer<typeof logTireInspectionSchema>;
export type ReplaceTireInput = z.infer<typeof replaceTireSchema>;
export type TireStatus = z.infer<typeof tireStatusSchema>;
export type TireCondition = z.infer<typeof tireConditionSchema>;
