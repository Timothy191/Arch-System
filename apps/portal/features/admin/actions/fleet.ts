'use server';

import {
  adminAddMachineSchema,
  adminArchiveMachineSchema,
  adminUpdateMachineSchema,
} from '@repo/contract/schemas/admin.schema';
import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
import { resolveDefaultManufacturer, resolveMachineIdentity } from '../tabs/fleet-utils';
import { assertAdmin, logAdminAuditEvent } from './shared';

const MAX_FLEET_OPERATIONS_HISTORY_ROWS = 5000;
const FLEET_CACHE_TAGS = ['table:fleet', 'table:equipment', 'table:machines'];

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
  if (!data.department_id?.trim()) return { error: 'Department is required.' };

  const parsed = adminAddMachineSchema.safeParse({
    ...data,
    starting_smr: data.starting_smr,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid machine details.' };
  }

  const valid = parsed.data;
  const { supabase, userId } = auth;

  const resolvedMachineId = valid.name.trim() || valid.serial_number?.trim() || '';
  const resolvedMachineName =
    valid.serial_number?.trim() ||
    `${valid.manufacturer.trim()} ${valid.machine_type.trim()} (${resolvedMachineId})`;
  const primaryBinFactor =
    valid.bin_factor_waste ?? valid.bin_factor_coal ?? valid.bin_factor ?? null;
  const explicitImageUrl = valid.image_url?.trim() || null;

  const insertPayload = {
    name: resolvedMachineId,
    machine_type: valid.machine_type.trim(),
    manufacturer: valid.manufacturer.trim(),
    serial_number: resolvedMachineName,
    image_url: explicitImageUrl,
    starting_smr: valid.starting_smr,
    bin_factor: primaryBinFactor,
    bin_factor_waste: valid.bin_factor_waste ?? null,
    bin_factor_coal: valid.bin_factor_coal ?? null,
    department_id: valid.department_id,
    site_id: valid.site_id || null,
    active: valid.active ?? true,
    report_exempt: valid.report_exempt ?? false,
  };

  const { data: inserted, error } = await supabase
    .from('machines')
    .insert(insertPayload)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message || 'Failed to add machine' };
  }

  const createdMachineId = inserted?.id;
  if (createdMachineId && valid.starting_smr >= 0) {
    const today = new Date().toISOString().split('T')[0] as string;
    const { error: opError } = await supabase.from('machine_operations').insert({
      department_id: valid.department_id,
      site_id: valid.site_id || null,
      machine_id: createdMachineId,
      shift_date: today,
      shift_type: 'day',
      start_time: '06:00:00',
      end_time: '06:00:00',
      start_smu: valid.starting_smr,
      end_smu: valid.starting_smr,
      hours_worked: 0,
    });
    if (opError) {
      return {
        error: `Machine created, but initial SMR operation log failed: ${opError.message}`,
      };
    }
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'create',
    resource: 'machines',
    resourceId: createdMachineId ?? null,
    metadata: { name: resolvedMachineId, machine_type: valid.machine_type.trim() },
  });

  await updateTags(FLEET_CACHE_TAGS);
  revalidatePath('/admin');
  return { success: true as const };
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

  if (data.name !== undefined && !data.name.trim()) {
    return { error: 'Machine ID cannot be empty.' };
  }
  if (data.machine_type !== undefined && !data.machine_type.trim()) {
    return { error: 'Machine type cannot be empty.' };
  }

  const parsed = adminUpdateMachineSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid machine update payload.' };
  }

  const valid = parsed.data;
  const { supabase, userId } = auth;

  const primaryBinFactor =
    data.bin_factor_waste !== undefined || data.bin_factor_coal !== undefined
      ? (valid.bin_factor_waste ?? valid.bin_factor_coal ?? valid.bin_factor ?? null)
      : valid.bin_factor;

  const { id: targetId, ...fields } = valid;
  const updatePayload = {
    ...fields,
    ...(valid.name !== undefined ? { name: valid.name.trim() } : {}),
    ...(valid.machine_type !== undefined ? { machine_type: valid.machine_type.trim() } : {}),
    ...(data.manufacturer !== undefined
      ? { manufacturer: valid.manufacturer?.trim() || null }
      : {}),
    ...(data.serial_number !== undefined
      ? { serial_number: valid.serial_number?.trim() || null }
      : {}),
    ...(data.image_url !== undefined ? { image_url: valid.image_url?.trim() || null } : {}),
    ...(primaryBinFactor !== undefined ? { bin_factor: primaryBinFactor } : {}),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('machines').update(updatePayload).eq('id', targetId);

  if (error) {
    return { error: error.message || 'Failed to update machine' };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'update',
    resource: 'machines',
    resourceId: targetId,
  });

  await updateTags(FLEET_CACHE_TAGS);
  revalidatePath('/admin');
  return { success: true as const };
}

