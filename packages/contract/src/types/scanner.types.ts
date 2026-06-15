import type { z } from "zod";
import type { scannerBadgeSchema } from "../schemas/scanner.schema.js";

export type ScannerBadgeInput = z.infer<typeof scannerBadgeSchema>;
