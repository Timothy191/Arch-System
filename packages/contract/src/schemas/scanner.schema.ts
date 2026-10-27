import { z } from 'zod';

export const scannerBadgeSchema = z.object({
  code: z.string().min(1).max(256).optional(),
  barcode: z.string().min(1).max(256).optional(),
  barcodeData: z.string().min(1).max(256).optional(),
  data: z.string().min(1).max(256).optional(),
  qr_code: z.string().min(1).max(256).optional(),
  rfid_code: z.string().min(1).max(256).optional(),
  tag: z.string().min(1).max(256).optional(),
  epc: z.string().min(1).max(256).optional(),
  uid: z.string().min(1).max(256).optional(),
  access_type: z.enum(['gate_entry', 'gate_exit', 'boom_entry']).optional(),
  gate_location: z.string().max(100).optional(),
  operator: z.string().max(100).optional(),
  alcohol_tested: z.enum(['Approved', 'Failed', 'Not Tested']).optional(),
  device_id: z.string().max(100).optional(),
  scanner_id: z.string().max(100).optional(),
  direction: z.enum(['IN', 'OUT']).optional(),
  scanned_at: z.union([z.string(), z.number()]).optional(),
});

export const scannerBatchPayloadSchema = z.object({
  scans: z.array(scannerBadgeSchema).min(1).max(100),
});

export const scannerPayloadSchema = z.union([
  scannerBatchPayloadSchema,
  z.array(scannerBadgeSchema).min(1).max(100),
  scannerBadgeSchema,
]);
