'use server';

import { AuthError, DatabaseError, ValidationError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { breakdownShiftDelayHours } from '@/lib/shift-completeness';

const delayEntryInputSchema = z.object({
  id: z.uuid().optional(),
  delay_category_id: z.uuid(),
  delay_start_time: z.iso.datetime({ offset: true }),
  delay_end_time: z.iso.datetime({ offset: true }).nullable().optional(),
  is_manual_override: z.boolean(),
  manual_duration_hours: z.number().min(0).max(12).nullable(),
  description: z.string().max(2000).nullable(),
  status: z.literal('draft').optional(),
});

const saveDelayEntriesBatchSchema = z.object({
  machineOperationId: z.uuid(),
  entries: z.array(delayEntryInputSchema).max(50),
});

type DelayEntryInput = z.infer<typeof delayEntryInputSchema>;

function delayEntryFields(entry: DelayEntryInput) {
  return {
    delay_category_id: entry.delay_category_id,
    delay_start_time: entry.delay_start_time,
    delay_end_time: entry.delay_end_time ?? null,
    is_manual_override: entry.is_manual_override,
    manual_duration_hours: entry.manual_duration_hours,
    description: entry.description,
  };
}

export async function saveDelayEntriesBatch(payload: {
  machineOperationId: string;
  entries: unknown[];
}) {
  const parsed = saveDelayEntriesBatchSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid delay entry payload', {
      context: { issues: parsed.error.issues },
    });
  }
  const { machineOperationId, entries } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'saveDelayEntriesBatch' },
    });
  }

  // Enforce cross-department 12-hour shift cap (Engineering breakdown delay + Control Room delay <= 12.0h)
  const { data: opRow } = await supabase
    .from('machine_operations')
    .select('id, machine_id, shift_date, machine:machines(serial_number, name)')
    .eq('id', machineOperationId)
    .maybeSingle();

  let engineeringDelayHours = 0;
  if (opRow?.machine_id) {
    const rawMachine = Array.isArray((opRow as any).machine)
      ? (opRow as any).machine[0]
      : (opRow as any).machine;
    const fleetKeys = [opRow.machine_id, rawMachine?.serial_number, rawMachine?.name].filter(
      Boolean
    ) as string[];
    const shiftDate = opRow.shift_date || new Date().toISOString().slice(0, 10);
    const { data: breakdowns } = await supabase
      .from('breakdowns')
      .select('fleet_id, reason, delay_hours, date_in, time_in, date_out, time_out, status')
      .in('fleet_id', fleetKeys)
      .or(`status.eq.active,date_in.eq.${shiftDate},date_out.eq.${shiftDate}`);

    for (const b of breakdowns || []) {
      const hrs = breakdownShiftDelayHours(b);
      if (hrs > 0) {
        engineeringDelayHours = Math.min(12, engineeringDelayHours + hrs);
      }
    }
  }

  const controlRoomBatchHours = entries.reduce((sum, entry) => {
    if (entry.is_manual_override && typeof entry.manual_duration_hours === 'number') {
      return sum + entry.manual_duration_hours;
    }
    if (entry.delay_start_time && entry.delay_end_time) {
      const s = new Date(entry.delay_start_time).getTime();
      const e = new Date(entry.delay_end_time).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) {
        return sum + (e - s) / 3600000;
      }
    }
    return sum;
  }, 0);

  if (engineeringDelayHours + controlRoomBatchHours > 12.01) {
    const maxCr = Math.max(0, 12 - engineeringDelayHours);
    throw new DatabaseError(
      `Combined shift delay (${(engineeringDelayHours + controlRoomBatchHours).toFixed(1)}h) exceeds 12.0h shift limit. Engineering logged ${engineeringDelayHours.toFixed(1)}h; Control Room can log at most ${maxCr.toFixed(1)}h.`,
      {
        operation: 'insert',
        table: 'delay_entries',
        context: { engineeringDelayHours, controlRoomBatchHours },
      }
    );
  }

  for (const entry of entries) {
    if (entry.id) {
      const { error } = await supabase
        .from('delay_entries')
        .update(delayEntryFields(entry))
        .eq('id', entry.id)
        .eq('machine_operation_id', machineOperationId);
      if (error) {
        throw new DatabaseError('Failed to update delay entry', {
          operation: 'update',
          table: 'delay_entries',
          context: { error: error.message },
        });
      }
    } else {
      const { error } = await supabase.from('delay_entries').insert({
        machine_operation_id: machineOperationId,
        ...delayEntryFields(entry),
        status: 'draft',
      });
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
