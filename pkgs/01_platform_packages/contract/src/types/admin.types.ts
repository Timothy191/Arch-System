import type { z } from "zod";
import type {
  adminDataQuerySchema,
  adminDataUpdateSchema,
  adminDataDeleteSchema,
} from "../schemas/admin.schema";

export type AdminDataQueryInput = z.infer<typeof adminDataQuerySchema>;
export type AdminDataUpdateInput = z.infer<typeof adminDataUpdateSchema>;
export type AdminDataDeleteInput = z.infer<typeof adminDataDeleteSchema>;
