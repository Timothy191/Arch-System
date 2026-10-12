import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getShiftCompleteness } from '@/lib/shift-completeness';

/**
 * @swagger
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
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
      { status: 401 }
    );
  }

  const { searchParams } = req.nextUrl;
  const deptId = searchParams.get('deptId');
  const deptSlug = searchParams.get('deptSlug');
  const date = searchParams.get('date');
  const shift = searchParams.get('shift') as 'day' | 'night' | null;

  if (!deptId || !deptSlug || !date || !shift) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Missing required params: deptId, deptSlug, date, shift',
          code: 'API_ERROR',
        },
      },
      { status: 400 }
    );
  }

  const completeness = await getShiftCompleteness(supabase, deptId, deptSlug, date, shift);

  return NextResponse.json(completeness);
}
