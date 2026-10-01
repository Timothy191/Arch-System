'use server';

import { AuthError, DatabaseError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { logAuditEvent } from '@repo/shared/data-access';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createDozerRoll(payload: any) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'createDozerRoll' },
    });
  }

  const { error: insertError } = await supabase.from('dozer_rolls').insert({
    department_id: payload.departmentId,
    machine_id: payload.machineId,
    roll_date: payload.today,
    shift_type: payload.shiftType,
    blade_passes: payload.bladePasses,
    push_count: payload.pushCount,
    hours_operated: payload.hoursOperated,
    area_covered_sqm: payload.area,
    notes: `Length: ${payload.lengthM}m, Width: ${payload.widthM}m`,
  });

  if (insertError) {
    throw new DatabaseError('Failed to create dozer roll', {
      operation: 'insert',
      table: 'dozer_rolls',
      context: { error: insertError.message },
    });
  }

  await cacheInvalidateTags(['table:dozer_rolls']);
  revalidatePath('/'); // Revalidate all since it might be accessed from various places
  return { success: true };
}
