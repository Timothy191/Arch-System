import type { z } from "zod";
import type {
  adminAddSiteSchema,
  adminDataDeleteSchema,
  adminDataQuerySchema,
  adminDataUpdateSchema,
  adminUpdateSiteSchema,
} from "../schemas/admin.schema.js";

export type AdminDataQueryInput = z.infer<typeof adminDataQuerySchema>;
export type AdminDataUpdateInput = z.infer<typeof adminDataUpdateSchema>;
export type AdminDataDeleteInput = z.infer<typeof adminDataDeleteSchema>;
export type AdminAddSiteInput = z.infer<typeof adminAddSiteSchema>;
export type AdminUpdateSiteInput = z.infer<typeof adminUpdateSiteSchema>;
