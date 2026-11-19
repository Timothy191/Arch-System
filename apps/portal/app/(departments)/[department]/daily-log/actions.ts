'use server';

import { AuthError, DatabaseError, ForbiddenError, ValidationError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { triggerPluginHook } from '@/lib/plugins/consumers';

const MAX_DAILY_LOG_NOTES_LENGTH = 2000;
const DATE_YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const createDailyLogSchema = z.object({
  departmentId: z.string().uuid('Invalid department ID'),
  today: z
    .string()
    .regex(DATE_YYYY_MM_DD_REGEX, 'Invalid date format (expected YYYY-MM-DD)')
    .optional(),
  shift: z.enum(['day', 'night']),
  notes: z
    .string()
    .max(MAX_DAILY_LOG_NOTES_LENGTH, 'Notes cannot exceed 2000 characters')
    .nullable(),
  isProduction: z.boolean().optional(),
  actualCoalTonnes: z.number().finite().min(0, 'Coal tonnage must be >= 0').optional(),
  actualWasteTonnes: z.number().finite().min(0, 'Waste tonnage must be >= 0').optional(),
});

export interface CreateDailyLogPayload {
  departmentId: string;
  today?: string;
  shift: 'day' | 'night';
  notes: string | null;
  isProduction?: boolean;
  actualCoalTonnes?: number;
  actualWasteTonnes?: number;
}

export async function createDailyLog(payload: CreateDailyLogPayload) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'createDailyLog' },
    });
  }

  const parsed = createDailyLogSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid daily log payload', {
      context: { action: 'createDailyLog' },
    });
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('role, department_id, accessible_departments')
    .eq('auth_id', user.id)
    .single();

  const isAuthorized =
    !employeeError &&
    employee !== null &&
    (employee.role === 'admin' ||
      employee.role === 'manager' ||
      employee.department_id === parsed.data.departmentId ||
      (Array.isArray(employee.accessible_departments) &&
        employee.accessible_departments.includes(parsed.data.departmentId)));

  if (!isAuthorized) {
    throw new ForbiddenError('Forbidden: insufficient department access for daily log', {
      context: { action: 'createDailyLog', departmentId: parsed.data.departmentId },
    });
  }

  const normalizedNotes = parsed.data.notes === '' ? null : parsed.data.notes;

  const { data: logData, error } = await supabase
    .from('daily_logs')
    .insert({
      department_id: parsed.data.departmentId,
      log_date: parsed.data.today,
      shift: parsed.data.shift,
      notes: normalizedNotes,
    })
    .select('id')
    .single();

  if (error) {
    throw new DatabaseError('Failed to create daily log', {
      operation: 'insert',
      table: 'daily_logs',
      context: { error: error.message },
    });
  }

  if (parsed.data.isProduction && logData) {
    const { error: prodError } = await supabase.from('production_logs').insert({
      daily_log_id: logData.id,
      coal_tonnes: parsed.data.actualCoalTonnes ?? 0,
      waste_tonnes: parsed.data.actualWasteTonnes ?? 0,
    });
    if (prodError) {
      throw new DatabaseError('Saved daily log, but failed to save production metrics', {
        operation: 'insert',
        table: 'production_logs',
        context: { error: prodError.message },
      });
    }
  }

  await cacheInvalidateTags(['table:daily_logs']);
  await triggerPluginHook('onLogCreated', {
    id: logData?.id,
    department_id: parsed.data.departmentId,
    log_date: parsed.data.today,
    shift: parsed.data.shift,
    notes: normalizedNotes,
    is_production: parsed.data.isProduction ?? false,
  });
  revalidatePath('/');
  return { success: true, id: logData?.id };
}
