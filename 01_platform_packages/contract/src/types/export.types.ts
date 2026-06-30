import type { z } from "zod";
import type { exportQuerySchema, safetyExportQuerySchema } from "../schemas/export.schema";

export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
export type SafetyExportQueryInput = z.infer<typeof safetyExportQuerySchema>;
