'use server';

import {
  saveHourlyLoadSchema,
  splitHourlyLoadSchema,
  updateExcavatorAssignmentConfigSchema,
  updateHourlyLoadExcavatorSchema,
  updateMachineSiteSchema,
} from '@repo/contract/schemas/form.schema';
import type {
  SaveHourlyLoadInput,
  SplitHourlyLoadInput,
  UpdateExcavatorAssignmentConfigInput,
} from '@repo/contract/types/form.types';
import { cacheInvalidateTags } from '@repo/redis';
import { type EmployeeSummary, getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import {
  deriveExcavatorDumperAssignments,
  formatExcavatorMaterial,
  type HourlyShift,
  parseExcavatorMaterial,
} from './loads-utils';

export async function syncExcavatorActivityFromHourlyLoads(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  params: {
    departmentId: string;
    excavatorId: string;
    loadDate: string;
    shiftType: HourlyShift;
  }
) {
  const { departmentId, excavatorId, loadDate, shiftType } = params;
  if (!excavatorId) return;

  const { data: assignedLoads, error: loadsError } = await serviceClient
    .from('hourly_loads')
    .select('id, machine_id, material_type, shift_type, excavator_id, total_loads')
    .eq('department_id', departmentId)
    .eq('load_date', loadDate)
    .eq('shift_type', shiftType)
    .eq('excavator_id', excavatorId);

  if (loadsError || !assignedLoads) return;

  const { data: existingActivities } = await serviceClient
    .from('excavator_activity')
    .select('id, site_id, block_mined_id, material_type, operator_id')
    .eq('department_id', departmentId)
    .eq('machine_id', excavatorId)
    .eq('activity_date', loadDate)
    .eq('shift_type', shiftType)
    .order('created_at', { ascending: false });

  const existingActivity = existingActivities?.[0] ?? null;

  if (assignedLoads.length === 0) {
    if (existingActivity) {
      await serviceClient
        .from('excavator_dumper_assignments')
        .delete()
        .eq('excavator_activity_id', existingActivity.id);
      await serviceClient
        .from('excavator_activity')
        .update({ loads: 0 })
        .eq('id', existingActivity.id);
    }
    return;
  }

  const machineIds = Array.from(new Set([excavatorId, ...assignedLoads.map((l) => l.machine_id)]));
  const { data: machinesData } = await serviceClient
    .from('machines')
    .select('id, name, bin_factor, site_id')
    .in('id', machineIds);

  const excavatorMachine = machinesData?.find((m) => m.id === excavatorId);
  const derivedRows = deriveExcavatorDumperAssignments(
    assignedLoads,
    machinesData ?? [],
    excavatorId,
    shiftType
  );
  const totalExcavatorLoads = derivedRows.reduce((sum, r) => sum + r.totalLoads, 0);
  const effectiveMaterial =
    existingActivity?.material_type ?? assignedLoads[0]?.material_type ?? 'Waste';

  let activityId = existingActivity?.id ?? null;

  if (activityId) {
    await serviceClient
      .from('excavator_activity')
      .update({
        loads: totalExcavatorLoads,
        site_id: existingActivity?.site_id ?? excavatorMachine?.site_id ?? null,
        block_mined_id: existingActivity?.block_mined_id ?? null,
        material_type: effectiveMaterial,
      })
      .eq('id', activityId);
  } else {
    let operatorId: string | null = null;
    let opSiteId: string | null = excavatorMachine?.site_id ?? null;
    try {
      const { data: machineOps } = await serviceClient
        .from('machine_operations')
        .select('operator_id, site_id')
        .eq('department_id', departmentId)
        .eq('machine_id', excavatorId)
        .eq('shift_date', loadDate)
        .eq('shift_type', shiftType)
        .order('created_at', { ascending: false });
      if (machineOps?.[0]) {
        operatorId = machineOps[0].operator_id ?? null;
        opSiteId = machineOps[0].site_id ?? opSiteId;
      }
    } catch {
      // Optional operator lookup from machine_operations
    }

    const { data: insertedActivity, error: insertActivityErr } = await serviceClient
      .from('excavator_activity')
      .insert({
        department_id: departmentId,
        machine_id: excavatorId,
        operator_id: operatorId,
        activity_date: loadDate,
        shift_type: shiftType,
        site_id: opSiteId,
        material_type: effectiveMaterial,
        passes: 0,
        loads: totalExcavatorLoads,
      })
      .select('id')
      .single();

    if (insertActivityErr || !insertedActivity) return;
    activityId = insertedActivity.id;
  }

  await serviceClient
    .from('excavator_dumper_assignments')
    .delete()
    .eq('excavator_activity_id', activityId);

  if (derivedRows.length > 0) {
    await serviceClient.from('excavator_dumper_assignments').insert(
      derivedRows.map((row) => ({
        excavator_activity_id: activityId,
        dumper_machine_id: row.dumperMachineId,
        material_type: row.materialType,
        total_loads: row.totalLoads,
        total_bcm: row.totalBcm || null,
      }))
    );
  }

  try {
    await cacheInvalidateTags([
      'table:excavator_activity',
      'table:excavator_dumper_assignments',
      `dept:${departmentId}`,
    ]);
  } catch {
    // Best-effort cache invalidation
  }
}

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

  try {
    await cacheInvalidateTags(['table:machines', `dept:${machine.department_id}`]);
  } catch {
    // Best-effort cache invalidation
  }

  return { success: true };
}

export async function updateExcavatorSite(excavatorId: string, siteId: string | null) {
  return updateMachineSite(excavatorId, siteId);
}

