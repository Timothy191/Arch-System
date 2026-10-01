'use server';

import { multiSiteShiftReportSchema } from '@repo/contract/schemas/multi-site-production.schema';
import {
  lockAndSignShiftSchema,
  unifiedShiftReportSchema,
} from '@repo/contract/schemas/shift-compilation.schema';
import type { MultiSiteShiftReport } from '@repo/contract/types/multi-site-production.types';
import type {
  LockAndSignShiftInput,
  UnifiedShiftReport,
} from '@repo/contract/types/shift-compilation.types';
import { AuthError, ForbiddenError, ValidationError } from '@repo/errors';
import { serverLogger } from '@repo/logger';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { logAuditEvent } from '@/lib/audit';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

// AGENT-TRACE: Server action fetching unified shift compilation from PostgreSQL RPC.
export async function getUnifiedShiftReport(
  departmentId: string,
  shiftDate: string,
  shiftType: 'day' | 'night'
): Promise<{ data?: UnifiedShiftReport; error?: string }> {
  try {
    const principal = await getAuthenticatedEmployee();
    if (!principal) {
      throw new AuthError('Unauthorized: valid session required', {
        context: { operation: 'getUnifiedShiftReport' },
      });
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('get_unified_shift_compilation', {
      p_department_id: departmentId,
      p_shift_date: shiftDate,
      p_shift_type: shiftType,
    });

    if (error) {
      serverLogger.error({
        err: new Error(error.message),
        context: 'getUnifiedShiftReport:rpc',
        details: error,
      });
      return { error: error.message };
    }

    const parsed = unifiedShiftReportSchema.safeParse(data);
    if (!parsed.success) {
      serverLogger.error({
        err: new Error('Failed to validate shift report data structure'),
        context: 'getUnifiedShiftReport:validation',
        details: parsed.error.issues,
      });
      return { error: 'Failed to validate shift report data structure' };
    }

    return { data: parsed.data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { error: message };
  }
}

// AGENT-TRACE: Server action fetching multi-site shift compilation from PostgreSQL RPC.
export async function getMultiSiteShiftReport(
  departmentId: string,
  shiftDate: string,
  shiftType: 'day' | 'night'
): Promise<{ data?: MultiSiteShiftReport; error?: string }> {
  try {
    const principal = await getAuthenticatedEmployee();
    if (!principal) {
      throw new AuthError('Unauthorized: valid session required', {
        context: { operation: 'getMultiSiteShiftReport' },
      });
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('get_multi_site_shift_compilation', {
      p_department_id: departmentId,
      p_shift_date: shiftDate,
      p_shift_type: shiftType,
    });

    if (error) {
      serverLogger.error({
        err: new Error(error.message),
        context: 'getMultiSiteShiftReport:rpc',
        details: error,
      });
      return { error: error.message };
    }

    const parsed = multiSiteShiftReportSchema.safeParse(data);
    if (!parsed.success) {
      serverLogger.error({
        err: new Error('Failed to validate multi-site shift report data structure'),
        context: 'getMultiSiteShiftReport:validation',
        details: parsed.error.issues,
      });
      return { error: 'Failed to validate multi-site shift report data structure' };
    }

    return { data: parsed.data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { error: message };
  }
}

// AGENT-TRACE: Server action locking and signing the unified shift closeout with supervisor PIN verification.
export async function lockAndSignUnifiedShift(
  payload: LockAndSignShiftInput & { departmentSlug?: string }
): Promise<{ success: boolean; error?: string; jobId?: string }> {
  try {
    const validated = lockAndSignShiftSchema.parse(payload);

    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal) {
      throw new AuthError('Unauthorized', {
        context: { operation: 'lockAndSignUnifiedShift' },
      });
    }

    // 1. Fetch current user employee record (PIN + name fields beyond the
    // helper's common shape — kept here so the auth cache stays small).
    const { data: currentEmployee } = await supabase
      .from('employees')
      .select('id, role, full_name, pin_hash')
      .eq('auth_id', principal.user.id)
      .single();

    if (!currentEmployee) {
      throw new AuthError('Employee record not found', {
        context: { operation: 'lockAndSignUnifiedShift' },
      });
    }

    // 2. Identify approving supervisor (either specified or current employee if supervisor/admin)
    let approver = currentEmployee;
    if (validated.approvedById && validated.approvedById !== currentEmployee.id) {
      const serviceClient = createServiceRoleClient();
      const { data: specifiedApprover } = await serviceClient
        .from('employees')
        .select('id, role, full_name, pin_hash')
        .eq('id', validated.approvedById)
        .single();

      if (!specifiedApprover) {
        return { success: false, error: 'Approving supervisor not found' };
      }
      approver = specifiedApprover;
    }

    if (approver.role !== 'supervisor' && approver.role !== 'admin') {
      throw new ForbiddenError('Only supervisors and admins can approve shift closeout', {
        context: { role: approver.role },
      });
    }

    if (!approver.pin_hash) {
      return { success: false, error: 'Supervisor does not have a PIN configured' };
    }

    // 3. Verify BCrypt PIN
    const isPinValid = await bcrypt.compare(validated.pin, approver.pin_hash);
    if (!isPinValid) {
      return { success: false, error: 'Invalid supervisor PIN' };
    }

    // 4. Update / Insert Shift Status via service role client
    const serviceClient = createServiceRoleClient();
    const { data: updatedStatus, error: upsertError } = await serviceClient
      .from('shift_status')
      .upsert(
        {
          department_id: validated.departmentId,
          shift_date: validated.shiftDate,
          shift_type: validated.shiftType,
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: currentEmployee.id,
          approved_by: approver.id,
          notes: validated.notes || null,
        },
        {
          onConflict: 'department_id,shift_date,shift_type',
        }
      )
      .select('id')
      .single();

    if (upsertError) {
      serverLogger.error({
        err: new Error(upsertError.message),
        context: 'lockAndSignUnifiedShift:upsert',
        details: upsertError,
      });
      return { success: false, error: upsertError.message };
    }

    // 5. Audit logging
    await logAuditEvent({
      action: 'update',
      tableName: 'shift_status',
      recordId: updatedStatus?.id,
      departmentId: validated.departmentId,
      newData: {
        status: 'closed',
        approved_by: approver.id,
        closed_by: currentEmployee.id,
        shift_date: validated.shiftDate,
        shift_type: validated.shiftType,
      },
    });

    const slug = payload.departmentSlug || 'control-room';
    revalidatePath(`/${slug}/shift-compilation`);
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/shift-coverage`);

    // 6. Trigger background generation of Shift PDF via n8n & Redis
    const jobId = `shift-closeout-${updatedStatus?.id}-${Date.now()}`;
    await triggerTrackedWorkflow(jobId, '/webhook/shift-closed', {
      departmentId: validated.departmentId,
      shiftDate: validated.shiftDate,
      shiftType: validated.shiftType,
      statusId: updatedStatus?.id,
    });

    return { success: true, jobId };
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Failed to sign and close shift';
    return { success: false, error: message };
  }
}
