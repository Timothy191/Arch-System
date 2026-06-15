import type { z } from "zod";
import type {
  uuidSchema,
  dateSchema,
  dateMonthSchema,
  nonEmptyString,
} from "../schemas/common.schema.js";

export type Uuid = z.infer<typeof uuidSchema>;
export type DateString = z.infer<typeof dateSchema>;
export type DateMonthString = z.infer<typeof dateMonthSchema>;
export type NonEmptyString = z.infer<typeof nonEmptyString>;
