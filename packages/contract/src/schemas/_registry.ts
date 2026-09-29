import { z } from 'zod';
export const tableSchemas = {
  audit_log: z.any(),
  outbox_events: z.any(),
  idempotency_keys: z.any(),
} as const;
