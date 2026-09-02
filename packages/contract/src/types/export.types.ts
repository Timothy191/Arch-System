import type { z } from "zod";
import type { exportQuerySchema } from "../schemas/export.schema.js";

export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
