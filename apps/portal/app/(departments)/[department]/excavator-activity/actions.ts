'use server';

import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { cacheInvalidateTags } from '@repo/redis/cache';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  AuthError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/error-classes';
import { SHIFT_LENGTH_HOURS, validateStopSmrCap } from './excavator-shift-helpers';

const SHIFT_START_TIME_BY_TYPE: Readonly<Record<'day' | 'night', string>> = {
  day: '06:00',
  night: '18:00',
};

const MAX_SMR_HOURS = 1_000_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

const excavatorTelemetryLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX_REQUESTS,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:excavator_telemetry:',
});

const saveExcavatorShiftTelemetrySchema = z
  .object({
    departmentId: z.string().uuid('Invalid department ID'),
    excavatorId: z.string().uuid('Invalid excavator ID'),
    loadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid shift date format'),
    shiftType: z.enum(['day', 'night']),
    startSmr: z.number().min(0, 'Start SMR cannot be negative').max(MAX_SMR_HOURS).nullable(),
    stopSmr: z.number().min(0, 'Stop SMR cannot be negative').max(MAX_SMR_HOURS).nullable(),
    operatorId: z.string().uuid('Invalid operator ID').nullable(),
    operatorName: z.string().trim().max(120, 'Operator name too long').nullable(),
    comment: z.string().trim().max(500, 'Comment must be 500 characters or fewer').nullable(),
    siteId: z.string().uuid('Invalid site ID').nullable().optional(),
    blockMinedId: z.string().uuid('Invalid block ID').nullable().optional(),
    materialType: z.string().trim().max(120).nullable().optional(),
  })
  .refine(
    (payload) =>
      payload.startSmr === null || payload.stopSmr === null || payload.stopSmr >= payload.startSmr,
    {
      message: 'Stop SMR must be greater than or equal to Start SMR',
      path: ['stopSmr'],
    }
  )
  .refine(
    (payload) =>
      validateStopSmrCap({
        startSmr: payload.startSmr,
        stopSmr: payload.stopSmr,
        delayHours: 0,
      }) === null,
    {
      message: `Stop SMR cannot exceed Start SMR + ${SHIFT_LENGTH_HOURS} hours`,
      path: ['stopSmr'],
    }
  );

export type ExcavatorShiftTelemetryInput = z.infer<typeof saveExcavatorShiftTelemetrySchema>;

export interface ExcavatorShiftTelemetryResult {
  readonly success: true;
  readonly startSmr: number | null;
  readonly stopSmr: number | null;
  readonly hoursWorked: number | null;
  readonly operatorId: string | null;
  readonly operatorName: string | null;
  readonly comment: string | null;
}

/**
 * Persists excavator Start/Stop SMR (into `machine_operations`), assigned Operator,
 * and shift Comment (into `excavator_activity`) for the active shift.
 */
