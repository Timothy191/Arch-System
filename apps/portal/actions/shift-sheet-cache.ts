'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const inputSchema = z.object({
  departmentId: z.uuid(),
  wroteDozerRolls: z.boolean().optional(),
  wroteDelayEntries: z.boolean().optional(),
});

/** Best-effort cache clear after a client-side machine_operations or delay_entries write. */
export async function invalidateShiftSheetCache(input: {
  departmentId: string;
  wroteDozerRolls?: boolean;
  wroteDelayEntries?: boolean;
}): Promise<void> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const tags = ['table:machine_operations', `dept:${parsed.data.departmentId}`];
  if (parsed.data.wroteDozerRolls) tags.push('table:dozer_rolls');
  if (parsed.data.wroteDelayEntries) tags.push('table:delay_entries');

  await cacheInvalidateTags(tags);
  revalidatePath('/');
}