export async function updateExcavatorAssignmentConfig(
  rawInput: UpdateExcavatorAssignmentConfigInput
) {
  const validated = updateExcavatorAssignmentConfigSchema.parse(rawInput);

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

  let excavatorSiteId: string | null = validated.siteId ?? null;
  if (validated.siteId !== undefined) {
    await serviceClient
      .from('machines')
      .update({ site_id: validated.siteId })
      .eq('id', validated.excavatorId);
  } else {
    const { data: excavatorMachine } = await serviceClient
      .from('machines')
      .select('site_id')
      .eq('id', validated.excavatorId)
      .maybeSingle();
    excavatorSiteId = excavatorMachine?.site_id ?? null;
  }

  if (validated.materialType) {
    await serviceClient
      .from('hourly_loads')
      .update({ material_type: validated.materialType })
      .eq('department_id', validated.departmentId)
      .eq('excavator_id', validated.excavatorId)
      .eq('load_date', validated.loadDate)
      .eq('shift_type', validated.shiftType)
      .eq('is_locked', false);
  }

  const { data: existingActivities } = await serviceClient
    .from('excavator_activity')
    .select('id, site_id, block_mined_id, material_type')
    .eq('department_id', validated.departmentId)
    .eq('machine_id', validated.excavatorId)
    .eq('activity_date', validated.loadDate)
    .eq('shift_type', validated.shiftType)
    .order('created_at', { ascending: false });

  const existingActivity = existingActivities?.[0] ?? null;
  const parsedExistingMaterial = parseExcavatorMaterial(existingActivity?.material_type);
  const nextCategory = validated.materialType ?? parsedExistingMaterial.category;
  const nextSubCategory =
    validated.materialSubCategory !== undefined
      ? validated.materialSubCategory
      : validated.materialType && validated.materialType !== parsedExistingMaterial.category
        ? null
        : parsedExistingMaterial.subCategory || null;
  const formattedActivityMaterial = formatExcavatorMaterial(nextCategory, nextSubCategory);

  if (existingActivity) {
    const patch: Record<string, unknown> = {};
    if (validated.siteId !== undefined) {
      patch.site_id = validated.siteId;
    } else if (!existingActivity.site_id && excavatorSiteId) {
      patch.site_id = excavatorSiteId;
    }
    if (validated.blockMinedId !== undefined) patch.block_mined_id = validated.blockMinedId;
    if (validated.materialType !== undefined || validated.materialSubCategory !== undefined) {
      patch.material_type = formattedActivityMaterial;
    }
    if (Object.keys(patch).length > 0) {
      await serviceClient.from('excavator_activity').update(patch).eq('id', existingActivity.id);
    }
  } else {
    await serviceClient.from('excavator_activity').insert({
      department_id: validated.departmentId,
      machine_id: validated.excavatorId,
      activity_date: validated.loadDate,
      shift_type: validated.shiftType,
      site_id: validated.siteId !== undefined ? validated.siteId : excavatorSiteId,
      block_mined_id: validated.blockMinedId ?? null,
      material_type: formattedActivityMaterial,
      passes: 0,
      loads: 0,
    });
  }

  try {
    await syncExcavatorActivityFromHourlyLoads(serviceClient, {
      departmentId: validated.departmentId,
      excavatorId: validated.excavatorId,
      loadDate: validated.loadDate,
      shiftType: validated.shiftType,
    });
  } catch {
    // Best-effort sync
  }

  try {
    await cacheInvalidateTags([
      'table:machines',
      'table:excavator_activity',
      'table:excavator_dumper_assignments',
      `dept:${validated.departmentId}`,
    ]);
  } catch {
    // Best-effort cache invalidation
  }

  return { success: true };
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

  if (validated.excavatorId) {
    try {
      await syncExcavatorActivityFromHourlyLoads(serviceClient, {
        departmentId: validated.departmentId,
        excavatorId: validated.excavatorId,
        loadDate: validated.loadDate,
        shiftType: validated.shiftType,
      });
    } catch {
      // Best-effort excavator activity sync
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

  if (validated.excavatorId) {
    try {
      await syncExcavatorActivityFromHourlyLoads(serviceClient, {
        departmentId: validated.departmentId,
        excavatorId: validated.excavatorId,
        loadDate: validated.loadDate,
        shiftType: validated.shiftType,
      });
    } catch {
      // Best-effort excavator activity sync
    }
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

    const syncedExcavatorId =
      (updated.excavator_id as string | null) ?? (cleanPatch.excavator_id as string | null) ?? null;
    if (syncedExcavatorId) {
      try {
        await syncExcavatorActivityFromHourlyLoads(serviceClient, {
          departmentId: validated.departmentId,
          excavatorId: syncedExcavatorId,
          loadDate: validated.loadDate,
          shiftType: validated.shiftType,
        });
      } catch {
        // Best-effort excavator activity sync
      }
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
    const previousExcavatorId = (target.excavator_id as string | null) ?? null;
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

    const excavatorIdsToSync = new Set<string>();
    if (previousExcavatorId) excavatorIdsToSync.add(previousExcavatorId);
    if (updated.excavator_id) excavatorIdsToSync.add(updated.excavator_id as string);
    for (const exId of excavatorIdsToSync) {
      try {
        await syncExcavatorActivityFromHourlyLoads(serviceClient, {
          departmentId: validated.departmentId,
          excavatorId: exId,
          loadDate: validated.loadDate,
          shiftType: validated.shiftType,
        });
      } catch {
        // Best-effort excavator activity sync
      }
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

  if (inserted?.excavator_id) {
    try {
      await syncExcavatorActivityFromHourlyLoads(serviceClient, {
        departmentId: validated.departmentId,
        excavatorId: inserted.excavator_id as string,
        loadDate: validated.loadDate,
        shiftType: validated.shiftType,
      });
    } catch {
      // Best-effort excavator activity sync
    }
  }

  return { success: true, load: inserted };
}
