import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logError } from '@/lib/errors/error-logger';

const approveSchema = z.object({
  reportId: z.string().uuid(),
  approvalNote: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!principal.employee) {
      return NextResponse.json(
        { success: false, error: 'Employee record not found' },
        { status: 403 }
      );
    }

    const { employee } = principal;
    if (!['supervisor', 'admin'].includes(employee.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only supervisors and administrators can approve shift reports',
        },
        { status: 403 }
      );
    }

    const rawBody = await req.json();
    const parsed = approveSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { reportId, approvalNote } = parsed.data;

    const { data: rpcResult, error: rpcError } = await supabase.rpc('atomic_approve_shift_report', {
      p_report_id: reportId,
      p_approval_note: approvalNote ?? null,
      p_approver_id: employee.id,
    });

    if (rpcError) {
      if (rpcError.message.includes('Separation of duties')) {
        return NextResponse.json(
          {
            success: false,
            code: 'SEPARATION_OF_DUTIES_VIOLATION',
            error:
              'Separation of duties violation: Submitter cannot approve their own shift closeout',
          },
          { status: 403 }
        );
      }
      throw new Error(rpcError.message);
    }

    return NextResponse.json({ success: true, result: rpcResult });
  } catch (error) {
    logError(error, { context: 'control_room_shift_approval' });
    return NextResponse.json(
      { success: false, error: 'Shift report approval failed' },
      { status: 500 }
    );
  }
}
