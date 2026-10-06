'use server';

import {
  splitHourlyLoadSchema,
  updateHourlyLoadExcavatorSchema,
  updateMachineSiteSchema,
} from '@repo/contract/schemas/form.schema';
import type { SplitHourlyLoadInput } from '@repo/contract/types/form.types';
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
