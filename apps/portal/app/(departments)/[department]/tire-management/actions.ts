'use server';

import {
  AuthError,
  DatabaseError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@repo/errors';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAuditEvent } from '@/lib/audit';
import {
  ALLOWED_TIRE_ACTIVITY_ROLES,
  buildTireActivityNote,
  type LogTireActivityInput,
  type LogTireActivityResult,
  type ParsedTireActivityInput,
  TIRE_ACTIVITY_RATE_LIMIT,
  TIRE_ACTIVITY_WINDOW_MS,
  tireActivitySchema,
} from './tire-constants';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const tireActivityLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: TIRE_ACTIVITY_RATE_LIMIT,
  windowMs: TIRE_ACTIVITY_WINDOW_MS,
  keyPrefix: 'ratelimit:tire_activity:',
});

function hasTireActivityPermission(employee: {
  readonly role: string;
  readonly accessible_departments: string[];
}): boolean {
  if (ALLOWED_TIRE_ACTIVITY_ROLES.has(employee.role)) {
    return true;
  }
  return (
    Array.isArray(employee.accessible_departments) &&
    employee.accessible_departments.includes('engineering')
  );
}

async function resolveMachineName(options: {
  readonly supabase: ServerSupabaseClient;
  readonly machineId: string;
}): Promise<string> {
  if (!options.machineId) {
    return 'Unassigned';
  }
  const { data: machineRow } = await options.supabase
    .from('machines')
    .select('id, name')
    .eq('id', options.machineId)
    .single();
  return machineRow?.name || 'Selected Machine';
}

