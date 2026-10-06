import { z } from 'zod';

export const offlineMutationHlcSchema = z
  .object({
    wall: z.number().int().nonnegative().safe(),
    counter: z.number().int().nonnegative().max(2_147_483_647),
    node: z.string().trim().min(1).max(128),
  })
  .strict();

export const offlineSmrMutationSchema = z
  .object({
    id: z.string().uuid(),
    hlc: offlineMutationHlcSchema,
    entity: z.literal('smr'),
    entityId: z.string().trim().min(1).max(128),
    op: z.literal('smr.update'),
    payload: z
      .object({
        meterId: z.string().trim().min(1).max(128),
        reading: z.number().finite().nonnegative(),
        readingAt: z.string().datetime(),
        deviceId: z.string().trim().min(1).max(128),
      })
      .strict(),
  })
  .strict();

export const offlineMutationBatchSchema = z
  .object({
    clientHlc: offlineMutationHlcSchema,
    mutations: z.array(offlineSmrMutationSchema).min(1).max(500),
  })
  .strict();

export type OfflineMutationHlc = z.infer<typeof offlineMutationHlcSchema>;
export type OfflineSmrMutation = z.infer<typeof offlineSmrMutationSchema>;
export type OfflineMutationBatch = z.infer<typeof offlineMutationBatchSchema>;
