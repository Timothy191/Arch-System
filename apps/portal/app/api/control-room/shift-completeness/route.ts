import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { logError } from '@/lib/errors/error-logger';
import { getShiftCompleteness } from '@/lib/shift-completeness';

const CONTROL_ROOM_DEPT_ID = '0f160914-d92e-45d9-9547-d3d1a11ef6a1';
const _ALLOWED_ROLES = new Set(['admin', 'operator', 'supervisor', 'control_room_operator']);

const shiftCompletenessParams = z.object({
  deptId: z.uuid(),
  deptSlug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug'),
  date: z.iso.date(),
  shift: z.enum(['day', 'night']),
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

/** @swagger
 * /api/control-room/shift-completeness:
 *   get:
 *     summary: Get shift completeness metrics
 *     description: Returns completeness metrics for a specific department, date, and shift. Requires authentication.
 *     tags:
 *       - Control Room
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Department UUID
 *       - in: query
 *         name: deptSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Department slug
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Shift date (YYYY-MM-DD)
 *       - in: query
 *         name: shift
 *         required: true
 *         schema:
 *           type: string
 *           enum: [day, night]
 *         description: Shift type
 *     responses:
 *       200:
 *         description: Shift completeness data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     code:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     code:
 *                       type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     code:
 *                       type: string
 */

export async function GET(req: NextRequest) {
  return withRateLimit(req, async () => {
    try {
      const supabase = await createServerSupabaseClient();
      const principal = await getAuthenticatedEmployee(supabase);
      if (!principal) {
        return NextResponse.json(
          { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
          { status: 401 }
        );
      }
      if (!principal.employee || !hasControlRoomAccess(principal.employee)) {
        return NextResponse.json(
          { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } },
          { status: 403 }
        );
      }

      const { searchParams } = req.nextUrl;
      const rawParams = {
        deptId: searchParams.get('deptId'),
        deptSlug: searchParams.get('deptSlug'),
        date: searchParams.get('date'),
        shift: searchParams.get('shift'),
      };

      const missing = (Object.keys(rawParams) as Array<keyof typeof rawParams>).filter(
        (key) => !rawParams[key]
      );
      if (missing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `Missing required params: ${missing.join(', ')}`,
              code: 'API_ERROR',
            },
          },
          { status: 400 }
        );
      }

      const parsed = shiftCompletenessParams.safeParse(rawParams);
      if (!parsed.success) {
        const details = parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `Invalid query params: ${details}`,
              code: 'API_ERROR',
            },
          },
          { status: 400 }
        );
      }

      const startedAt = Date.now();
      const completeness = await getShiftCompleteness(
        supabase,
        parsed.data.deptId,
        parsed.data.deptSlug,
        parsed.data.date,
        parsed.data.shift
      );
      const queryDurationMs = Date.now() - startedAt;

      return NextResponse.json(completeness, {
        headers: {
          'Server-Timing': `completeness_db;dur=${queryDurationMs}, total;dur=${queryDurationMs}`,
        },
      });
    } catch (error: unknown) {
      logError(error, { context: 'control_room_shift_completeness' });
      return NextResponse.json(
        { success: false, error: { message: 'Internal server error', code: 'API_ERROR' } },
        { status: 500 }
      );
    }
  });
}
