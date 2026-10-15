'use server';

import { saveExcavatorActivitySchema } from '@repo/contract/schemas/form.schema';
import type { SaveExcavatorActivityInput } from '@repo/contract/types/form.types';
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

export async function saveExcavatorActivity(input: SaveExcavatorActivityInput) {
  const validated = saveExcavatorActivitySchema.parse(input);

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
  const totalLoads = validated.dumperAssignments.reduce((sum, a) => sum + (a.totalLoads || 0), 0);

  // Upsert against existing excavator_activity for this excavator + date + shift
  // (which may have been auto-created by Hourly Loads excavator assignment sync)
  const { data: existingRows, error: findErr } = await serviceClient
    .from('excavator_activity')
    .select('id, material_type')
    .eq('department_id', validated.departmentId)
    .eq('machine_id', validated.excavatorId)
    .eq('activity_date', validated.activityDate)
    .eq('shift_type', validated.shiftType)
    .order('created_at', { ascending: false });

  if (findErr) throw findErr;

  let activityId: string;
  const existing = existingRows?.[0];
  const resolvedMaterialType =
    validated.materialType ||
    existing?.material_type ||
    validated.dumperAssignments[0]?.materialType ||
    'Waste';

  if (existing) {
    const { data: updated, error: updateErr } = await serviceClient
      .from('excavator_activity')
      .update({
        operator_id: validated.operatorId || null,
        site_id: validated.siteId || null,
        block_mined_id: validated.blockMinedId || null,
        material_type: resolvedMaterialType,
        loads: totalLoads,
        notes: validated.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('department_id', validated.departmentId)
      .select('id')
      .single();

    if (updateErr) throw updateErr;
    activityId = updated.id;
  } else {
    const { data: inserted, error: insertErr } = await serviceClient
      .from('excavator_activity')
      .insert({
        department_id: validated.departmentId,
        machine_id: validated.excavatorId,
        operator_id: validated.operatorId || null,
        activity_date: validated.activityDate,
        shift_type: validated.shiftType,
        site_id: validated.siteId || null,
        block_mined_id: validated.blockMinedId || null,
        material_type: resolvedMaterialType,
        passes: 0,
        loads: totalLoads,
        notes: validated.notes || null,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;
    activityId = inserted.id;
  }

  // Replace dumper assignments for this excavator activity
  const { error: deleteAssignErr } = await serviceClient
    .from('excavator_dumper_assignments')
    .delete()
    .eq('excavator_activity_id', activityId);

  if (deleteAssignErr) throw deleteAssignErr;

  if (validated.dumperAssignments.length > 0) {
    const assignmentRows = validated.dumperAssignments.map((a) => ({
      excavator_activity_id: activityId,
      dumper_machine_id: a.dumperMachineId,
      material_type: a.materialType,
      total_loads: a.totalLoads,
      total_bcm: a.totalBcm || null,
    }));

    const { error: insertAssignErr } = await serviceClient
      .from('excavator_dumper_assignments')
      .insert(assignmentRows);

    if (insertAssignErr) throw insertAssignErr;
  }

  try {
    await cacheInvalidateTags([
      'table:excavator_activity',
      'table:excavator_dumper_assignments',
      `dept:${validated.departmentId}`,
    ]);
  } catch {
    // Best-effort cache invalidation
  }

  return { success: true, activityId };
}
