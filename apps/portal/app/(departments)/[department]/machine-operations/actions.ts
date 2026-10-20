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

  // Enforce cross-department 12-hour shift cap (Engineering breakdown delay + Control Room delay <= 12.0h)
  const { data: opRow } = await supabase
    .from('machine_operations')
    .select('id, machine_id, shift_date, machine:machines(serial_number, name)')
    .eq('id', payload.machineOperationId)
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
      .select('fleet_id, reason, date_in, time_in, date_out, time_out, status')
      .in('fleet_id', fleetKeys)
      .or(`status.eq.active,date_in.eq.${shiftDate},date_out.eq.${shiftDate}`);

    for (const b of breakdowns || []) {
      const tagMatch = b.reason?.match(/\[Shift Delay:\s*([\d.]+)h\]/i);
      if (tagMatch?.[1]) {
        const parsed = parseFloat(tagMatch[1]);
        if (!Number.isNaN(parsed) && parsed > 0) {
          engineeringDelayHours = Math.min(12, engineeringDelayHours + parsed);
          continue;
        }
      }
      if (b.date_in && b.time_in && b.date_out && b.time_out) {
        const startMs = new Date(`${b.date_in}T${String(b.time_in).slice(0, 8)}`).getTime();
        const endMs = new Date(`${b.date_out}T${String(b.time_out).slice(0, 8)}`).getTime();
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
          engineeringDelayHours = Math.min(
            12,
            engineeringDelayHours + Number(((endMs - startMs) / 3600000).toFixed(2))
          );
        }
      }
    }
  }

  const controlRoomBatchHours = (payload.entries || []).reduce((sum, entry) => {
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
