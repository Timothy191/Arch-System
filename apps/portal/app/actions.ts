'use server';

import { monthlyReportInputSchema } from '@repo/contract/schemas/form.schema';
import { AuthError, ForbiddenError, isAppError, ValidationError } from '@repo/errors';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { aiGenerateEmbeddingEvent, inngest } from '@repo/utils/inngest';
import { redirect } from 'next/navigation';
import { logError } from '@/lib/errors/error-logger';
import { updateTagInAction } from '@/lib/server-cache';

export interface ServerActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  url?: string;
  error?: string;
  code?: string;
}

export async function logout(): Promise<never> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function speculativeEmbedShiftLog(
  text: string
): Promise<ServerActionResponse<{ queued: boolean }>> {
  try {
    // Validate that the user is authenticated
    const principal = await getAuthenticatedEmployee();
    if (!principal) {
      throw new AuthError('Unauthorized');
    }

    if (!text || text.trim() === '') {
      return { success: true, data: { queued: false } };
    }

    await inngest.send({
      name: aiGenerateEmbeddingEvent,
      data: {
        text,
        userId: principal.user.id,
      },
    });

    return { success: true, data: { queued: true } };
  } catch (err) {
    if (isAppError(err)) {
      return { success: false, error: err.message, code: err.code ?? 'AUTH_ERROR' };
    }

    // Log error but do not fail the user's critical operation path
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'speculative_embed_queue_failed',
    });

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
      code: 'INTERNAL_ERROR',
    };
  }
}

export async function revalidateRSC(tags: string[]): Promise<ServerActionResponse> {
  try {
    // Always validate the user at the top
    const principal = await getAuthenticatedEmployee();
    if (!principal) {
      throw new AuthError('Unauthorized');
    }

    for (const tag of tags) {
      updateTagInAction(tag);
    }
    return { success: true };
  } catch (err) {
    if (isAppError(err)) {
      return { success: false, error: err.message, code: err.code ?? 'AUTH_ERROR' };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
      code: 'INTERNAL_ERROR',
    };
  }
}

export async function generateMonthlyReport(
  rawReportData: unknown,
  departmentId?: string
): Promise<ServerActionResponse<{ url: string }>> {
  try {
    const principal = await getAuthenticatedEmployee();
    if (!principal?.employee) {
      throw new AuthError('Unauthorized');
    }
    const { user, employee } = principal;

    // AGENT-TRACE: Enforce strict runtime schema validation via @repo/contract
    const reportData = monthlyReportInputSchema.parse(rawReportData);

    if (employee.role !== 'admin' && employee.role !== 'manager') {
      throw new ForbiddenError('Unauthorized: Insufficient permissions');
    }

    const supabase = await createServerSupabaseClient();
    const { pdf } = await import('@react-pdf/renderer');
    const { ReportTemplate } = await import('@/features/analytics/components/ReportTemplate');
    const React = await import('react');

    // Use employee department ID as fallback for folder categorization
    const deptId = departmentId || employee.department_id;
    if (!deptId) {
      throw new ValidationError('Department ID is required to determine storage permissions');
    }

    const doc = React.createElement(ReportTemplate, { data: reportData });
    const buffer = await pdf(doc as any).toBuffer();

    const filename = `${deptId}/${user.id}/report-${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filename, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filename, 3600);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Signed URL creation failed: ${signedError?.message ?? 'URL not generated'}`);
    }

    return { success: true, url: signedData.signedUrl };
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as any).name === 'ZodError' &&
      'issues' in err &&
      Array.isArray((err as any).issues)
    ) {
      return {
        success: false,
        error: (err as any).issues.map((i: any) => i.message).join(', '),
        code: 'VALIDATION_ERROR',
      };
    }
    if (isAppError(err)) {
      return {
        success: false,
        error: err.message,
        code: err.code ?? 'APP_ERROR',
      };
    }
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'generate_monthly_report',
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
      code: 'INTERNAL_ERROR',
    };
  }
}