async function performTireRemoval(options: {
  readonly supabase: ServerSupabaseClient;
  readonly input: ParsedTireActivityInput;
  readonly machineName: string;
}): Promise<string> {
  const { supabase, input, machineName } = options;
  const tireId = input.removedTireId!;
  const resolvedSerial = input.tireSerial?.trim() || input.replacementSerial?.trim();
  const resolvedBrand = input.tireBrand?.trim() || input.replacementBrand?.trim();

  const { error: updateError } = await supabase
    .from('tires')
    .update({
      status: input.removedOutcome,
      removed_at: input.actionDate,
      removed_hours: input.machineHours,
      scrapped_reason: input.removedReason.trim(),
      machine_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tireId);

  if (updateError) {
    throw new DatabaseError('Failed to update removed tire record', {
      operation: 'update',
      table: 'tires',
      context: { error: updateError.message, tireId },
    });
  }

  const removalNotes = buildTireActivityNote({
    prefix: '[REMOVAL]',
    machineName,
    position: input.position,
    machineHours: input.machineHours,
    serialNumber: resolvedSerial,
    brand: resolvedBrand,
    outcome: input.removedOutcome,
    reason: input.removedReason,
    treadDepthMm: input.treadDepthMm,
    pressurePsi: input.pressurePsi,
    notes: input.notes,
  });

  const { error: inspectionError } = await supabase.from('tire_inspections').insert({
    tire_id: tireId,
    inspection_date: input.actionDate,
    tread_depth_mm: input.treadDepthMm ?? 0,
    pressure_psi: input.pressurePsi ?? 0,
    condition_status: input.conditionStatus,
    current_smu: input.machineHours,
    notes: removalNotes,
  });

  if (inspectionError) {
    throw new DatabaseError('Failed to record tire removal activity log', {
      operation: 'insert',
      table: 'tire_inspections',
      context: { error: inspectionError.message, tireId },
    });
  }

  return tireId;
}

async function upsertInstalledTire(options: {
  readonly supabase: ServerSupabaseClient;
  readonly input: ParsedTireActivityInput;
}): Promise<string> {
  const { supabase, input } = options;

  if (input.existingSpareTireId) {
    const { error: spareError } = await supabase
      .from('tires')
      .update({
        machine_id: input.machineId,
        position: input.position,
        status: 'installed',
        installed_at: input.actionDate,
        installed_hours: input.machineHours,
        removed_at: null,
        removed_hours: null,
        scrapped_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.existingSpareTireId);

    if (spareError) {
      throw new DatabaseError('Failed to install inventory spare tire onto machine', {
        operation: 'update',
        table: 'tires',
        context: { error: spareError.message, tireId: input.existingSpareTireId },
      });
    }
    return input.existingSpareTireId;
  }

  const serialNumber = (input.replacementSerial || input.tireSerial)!.trim();
  const brand = (input.replacementBrand || input.tireBrand)!.trim();

  const { data: insertedTire, error: insertError } = await supabase
    .from('tires')
    .insert({
      serial_number: serialNumber,
      brand,
      size: input.replacementSize!.trim(),
      machine_id: input.machineId,
      position: input.position,
      status: 'installed',
      installed_at: input.actionDate,
      installed_hours: input.machineHours,
      removed_at: null,
      removed_hours: null,
    })
    .select('id')
    .single();

  if (insertError || !insertedTire?.id) {
    throw new DatabaseError('Failed to register replacement tire on machine', {
      operation: 'insert',
      table: 'tires',
      context: { error: insertError?.message ?? 'Missing inserted tire ID' },
    });
  }

  return insertedTire.id;
}

async function performTireInstallation(options: {
  readonly supabase: ServerSupabaseClient;
  readonly input: ParsedTireActivityInput;
  readonly machineName: string;
}): Promise<string> {
  const { supabase, input, machineName } = options;
  const installedTireId = await upsertInstalledTire({ supabase, input });
  const prefix = input.mode === 'replace' ? '[REPLACEMENT]' : '[INSTALLATION]';
  const resolvedSerial = input.replacementSerial?.trim() || input.tireSerial?.trim();
  const resolvedBrand = input.replacementBrand?.trim() || input.tireBrand?.trim();

  const activityNotes = buildTireActivityNote({
    prefix,
    machineName,
    position: input.position,
    machineHours: input.machineHours,
    serialNumber: resolvedSerial,
    brand: resolvedBrand,
    reason: input.removedReason,
    treadDepthMm: input.treadDepthMm,
    pressurePsi: input.pressurePsi,
    notes: input.notes,
  });

  const { error: inspectionError } = await supabase.from('tire_inspections').insert({
    tire_id: installedTireId,
    inspection_date: input.actionDate,
    tread_depth_mm: input.treadDepthMm ?? 0,
    pressure_psi: input.pressurePsi ?? 0,
    condition_status: input.conditionStatus,
    current_smu: input.machineHours,
    notes: activityNotes,
  });

  if (inspectionError) {
    throw new DatabaseError('Failed to log tire installation activity', {
      operation: 'insert',
      table: 'tire_inspections',
      context: { error: inspectionError.message, tireId: installedTireId },
    });
  }

  return installedTireId;
}

async function performTireInspection(options: {
  readonly supabase: ServerSupabaseClient;
  readonly input: ParsedTireActivityInput;
  readonly machineName: string;
}): Promise<string> {
  const { supabase, input, machineName } = options;
  const targetTireId = (input.tireId || input.removedTireId || input.existingSpareTireId)!;
  const resolvedSerial = input.tireSerial?.trim() || input.replacementSerial?.trim();
  const resolvedBrand = input.tireBrand?.trim() || input.replacementBrand?.trim();

  const inspectNotes = buildTireActivityNote({
    prefix: '[INSPECTION]',
    machineName,
    position: input.position,
    machineHours: input.machineHours,
    serialNumber: resolvedSerial,
    brand: resolvedBrand,
    reason: input.removedReason,
    treadDepthMm: input.treadDepthMm,
    pressurePsi: input.pressurePsi,
    notes: input.notes,
  });

  const { error: inspectionError } = await supabase.from('tire_inspections').insert({
    tire_id: targetTireId,
    inspection_date: input.actionDate,
    tread_depth_mm: input.treadDepthMm ?? 0,
    pressure_psi: input.pressurePsi ?? 0,
    condition_status: input.conditionStatus,
    current_smu: input.machineHours,
    notes: inspectNotes,
  });

  if (inspectionError) {
    throw new DatabaseError('Failed to log tire inspection', {
      operation: 'insert',
      table: 'tire_inspections',
      context: { error: inspectionError.message, tireId: targetTireId },
    });
  }

  return targetTireId;
}

export async function logTireActivity(
  rawInput: LogTireActivityInput
): Promise<LogTireActivityResult> {
  // Step 1: Authenticate
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal) {
    throw new AuthError('Unauthorized', {
      context: { action: 'logTireActivity' },
    });
  }

  // Step 2: Authorize
  if (!principal.employee || !hasTireActivityPermission(principal.employee)) {
    throw new ForbiddenError('Insufficient permissions for engineering tire management', {
      context: { action: 'logTireActivity', role: principal.employee?.role ?? 'none' },
    });
  }

  // Step 3: Validate
  const parsed = tireActivitySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid tire activity payload', {
      context: { action: 'logTireActivity' },
    });
  }

  // Step 4: Rate-limit
  const { allowed } = await tireActivityLimiter.check(principal.user.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded for tire activity logging', {
      context: { action: 'logTireActivity', userId: principal.user.id },
    });
  }

  // Step 5: Execute
  const input = parsed.data;
  const machineName = await resolveMachineName({ supabase, machineId: input.machineId });

  const removedTireId =
    input.mode === 'remove' || input.mode === 'replace'
      ? await performTireRemoval({ supabase, input, machineName })
      : null;

  const installedTireId =
    input.mode === 'replace' || input.mode === 'install'
      ? await performTireInstallation({ supabase, input, machineName })
      : null;

  const inspectedTireId =
    input.mode === 'inspect' ? await performTireInspection({ supabase, input, machineName }) : null;

  // Step 6: Audit log
  const auditSerial = input.replacementSerial?.trim() || input.tireSerial?.trim() || null;
  const auditBrand = input.replacementBrand?.trim() || input.tireBrand?.trim() || null;
  await logAuditEvent({
    action: input.mode === 'install' ? 'insert' : 'update',
    tableName: 'tires',
    recordId: installedTireId ?? removedTireId ?? inspectedTireId ?? undefined,
    newData: {
      mode: input.mode,
      machineId: input.machineId,
      machineName,
      position: input.position,
      actionDate: input.actionDate,
      machineHours: input.machineHours,
      serialNumber: auditSerial,
      brand: auditBrand,
      reason: input.removedReason,
      removedTireId,
      installedTireId,
      inspectedTireId,
    },
    departmentId: principal.employee.department_id,
  });

  // Step 7: Invalidate caches
  await cacheInvalidateTags(['table:tires', 'table:tire_inspections']);
  revalidatePath('/engineering/tire-management');
  revalidatePath('/engineering/reports');

  // Step 8: Return typed result
  return {
    success: true,
    mode: input.mode,
    removedTireId,
    installedTireId,
    inspectedTireId,
    machineName,
  };
}
