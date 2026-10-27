import type { z } from 'zod';
import type {
  scannerBadgeSchema,
  scannerBatchPayloadSchema,
  scannerPayloadSchema,
} from '../schemas/scanner.schema.js';

export type ScannerBadgeInput = z.infer<typeof scannerBadgeSchema>;
export type ScannerBatchPayloadInput = z.infer<typeof scannerBatchPayloadSchema>;
export type ScannerPayloadInput = z.infer<typeof scannerPayloadSchema>;
