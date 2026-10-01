'use server';

import { AuthError, DatabaseError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createDailyLog(payload: any) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'createDailyLog' },
    });
  }

  const { data: logData, error } = await supabase
    .from('daily_logs')
    .insert({
      department_id: payload.departmentId,
      log_date: payload.today,
      shift: payload.shift,
      notes: payload.notes === '' ? null : payload.notes,
    })
    .select('id')
    .single();

  if (error) {
    throw new DatabaseError('Failed to create daily log', {
      operation: 'insert',
      table: 'daily_logs',
      context: { error: error.message },
    });
  }

  if (payload.isProduction && logData) {
    const { error: prodError } = await supabase.from('production_logs').insert({
      daily_log_id: logData.id,
      coal_tonnes: payload.actualCoalTonnes || 0,
      waste_tonnes: payload.actualWasteTonnes || 0,
    });
    if (prodError) {
      throw new DatabaseError('Saved daily log, but failed to save production metrics', {
        operation: 'insert',
        table: 'production_logs',
        context: { error: prodError.message },
      });
    }
  }

  await cacheInvalidateTags(['table:daily_logs']);
  revalidatePath('/');
  return { success: true, id: logData?.id };
}
