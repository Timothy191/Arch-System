'use server';

import {
  type SaveMonthlyMachineSnapshotInput,
  saveMonthlyMachineSnapshotInputSchema,
} from '@repo/contract';
import { AuthError, DatabaseError, ValidationError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveMonthlyMachineSnapshotAction(input: SaveMonthlyMachineSnapshotInput) {
  const parsed = saveMonthlyMachineSnapshotInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid snapshot payload');
  }

  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    throw new AuthError('Unauthorized — active employee session required');
  }

  const supabase = await createServerSupabaseClient();
  const data = parsed.data;

  const { error } = await supabase.from('monthly_machine_snapshots').upsert(
    {
      department_id: data.departmentId,
      month: data.month,
      shift_type: data.shiftType,
      machine_count: data.machineCount,
      total_smr_worked: data.totalSmrWorked,
      fleet_availability_percent: data.fleetAvailabilityPercent,
      fleet_utilization_percent: data.fleetUtilizationPercent,
      total_breakdown_hours: data.totalBreakdownHours,
      is_sealed: data.isSealed,
      sealed_at: new Date().toISOString(),
      sealed_by: principal.employee?.id ?? principal.user.id,
      records: data.records as unknown,
      summaries: data.summaries as unknown,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'department_id,month,shift_type' }
  );

  if (error) {
    throw new DatabaseError(`Failed to persist monthly snapshot: ${error.message}`);
  }

  await cacheInvalidateTags([`dept:${data.departmentId}:reports`]);
  revalidatePath('/[department]/reports', 'page');

  return { success: true, month: data.month };
}

export async function getMonthlyMachineSnapshotsAction(departmentId: string) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    throw new AuthError('Unauthorized — active employee session required');
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('monthly_machine_snapshots')
    .select('*')
    .eq('department_id', departmentId)
    .order('month', { ascending: false });

  if (error) {
    throw new DatabaseError(`Failed to fetch monthly snapshots: ${error.message}`);
  }

  return { success: true, snapshots: data ?? [] };
}
