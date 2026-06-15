import { z } from "zod";
import { uuidSchema, dateSchema, nonEmptyString } from "./common.schema.js";

export const shiftCompletenessSchema = z.object({
  deptId: uuidSchema,
  deptSlug: nonEmptyString.max(100),
  date: dateSchema,
  shift: z.enum(["day", "night"]),
});
