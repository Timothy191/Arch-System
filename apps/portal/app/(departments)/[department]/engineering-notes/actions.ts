'use server';

import { AuthError, DatabaseError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createEngineeringNote(payload: any) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'createEngineeringNote' },
    });
  }

  const { error } = await supabase.from('engineering_notes').insert(payload);

  if (error) {
    throw new DatabaseError('Failed to create engineering note', {
      operation: 'insert',
      table: 'engineering_notes',
      context: { error: error.message },
    });
  }

  await cacheInvalidateTags(['table:engineering_notes']);
  revalidatePath('/');
  return { success: true };
}