export async function saveExcavatorShiftTelemetry(
  rawInput: ExcavatorShiftTelemetryInput
): Promise<ExcavatorShiftTelemetryResult> {
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }

  const normalizedRole = (principal.employee.role ?? '').toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const hasAllowedRole = [
    'admin',
    'operator',
    'supervisor',
    'manager',
    'control_room_operator',
  ].includes(normalizedRole);
  const accessible = principal.employee.accessible_departments ?? [];
  const hasDeptAccess =
    isAdmin ||
    principal.employee.department_id === rawInput.departmentId ||
    accessible.includes(rawInput.departmentId) ||
    accessible.includes('control-room');

  if (!hasAllowedRole || !hasDeptAccess) {
    throw new ForbiddenError('Not authorized to record Control Room excavator telemetry');
  }

  const parsed = saveExcavatorShiftTelemetrySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'Invalid excavator telemetry input'
    );
  }

  const actorKey = principal.user?.id ?? principal.employee.id;
  const { allowed } = await excavatorTelemetryLimiter.check(actorKey);
  if (!allowed) {
    throw new RateLimitError('Too many excavator telemetry updates. Please wait a moment.');
  }

  const data = parsed.data;
  const normalizedComment = data.comment && data.comment.length > 0 ? data.comment : null;
  const hoursWorked =
    data.startSmr !== null && data.stopSmr !== null
      ? Number((data.stopSmr - data.startSmr).toFixed(2))
      : null;

  const serviceClient = createServiceRoleClient();
  const [{ data: existingActivities }, { data: existingOperations }] = await Promise.all([
    serviceClient
      .from('excavator_activity')
      .select('id')
      .eq('department_id', data.departmentId)
      .eq('machine_id', data.excavatorId)
      .eq('activity_date', data.loadDate)
      .eq('shift_type', data.shiftType)
      .order('created_at', { ascending: false }),
    serviceClient
      .from('machine_operations')
      .select('id')
      .eq('department_id', data.departmentId)
      .eq('machine_id', data.excavatorId)
      .eq('shift_date', data.loadDate)
      .eq('shift_type', data.shiftType)
      .order('created_at', { ascending: false }),
  ]);

  const existingActivity = existingActivities?.[0] ?? null;
  const existingOperation = existingOperations?.[0] ?? null;

  // Delay-aware Stop SMR cap: Stop ≤ Start + (12 h − logged delay hours). Server-side
  // so the client `max` attribute cannot be bypassed.
  if (existingOperation && data.startSmr !== null && data.stopSmr !== null) {
    const { data: delayRows } = await serviceClient
      .from('machine_operations_with_delays')
      .select('total_delay_hours')
      .eq('id', existingOperation.id);
    const capError = validateStopSmrCap({
      startSmr: data.startSmr,
      stopSmr: data.stopSmr,
      delayHours: delayRows?.[0]?.total_delay_hours ?? 0,
    });
    if (capError) {
      throw new ValidationError(capError);
    }
  }

  const activityMutation = existingActivity
    ? serviceClient
        .from('excavator_activity')
        .update({
          operator_id: data.operatorId,
          notes: normalizedComment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingActivity.id)
        .eq('department_id', data.departmentId)
    : serviceClient.from('excavator_activity').insert({
        department_id: data.departmentId,
        machine_id: data.excavatorId,
        activity_date: data.loadDate,
        shift_type: data.shiftType,
        site_id: data.siteId ?? null,
        block_mined_id: data.blockMinedId ?? null,
        material_type: data.materialType ?? 'Waste',
        operator_id: data.operatorId,
        notes: normalizedComment,
        passes: 0,
        loads: 0,
      });

  const operationMutation = existingOperation
    ? serviceClient
        .from('machine_operations')
        .update({
          start_smu: data.startSmr,
          end_smu: data.stopSmr,
          hours_worked: hoursWorked,
          operator_id: data.operatorId,
          operator_name: data.operatorName,
          site_id: data.siteId ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOperation.id)
        .eq('department_id', data.departmentId)
    : serviceClient.from('machine_operations').insert({
        department_id: data.departmentId,
        machine_id: data.excavatorId,
        shift_date: data.loadDate,
        shift_type: data.shiftType,
        start_time: SHIFT_START_TIME_BY_TYPE[data.shiftType],
        start_smu: data.startSmr,
        end_smu: data.stopSmr,
        hours_worked: hoursWorked,
        operator_id: data.operatorId,
        operator_name: data.operatorName,
        site_id: data.siteId ?? null,
        operational_status: 'operational',
      });

  const [actRes, opRes] = await Promise.all([activityMutation, operationMutation]);
  if (actRes.error) {
    throw actRes.error;
  }
  if (opRes.error) {
    throw opRes.error;
  }

  logger.info({
    event: 'excavator_shift_telemetry_saved',
    actorId: actorKey,
    excavatorId: data.excavatorId,
    loadDate: data.loadDate,
    shiftType: data.shiftType,
    startSmr: data.startSmr,
    stopSmr: data.stopSmr,
  });

  try {
    await cacheInvalidateTags([
      'table:excavator_activity',
      'table:machine_operations',
      'table:machines',
      `dept:${data.departmentId}`,
    ]);
  } catch {
    // Non-fatal cache invalidation
  }

  revalidatePath('/control-room/excavator-activity');
  revalidatePath('/control-room/machine-operations');
  revalidatePath('/control-room');
  revalidatePath('/production');

  return {
    success: true,
    startSmr: data.startSmr,
    stopSmr: data.stopSmr,
    hoursWorked,
    operatorId: data.operatorId,
    operatorName: data.operatorName,
    comment: normalizedComment,
  };
}
