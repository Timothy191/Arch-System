'use server';

import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
import {
  estimateBaselineStartingSmr,
  resolveDefaultMachineImage,
  resolveDefaultManufacturer,
  resolveMachineIdentity,
} from '../tabs/fleet-utils';
import { assertAdmin, logAdminAuditEvent } from './shared';

export async function adminAddMachine(data: {
  name: string;
  machine_type: string;
  manufacturer?: string;
  serial_number?: string;
  image_url?: string | null;
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

  const { supabase, userId } = auth;

  if (!data.machine_type?.trim()) return { error: 'Machine Type is required.' };
  if (!data.manufacturer?.trim()) return { error: 'Machine Manufacturer is required.' };
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

  const resolvedMachineId = data.name?.trim() || data.serial_number?.trim() || '';
  const resolvedMachineName =
    data.serial_number?.trim() ||
    `${data.manufacturer.trim()} ${data.machine_type.trim()} (${resolvedMachineId})`;
  const primaryBinFactor = data.bin_factor_waste ?? data.bin_factor_coal ?? data.bin_factor ?? null;
  const resolvedImageUrl = resolveDefaultMachineImage({
    machineType: data.machine_type.trim(),
    manufacturer: data.manufacturer.trim(),
    machineId: resolvedMachineId,
    imageUrl: data.image_url,
  });

  const baseInsert = {
    name: resolvedMachineId,
    machine_type: data.machine_type.trim(),
    manufacturer: data.manufacturer.trim(),
    serial_number: resolvedMachineName,
    starting_smr: data.starting_smr,
    bin_factor: primaryBinFactor,
    bin_factor_waste: data.bin_factor_waste ?? null,
    bin_factor_coal: data.bin_factor_coal ?? null,
    department_id: data.department_id,
    site_id: data.site_id || null,
    active: data.active ?? true,
    report_exempt: data.report_exempt ?? false,
  };

  let { data: inserted, error } = await supabase
    .from('machines')
    .insert({ ...baseInsert, image_url: resolvedImageUrl })
    .select('id')
    .maybeSingle();

  if (error) {
    const fallback = await supabase.from('machines').insert(baseInsert).select('id').maybeSingle();
    inserted = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return { error: 'Failed to add machine' };
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

  logAdminAuditEvent({
    actorId: userId,
    action: 'create',
    resource: 'machines',
    resourceId: createdMachineId ?? null,
    metadata: { name: resolvedMachineId, machine_type: data.machine_type.trim() },
  });

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
    image_url?: string | null;
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

  const { supabase, userId } = auth;

  const name = data.name?.trim();
  const machineType = data.machine_type?.trim();
  if (name !== undefined && !name) return { error: 'Machine ID cannot be empty.' };
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
    ...(data.image_url !== undefined ? { image_url: data.image_url?.trim() || null } : {}),
    ...(primaryBinFactor !== undefined ? { bin_factor: primaryBinFactor } : {}),
  };

  let { error } = await supabase.from('machines').update(updatePayload).eq('id', id);

  if (error) {
    const {
      manufacturer: _m,
      starting_smr: _s,
      bin_factor_waste: _w,
      bin_factor_coal: _c,
      image_url: _img,
      ...legacyPayload
    } = updatePayload;
    const fallback = await supabase.from('machines').update(legacyPayload).eq('id', id);
    error = fallback.error;
  }

  if (error) return { error: 'Failed to update machine' };

  logAdminAuditEvent({
    actorId: userId,
    action: 'update',
    resource: 'machines',
    resourceId: id,
  });

  await updateTags(['table:fleet', 'table:equipment', 'table:machines']);
  revalidatePath('/admin');
  return { success: true };
}

/**
 * Generates baseline Starting SMR hours (from historical operations or deterministic
 * machine-type baseline) and enriches missing Production department / OEM / picture metadata.
 */
export async function adminGenerateStartingSmr(): Promise<{
  success?: boolean;
  updatedCount?: number;
  error?: string;
}> {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase, userId } = auth;

  const [{ data: machineRows, error: machineErr }, { data: deptRows }, { data: opRows }] =
    await Promise.all([
      supabase
        .from('machines')
        .select('id, name, serial_number, machine_type, manufacturer, starting_smr, department_id')
        .is('deleted_at', null),
      supabase.from('departments').select('id, name'),
      supabase
        .from('machine_operations')
        .select('machine_id, start_smu, end_smu, shift_date, created_at')
        .order('shift_date', { ascending: true }),
    ]);

  if (machineErr) {
    return { error: 'Failed to inspect fleet machines for SMR generation.' };
  }

  const productionDept = (deptRows ?? []).find(
    (dept: { id: string; name?: string }) => dept.name?.toLowerCase() === 'production'
  );
  const adminDept = (deptRows ?? []).find(
    (dept: { id: string; name?: string }) => dept.name?.toLowerCase() === 'admin'
  );

  const earliestSmrByMachine = new Map<string, number>();
  for (const op of (opRows ?? []) as Array<{
    machine_id: string;
    start_smu?: number | null;
    end_smu?: number | null;
  }>) {
    if (earliestSmrByMachine.has(op.machine_id)) continue;
    const candidate = Number(op.start_smu || op.end_smu || 0);
    if (Number.isFinite(candidate) && candidate > 0) {
      earliestSmrByMachine.set(op.machine_id, Math.round(candidate * 10) / 10);
    }
  }

  let updatedCount = 0;
  for (const row of (machineRows ?? []) as Array<{
    id: string;
    name: string;
    serial_number: string | null;
    machine_type: string;
    manufacturer?: string | null;
    starting_smr?: number | null;
    department_id?: string | null;
  }>) {
    const identity = resolveMachineIdentity({
      name: row.name,
      serialNumber: row.serial_number,
    });
    const currentSmr = Number(row.starting_smr ?? 0);
    const resolvedSmr =
      Number.isFinite(currentSmr) && currentSmr > 0
        ? currentSmr
        : (earliestSmrByMachine.get(row.id) ??
          estimateBaselineStartingSmr({
            machineType: row.machine_type,
            machineId: identity.machineId,
          }));

    const resolvedMfg = resolveDefaultManufacturer({
      machineId: identity.machineId,
      machineName: identity.machineName,
      machineType: row.machine_type,
      manufacturer: row.manufacturer,
    });
    const resolvedImage = resolveDefaultMachineImage({
      machineType: row.machine_type,
      manufacturer: resolvedMfg,
      machineId: identity.machineId,
    });

    const nextDepartmentId =
      productionDept && (!row.department_id || row.department_id === adminDept?.id)
        ? productionDept.id
        : row.department_id;

    const needsSmr = !(Number.isFinite(currentSmr) && currentSmr > 0);
    const needsMfg = !(row.manufacturer ?? '').trim();
    const needsDept = nextDepartmentId !== row.department_id;

    if (!needsSmr && !needsMfg && !needsDept) continue;

    const { error: updateErr } = await supabase
      .from('machines')
      .update({
        starting_smr: resolvedSmr,
        manufacturer: resolvedMfg,
        image_url: resolvedImage,
        ...(nextDepartmentId ? { department_id: nextDepartmentId } : {}),
      })
      .eq('id', row.id);

    if (!updateErr) {
      updatedCount += 1;
    }
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'bulk_generate_smr',
    resource: 'machines',
    metadata: { updatedCount },
  });

  await updateTags(['table:fleet', 'table:equipment', 'table:machines']);
  revalidatePath('/admin');
  return { success: true, updatedCount };
}
