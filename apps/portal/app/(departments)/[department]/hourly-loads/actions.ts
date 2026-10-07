'use server';

import {
  saveHourlyLoadSchema,
  splitHourlyLoadSchema,
  updateHourlyLoadExcavatorSchema,
  updateMachineSiteSchema,
} from '@repo/contract/schemas/form.schema';
import type { SaveHourlyLoadInput, SplitHourlyLoadInput } from '@repo/contract/types/form.types';
import { cacheInvalidateTags } from '@repo/redis';
import { type EmployeeSummary, getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';

function assertDepartmentAccess(
  employee: EmployeeSummary | null | undefined,
  departmentId: string,
  allowedRoles: readonly string[]
): asserts employee is EmployeeSummary {
  if (
    !employee ||
    !allowedRoles.includes(employee.role) ||
    (employee.role !== 'admin' &&
      employee.department_id !== departmentId &&
      !employee.accessible_departments?.includes(departmentId))
  ) {
    throw new Error('Not authorized for this Control Room operation');
  }
}

export async function updateMachineSite(machineId: string, siteId: string | null) {
  // AGENT-TRACE: Validate input parameters with @repo/contract schema
  const validated = updateMachineSiteSchema.parse({ machineId, siteId });

  // Always validate the user at the top
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    throw new Error('Unauthorized');
  }

  const serviceClient = createServiceRoleClient();
  const { data: machine, error: machineError } = await serviceClient
    .from('machines')
    .select('department_id')
    .eq('id', validated.machineId)
    .maybeSingle();
  if (machineError) throw machineError;
  if (!machine) throw new Error('Machine not found');
  assertDepartmentAccess(principal.employee, machine.department_id, ['admin', 'supervisor']);

  if (validated.siteId) {
    const { data: site, error: siteError } = await serviceClient
      .from('sites')
      .select('id')
      .eq('id', validated.siteId)
      .eq('active', true)
      .maybeSingle();
    if (siteError) throw siteError;
    if (!site) throw new Error('Active site not found');
  }

  // Use the service client only after checking the machine's owning department and role.
  const { error } = await serviceClient
    .from('machines')
    .update({ site_id: validated.siteId })
    .eq('id', validated.machineId)
    .eq('department_id', machine.department_id);

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
  assertDepartmentAccess(principal.employee, validated.departmentId, [
    'admin',
    'operator',
    'supervisor',
  ]);

  const serviceClient = createServiceRoleClient();
  if (loadId && !loadId.startsWith('local-')) {
    const { data, error } = await serviceClient
      .from('hourly_loads')
      .update({ excavator_id: validated.excavatorId })
      .eq('id', loadId)
      .eq('department_id', validated.departmentId)
      .eq('machine_id', validated.machineId)
      .eq('load_date', validated.loadDate)
      .eq('shift_type', validated.shiftType)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error('Hourly load not found for the selected department, machine, date and shift');
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
  assertDepartmentAccess(principal.employee, validated.departmentId, [
    'admin',
    'operator',
    'supervisor',
  ]);

  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient.rpc('atomic_split_hourly_load', {
    p_department_id: validated.departmentId,
    p_machine_id: validated.machineId,
    p_load_date: validated.loadDate,
    p_shift_type: validated.shiftType,
    p_start_hour: validated.startHour,
    p_excavator_id: validated.excavatorId,
    p_material_type: validated.materialType,
    p_previous_load_id:
      validated.previousLoadId && !validated.previousLoadId.startsWith('local-')
        ? validated.previousLoadId
        : null,
  });

  if (error) throw error;
  const newLoad = data?.[0];
  if (!newLoad) {
    throw new Error('Hourly-load split RPC returned no new segment');
  }

  return { success: true, newLoad };
}

export async function saveHourlyLoad(input: SaveHourlyLoadInput) {
  const validated = saveHourlyLoadSchema.parse(input);

  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    throw new Error('Unauthorized');
  }
  assertDepartmentAccess(principal.employee, validated.departmentId, [
    'admin',
    'operator',
    'supervisor',
  ]);

  const serviceClient = createServiceRoleClient();

  const cleanPatch: Record<string, unknown> = {};
  for (let i = 1; i <= 12; i++) {
    const prop = `hour_${i.toString().padStart(2, '0')}` as keyof typeof validated.patch;
    if (validated.patch[prop] !== undefined) {
      cleanPatch[prop] = validated.patch[prop];
    }
  }
  if (validated.patch.material_type !== undefined) {
    cleanPatch.material_type = validated.patch.material_type;
  }
  if ('excavator_id' in validated.patch) {
    cleanPatch.excavator_id = validated.patch.excavator_id ? validated.patch.excavator_id : null;
  }
  cleanPatch.updated_by = principal.employee.id;
  cleanPatch.updated_at = new Date().toISOString();

  // 1. If an existing load ID is provided and is not a local virtual placeholder, update the row
  if (validated.loadId && !validated.loadId.startsWith('local-')) {
    const { data: updated, error: updateError } = await serviceClient
      .from('hourly_loads')
      .update(cleanPatch)
      .eq('id', validated.loadId)
      .eq('department_id', validated.departmentId)
      .eq('machine_id', validated.machineId)
      .eq('load_date', validated.loadDate)
      .eq('shift_type', validated.shiftType)
      .select('*')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) {
      throw new Error('Hourly load not found for the selected department, machine, date and shift');
    }

    try {
      await cacheInvalidateTags(['table:hourly_loads', `dept:${validated.departmentId}`]);
    } catch {
      // Best-effort cache invalidation
    }

    return { success: true, load: updated };
  }

  // 2. If loadId is virtual or missing, check if an unlocked record already exists
  const { data: existingRows, error: findError } = await serviceClient
    .from('hourly_loads')
    .select('*')
    .eq('department_id', validated.departmentId)
    .eq('machine_id', validated.machineId)
    .eq('load_date', validated.loadDate)
    .eq('shift_type', validated.shiftType)
    .eq('is_locked', false)
    .order('start_hour', { ascending: true });

  if (findError) throw findError;

  if (existingRows && existingRows.length > 0) {
    const target = existingRows[0];
    const { data: updated, error: updateError } = await serviceClient
      .from('hourly_loads')
      .update(cleanPatch)
      .eq('id', target.id)
      .eq('department_id', validated.departmentId)
      .eq('load_date', validated.loadDate)
      .select('*')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) {
      throw new Error('Failed to update existing hourly load record');
    }

    try {
      await cacheInvalidateTags(['table:hourly_loads', `dept:${validated.departmentId}`]);
    } catch {
      // Best-effort cache invalidation
    }

    return { success: true, load: updated };
  }

  // 3. No record exists yet. Resolve or create daily_logs parent record to satisfy foreign key fk_hourly_loads_daily_log
  let dailyLogId: string;
  const { data: existingDailyLog, error: dailyLogError } = await serviceClient
    .from('daily_logs')
    .select('id, log_date')
    .eq('department_id', validated.departmentId)
    .eq('log_date', validated.loadDate)
    .eq('shift', validated.shiftType)
    .maybeSingle();

  if (dailyLogError) throw dailyLogError;

  if (existingDailyLog) {
    dailyLogId = existingDailyLog.id;
  } else {
    const { data: newDailyLog, error: createLogErr } = await serviceClient
      .from('daily_logs')
      .insert({
        department_id: validated.departmentId,
        log_date: validated.loadDate,
        shift: validated.shiftType,
        created_by: principal.employee.id,
        notes: null,
      })
      .select('id, log_date')
      .single();

    if (createLogErr) {
      const { data: retryLog, error: retryErr } = await serviceClient
        .from('daily_logs')
        .select('id, log_date')
        .eq('department_id', validated.departmentId)
        .eq('log_date', validated.loadDate)
        .eq('shift', validated.shiftType)
        .maybeSingle();

      if (retryErr || !retryLog) {
        throw createLogErr;
      }
      dailyLogId = retryLog.id;
    } else {
      dailyLogId = newDailyLog.id;
    }
  }

  // 4. Insert new hourly_loads record with all required columns and foreign keys
  const insertPayload = {
    department_id: validated.departmentId,
    machine_id: validated.machineId,
    load_date: validated.loadDate,
    shift_type: validated.shiftType,
    daily_log_id: dailyLogId,
    daily_log_date: validated.loadDate,
    start_hour: 1,
    end_hour: 12,
    is_locked: false,
    material_type: (cleanPatch.material_type as string) ?? 'Waste',
    excavator_id: (cleanPatch.excavator_id as string | null) ?? null,
    created_by: principal.employee.id,
    updated_by: principal.employee.id,
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
    ...cleanPatch,
  };

  const { data: inserted, error: insertError } = await serviceClient
    .from('hourly_loads')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) throw insertError;

  try {
    await cacheInvalidateTags([
      'table:hourly_loads',
      'table:daily_logs',
      `dept:${validated.departmentId}`,
    ]);
  } catch {
    // Best-effort cache invalidation
  }

  return { success: true, load: inserted };
}
