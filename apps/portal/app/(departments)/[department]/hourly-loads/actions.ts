'use server';

import {
  splitHourlyLoadSchema,
  updateHourlyLoadExcavatorSchema,
  updateMachineSiteSchema,
} from '@repo/contract/schemas/form.schema';
import type { SplitHourlyLoadInput } from '@repo/contract/types/form.types';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';

export async function updateMachineSite(machineId: string, siteId: string | null) {
  // AGENT-TRACE: Validate input parameters with @repo/contract schema
  const validated = updateMachineSiteSchema.parse({ machineId, siteId });

  // Always validate the user at the top
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    throw new Error('Unauthorized');
  }

  // Update machine's site_id using service role client to bypass admin-only update RLS
  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient
    .from('machines')
    .update({ site_id: validated.siteId })
    .eq('id', validated.machineId);

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function updateExcavatorSite(excavatorId: string, siteId: string | null) {
  return updateMachineSite(excavatorId, siteId);
}

export async function updateHourlyLoadExcavator(
  departmentId: string,
  machineId: string,
  loadDate: string,
  shiftType: 'day' | 'night',
  excavatorId: string | null,
  loadId?: string | null
) {
  const validated = updateHourlyLoadExcavatorSchema.parse({
    departmentId,
    machineId,
    loadDate,
    shiftType,
    excavatorId,
  });

  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    throw new Error('Unauthorized');
  }

  const serviceClient = createServiceRoleClient();
  if (loadId && !loadId.startsWith('local-')) {
    const { error } = await serviceClient
      .from('hourly_loads')
      .update({ excavator_id: validated.excavatorId })
      .eq('id', loadId);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await serviceClient
      .from('hourly_loads')
      .update({ excavator_id: validated.excavatorId })
      .eq('department_id', validated.departmentId)
      .eq('machine_id', validated.machineId)
      .eq('load_date', validated.loadDate)
      .eq('shift_type', validated.shiftType);

    if (error) {
      throw error;
    }
  }

  return { success: true };
}

export async function splitMachineHourlyLoad(input: SplitHourlyLoadInput) {
  const validated = splitHourlyLoadSchema.parse(input);

  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    throw new Error('Unauthorized');
  }

  const serviceClient = createServiceRoleClient();
  const prevEndHour = Math.max(1, validated.startHour - 1);

  // 1. Lock previous segment(s)
  if (validated.previousLoadId && !validated.previousLoadId.startsWith('local-')) {
    const { error: lockError } = await serviceClient
      .from('hourly_loads')
      .update({
        is_locked: true,
        end_hour: prevEndHour,
      })
      .eq('id', validated.previousLoadId);

    if (lockError) throw lockError;
  } else {
    const { error: lockAllError } = await serviceClient
      .from('hourly_loads')
      .update({
        is_locked: true,
        end_hour: prevEndHour,
      })
      .eq('department_id', validated.departmentId)
      .eq('machine_id', validated.machineId)
      .eq('load_date', validated.loadDate)
      .eq('shift_type', validated.shiftType);

    if (lockAllError) throw lockAllError;
  }

  // 2. Insert new split segment
  const { data: newLoad, error: insertError } = await serviceClient
    .from('hourly_loads')
    .insert({
      department_id: validated.departmentId,
      machine_id: validated.machineId,
      load_date: validated.loadDate,
      shift_type: validated.shiftType,
      start_hour: validated.startHour,
      end_hour: 12,
      is_locked: false,
      material_type: validated.materialType,
      excavator_id: validated.excavatorId,
      hour_01: 0,
      hour_02: 0,
      hour_03: 0,
      hour_04: 0,
      hour_05: 0,
      hour_06: 0,
      hour_07: 0,
      hour_08: 0,
      hour_09: 0,
      hour_10: 0,
      hour_11: 0,
      hour_12: 0,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return { success: true, newLoad };
}
