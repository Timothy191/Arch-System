import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withBodyLimit } from '@/lib/api/body-limit';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { logError } from '@/lib/errors/error-logger';
import { revalidateTagInRouteHandler, updateTag } from '@/lib/server-cache';

const MAX_BODY_BYTES = 1024 * 1024;
const CONTROL_ROOM_DEPT_ID = '0f160914-d92e-45d9-9547-d3d1a11ef6a1';

const approveSchema = z.object({
  reportId: z.string().uuid(),
  approvalNote: z.string().max(1000).optional(),
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

export async function POST(req: NextRequest) {
  return withRateLimit(req, () =>
    withBodyLimit(
      req,
      async () => {
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
          if (!hasControlRoomAccess(employee)) {
            return NextResponse.json(
              {
                success: false,
                error: 'Control Room department access is required to approve shift reports',
              },
              { status: 403 }
            );
          }

          const rawBody = await req.text();
          if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
            return NextResponse.json(
              { success: false, error: 'Request body too large' },
              { status: 413 }
            );
          }

          let rawBodyParsed: unknown;
          try {
            rawBodyParsed = JSON.parse(rawBody);
          } catch {
            return NextResponse.json({ success: false, error: 'Malformed JSON' }, { status: 400 });
          }

          const parsed = approveSchema.safeParse(rawBodyParsed);
          if (!parsed.success) {
            return NextResponse.json(
              { success: false, error: 'Invalid payload', details: parsed.error.format() },
              { status: 400 }
            );
          }

          const { reportId, approvalNote } = parsed.data;

          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            'atomic_approve_shift_report',
            {
              p_report_id: reportId,
              p_approval_note: approvalNote ?? null,
              p_approver_id: employee.id,
            }
          );

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

          await updateTag(CACHE_TAGS.SHIFT_CLOSEOUT);
          await revalidateTagInRouteHandler(CACHE_TAGS.CONTROL_ROOM, 'max');
          await revalidateTagInRouteHandler(CACHE_TAGS.SHIFT_CLOSEOUT, 'max');

          return NextResponse.json({ success: true, result: rpcResult });
        } catch (error) {
          logError(error, { context: 'control_room_shift_approval' });
          return NextResponse.json(
            { success: false, error: 'Shift report approval failed' },
            { status: 500 }
          );
        }
      },
      { maxSize: MAX_BODY_BYTES }
    )
  );
}
