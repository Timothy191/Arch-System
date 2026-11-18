import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { z } from 'zod';
import { withBodyLimit } from '@/lib/api/body-limit';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { logError } from '@/lib/errors/error-logger';
import { handleShiftReport } from '@/workflows/shift-report-compiler';

const ALLOWED_ROLES = new Set(['admin', 'supervisor', 'operator', 'control_room_operator']);
const CONTROL_ROOM_DEPT_ID = '0f160914-d92e-45d9-9547-d3d1a11ef6a1';

const generateReportSchema = z.object({
  shiftId: z.string().trim().min(1, 'shiftId is required').max(128, 'shiftId is too long'),
});

function hasControlRoomAccess(employee: {
  role: string;
  department_id?: string | null;
  accessible_departments?: string[] | null;
}): boolean {
  if (employee.role === 'admin') return true;
  if (
    employee.department_id === 'control-room' ||
    employee.department_id === CONTROL_ROOM_DEPT_ID
  ) {
    return true;
  }
  const accessible = employee.accessible_departments ?? [];
  return accessible.includes('control-room') || accessible.includes(CONTROL_ROOM_DEPT_ID);
}

export async function POST(request: Request) {
  return withRateLimit(request, () =>
    withBodyLimit(request, async () => {
      try {
        const supabase = await createServerSupabaseClient();
        const principal = await getAuthenticatedEmployee(supabase);
        if (!principal) {
          return NextResponse.json(
            { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
            { status: 401 }
          );
        }
        if (
          !principal.employee ||
          !ALLOWED_ROLES.has(principal.employee.role) ||
          !hasControlRoomAccess(principal.employee)
        ) {
          return NextResponse.json(
            { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } },
            { status: 403 }
          );
        }

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return NextResponse.json(
            { success: false, error: { message: 'Malformed JSON', code: 'API_ERROR' } },
            { status: 400 }
          );
        }

        const parsed = generateReportSchema.safeParse(rawBody);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: parsed.error.issues[0]?.message ?? 'Invalid request payload',
                code: 'API_ERROR',
              },
            },
            { status: 400 }
          );
        }

        const { shiftId } = parsed.data;

        // Start the durable workflow asynchronously to bypass 10s serverless timeout constraints
        const { runId } = await start(handleShiftReport, [shiftId]);

        return NextResponse.json({
          message: 'Shift report compilation workflow started',
          shiftId,
          runId,
        });
      } catch (error: unknown) {
        logError(error, { context: 'control_room_generate_report' });
        return NextResponse.json(
          { success: false, error: { message: 'Failed to start workflow', code: 'API_ERROR' } },
          { status: 500 }
        );
      }
    })
  );
}
