'use server';

import { dozerRollSchema } from '@repo/contract';
import { AuthError, DatabaseError, ValidationError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// AGENT-TRACE: The form additionally captures the worked area dimensions for
// the notes column. Everything else is the canonical contract schema.
const createDozerRollSchema = dozerRollSchema.extend({
  lengthM: z.number().min(0).max(10_000).optional(),
  widthM: z.number().min(0).max(10_000).optional(),
});

export async function createDozerRoll(payload: unknown) {
  const supabase = await createServerSupabaseClient();

  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal) {
    throw new AuthError('Unauthorized', {
      context: { action: 'createDozerRoll' },
    });
  }

  const parsed = createDozerRollSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid dozer roll payload', {
      context: {
        action: 'createDozerRoll',
        issues: parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
      },
    });
  }

  const roll = parsed.data;

  const { error: insertError } = await supabase.from('dozer_rolls').insert({
    department_id: roll.departmentId,
    machine_id: roll.machineId,
    roll_date: roll.today,
    shift_type: roll.shiftType,
    blade_passes: roll.bladePasses,
    push_count: roll.pushCount,
    hours_operated: roll.hoursOperated,
    area_covered_sqm: roll.area,
    notes:
      roll.lengthM !== undefined && roll.widthM !== undefined
        ? `Length: ${roll.lengthM}m, Width: ${roll.widthM}m`
        : null,
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
