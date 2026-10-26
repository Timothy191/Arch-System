import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { handleShiftReport } from '@/workflows/shift-report-compiler';

const ALLOWED_ROLES = ['admin', 'supervisor', 'operator', 'control_room_operator'];

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    if (!principal.employee || !ALLOWED_ROLES.includes(principal.employee.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }

    const { shiftId } = await request.json();

    if (!shiftId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing shiftId', code: 'API_ERROR' } },
        { status: 400 }
      );
    }

    // Start the durable workflow asynchronously to bypass 10s serverless timeout constraints
    const { runId } = await start(handleShiftReport, [shiftId]);

    return NextResponse.json({
      message: 'Shift report compilation workflow started',
      shiftId,
      runId,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Failed to start workflow', code: 'API_ERROR' } },
      { status: 500 }
    );
  }
}
