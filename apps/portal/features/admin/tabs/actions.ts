'use server';

import { AuthError, DatabaseError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createDepartment(payload: any) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'createDepartment' },
    });
  }

  const { error } = await supabase.from('departments').insert(payload);

  if (error) {
    throw new DatabaseError('Failed to create department', {
      operation: 'insert',
      table: 'departments',
      context: { error: error.message },
    });
  }

  await cacheInvalidateTags(['table:departments']);
  revalidatePath('/admin');
  return { success: true };
}
