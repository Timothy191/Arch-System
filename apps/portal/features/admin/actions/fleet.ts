'use server';

import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';

async function assertAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const };

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (employee?.role !== 'admin') {
    return { error: 'Forbidden: admin role required', status: 403 as const };
  }

  return { supabase, employee };
}

export async function adminAddMachine(data: {
  name: string;
  machine_type: string;
  manufacturer?: string;
  serial_number?: string;
  starting_smr?: number | null;
  bin_factor?: number | null;
  bin_factor_waste?: number | null;
  bin_factor_coal?: number | null;
  department_id: string;
  site_id?: string | null;
  active?: boolean;
  report_exempt?: boolean;
}) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  if (!data.machine_type?.trim()) return { error: 'Machine Type is required.' };
  if (!data.manufacturer?.trim()) return { error: 'Machine Manufacture is required.' };
  if (!data.serial_number?.trim() && !data.name?.trim()) {
    return { error: 'Machine Id is required.' };
  }
  if (
    data.starting_smr === undefined ||
    data.starting_smr === null ||
    Number.isNaN(data.starting_smr)
  ) {
    return { error: 'Starting SMR on Site is required.' };
  }
  if (!data.department_id) return { error: 'Department is required.' };

  const resolvedMachineId = data.serial_number?.trim() || data.name.trim();
  const resolvedName =
    data.name?.trim() ||
    `${data.manufacturer.trim()} ${data.machine_type.trim()} (${resolvedMachineId})`;
  const primaryBinFactor = data.bin_factor_waste ?? data.bin_factor_coal ?? data.bin_factor ?? null;

  const { data: inserted, error } = await supabase
    .from('machines')
    .insert({
      name: resolvedName,
      machine_type: data.machine_type.trim(),
      manufacturer: data.manufacturer.trim(),
      serial_number: resolvedMachineId,
      starting_smr: data.starting_smr,
      bin_factor: primaryBinFactor,
      bin_factor_waste: data.bin_factor_waste ?? null,
      bin_factor_coal: data.bin_factor_coal ?? null,
      department_id: data.department_id,
      site_id: data.site_id || null,
      active: data.active ?? true,
      report_exempt: data.report_exempt ?? false,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    // Fallback if optional migration 185 columns are not yet applied in the target DB
    const fallback = await supabase
      .from('machines')
      .insert({
        name: resolvedName,
        machine_type: data.machine_type.trim(),
        serial_number: resolvedMachineId,
        bin_factor: primaryBinFactor,
        department_id: data.department_id,
        site_id: data.site_id || null,
        active: data.active ?? true,
        report_exempt: data.report_exempt ?? false,
      })
      .select('id')
      .maybeSingle();

    if (fallback.error) return { error: 'Failed to add machine' };
  }

  const createdMachineId = inserted?.id;
  if (createdMachineId && data.starting_smr >= 0) {
    const today = new Date().toISOString().split('T')[0] as string;
    await supabase.from('machine_operations').insert({
      department_id: data.department_id,
      site_id: data.site_id || null,
      machine_id: createdMachineId,
      shift_date: today,
      shift_type: 'day',
      start_time: '06:00:00',
      end_time: '06:00:00',
      start_smu: data.starting_smr,
      end_smu: data.starting_smr,
      hours_worked: 0,
    });
  }

  await updateTags(['table:fleet', 'table:equipment', 'table:machines']);
  revalidatePath('/admin');
  return { success: true };
}

export async function adminUpdateMachine(
  id: string,
  data: {
    name?: string;
    machine_type?: string;
    manufacturer?: string | null;
    serial_number?: string | null;
    starting_smr?: number | null;
    bin_factor?: number | null;
    bin_factor_waste?: number | null;
    bin_factor_coal?: number | null;
    department_id?: string;
    site_id?: string | null;
    active?: boolean;
    report_exempt?: boolean;
  }
) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name?.trim();
  const machineType = data.machine_type?.trim();
  if (name !== undefined && !name) return { error: 'Machine name cannot be empty.' };
  if (machineType !== undefined && !machineType) return { error: 'Machine type cannot be empty.' };

  const primaryBinFactor =
    data.bin_factor_waste !== undefined || data.bin_factor_coal !== undefined
      ? (data.bin_factor_waste ?? data.bin_factor_coal ?? data.bin_factor ?? null)
      : data.bin_factor;

  const updatePayload = {
    ...data,
    ...(name !== undefined ? { name } : {}),
    ...(machineType !== undefined ? { machine_type: machineType } : {}),
    ...(data.manufacturer !== undefined ? { manufacturer: data.manufacturer?.trim() || null } : {}),
    ...(data.serial_number !== undefined
      ? { serial_number: data.serial_number?.trim() || null }
      : {}),
    ...(primaryBinFactor !== undefined ? { bin_factor: primaryBinFactor } : {}),
  };

  let { error } = await supabase.from('machines').update(updatePayload).eq('id', id);

  if (error) {
    const {
      manufacturer: _m,
      starting_smr: _s,
      bin_factor_waste: _w,
      bin_factor_coal: _c,
      ...legacyPayload
    } = updatePayload;
    const fallback = await supabase.from('machines').update(legacyPayload).eq('id', id);
    error = fallback.error;
  }

  if (error) return { error: 'Failed to update machine' };

  await updateTags(['table:fleet', 'table:equipment', 'table:machines']);
  revalidatePath('/admin');
  return { success: true };
}
