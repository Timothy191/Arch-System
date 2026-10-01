'use server';

import { AuthError, DatabaseError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { logAuditEvent } from '@repo/shared/data-access';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveDelayEntriesBatch(payload: {
  machineOperationId: string;
  entries: any[];
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'saveDelayEntriesBatch' },
    });
  }

  for (const entry of payload.entries) {
    if (entry.id) {
      const { error } = await supabase.from('delay_entries').update(entry).eq('id', entry.id);
      if (error) {
        throw new DatabaseError('Failed to update delay entry', {
          operation: 'update',
          table: 'delay_entries',
          context: { error: error.message },
        });
      }
    } else {
      const { error } = await supabase.from('delay_entries').insert(entry);
      if (error) {
        throw new DatabaseError('Failed to insert delay entry', {
          operation: 'insert',
          table: 'delay_entries',
          context: { error: error.message },
        });
      }
    }
  }

  await cacheInvalidateTags(['table:delay_entries']);
  revalidatePath('/'); // or specific path
  return { success: true };
}