export async function adminArchiveMachine(id: string) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parsed = adminArchiveMachineSchema.safeParse({ id });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Machine ID is required.' };
  }

  const { supabase, userId } = auth;
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('machines')
    .update({
      deleted_at: nowIso,
      active: false,
      updated_at: nowIso,
    })
    .eq('id', parsed.data.id);

  if (error) {
    return { error: error.message || 'Failed to archive machine' };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'archive',
    resource: 'machines',
    resourceId: parsed.data.id,
  });

  await updateTags(FLEET_CACHE_TAGS);
  revalidatePath('/admin');
  return { success: true as const };
}

/**
 * Derives missing Starting SMR hours strictly from real `machine_operations` history
 * (never fabricating hours when no operations exist) and enriches missing Production
 * department / OEM metadata.
 */
export async function adminGenerateStartingSmr(): Promise<{
  success?: boolean;
  updatedCount?: number;
  skippedNoOpsCount?: number;
  missingOpsMachines?: string[];
  error?: string;
}> {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase, userId } = auth;

  const buildDepartmentsQuery = () => {
    const base = supabase.from('departments').select('id, name');
    return typeof (base as { is?: unknown }).is === 'function'
      ? (base as unknown as { is: (col: string, val: null) => typeof base }).is('deleted_at', null)
      : base;
  };

  const buildOperationsQuery = () => {
    const ordered = supabase
      .from('machine_operations')
      .select('machine_id, start_smu, end_smu, shift_date, created_at')
      .order('shift_date', { ascending: true });
    return typeof (ordered as { limit?: unknown }).limit === 'function'
      ? (ordered as unknown as { limit: (n: number) => typeof ordered }).limit(
          MAX_FLEET_OPERATIONS_HISTORY_ROWS
        )
      : ordered;
  };

  const [
    { data: machineRows, error: machineErr },
    { data: deptRows, error: deptErr },
    { data: opRows, error: opErr },
  ] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, serial_number, machine_type, manufacturer, starting_smr, department_id')
      .is('deleted_at', null),
    buildDepartmentsQuery(),
    buildOperationsQuery(),
  ]);

  if (machineErr || deptErr || opErr) {
    return {
      error:
        machineErr?.message ||
        deptErr?.message ||
        opErr?.message ||
        'Failed to inspect fleet machines for SMR generation.',
    };
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
  const missingOpsMachines: string[] = [];

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
    const hasCurrentSmr = Number.isFinite(currentSmr) && currentSmr > 0;
    const historicalSmr = earliestSmrByMachine.get(row.id);

    if (!hasCurrentSmr && historicalSmr === undefined) {
      missingOpsMachines.push(identity.machineId);
    }

    const nextSmr = hasCurrentSmr ? currentSmr : historicalSmr;

    const resolvedMfg = resolveDefaultManufacturer({
      machineId: identity.machineId,
      machineName: identity.machineName,
      machineType: row.machine_type,
      manufacturer: row.manufacturer,
    });

    const nextDepartmentId =
      productionDept && (!row.department_id || row.department_id === adminDept?.id)
        ? productionDept.id
        : row.department_id;

    const needsSmr = !hasCurrentSmr && nextSmr !== undefined;
    const needsMfg = !(row.manufacturer ?? '').trim();
    const needsDept = nextDepartmentId !== row.department_id;

    if (!needsSmr && !needsMfg && !needsDept) continue;

    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (needsSmr && nextSmr !== undefined) {
      updateFields.starting_smr = nextSmr;
    }
    if (needsMfg) {
      updateFields.manufacturer = resolvedMfg;
    }
    if (needsDept && nextDepartmentId) {
      updateFields.department_id = nextDepartmentId;
    }

    const { error: updateErr } = await supabase
      .from('machines')
      .update(updateFields)
      .eq('id', row.id);

    if (updateErr) {
      return { error: `Failed to update machine ${identity.machineId}: ${updateErr.message}` };
    }
    updatedCount += 1;
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'bulk_generate_smr',
    resource: 'machines',
    metadata: { updatedCount, skippedNoOpsCount: missingOpsMachines.length },
  });

  await updateTags(FLEET_CACHE_TAGS);
  revalidatePath('/admin');
  return {
    success: true,
    updatedCount,
    skippedNoOpsCount: missingOpsMachines.length,
    missingOpsMachines,
  };
}
