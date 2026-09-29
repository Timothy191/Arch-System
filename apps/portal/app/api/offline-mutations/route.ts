import { createServerSupabaseClient } from '@repo/supabase/server';
import { z } from 'zod';

const HlcSchema = z.object({
  wall: z.number().int(),
  counter: z.number().int(),
  node: z.string().min(1),
});

const MutationSchema = z.object({
  id: z.string().uuid(),
  hlc: HlcSchema,
  entity: z.literal('smr'),
  entityId: z.string(),
  op: z.literal('smr.update'),
  payload: z.object({
    meterId: z.string(),
    reading: z.number(),
    readingAt: z.string().datetime(),
    deviceId: z.string(),
  }),
});

const BodySchema = z.object({
  clientHlc: HlcSchema,
  mutations: z.array(MutationSchema),
});

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const body = BodySchema.parse(await req.json());

    // Execute atomic stored procedure with tenant context
    const { data, error } = await supabase.rpc('apply_offline_mutations', {
      p_tenant: '00000000-0000-0000-0000-000000000000',
      p_mutations: body.mutations,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data ?? { ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid offline mutation batch';
    return Response.json({ error: message }, { status: 400 });
  }
}
