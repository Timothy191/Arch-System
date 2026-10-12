import { embedDashboardSchema } from '@repo/contract';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { getMetabaseEmbedUrl } from '@/lib/metabase/token';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, async () => {
    // 1. Authenticate user session
    const supabase = await createServerSupabaseClient();
    const user = await getUserSafely(supabase);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 2. Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const dashboardIdStr = searchParams.get('dashboardId');
    const departmentIdStr = searchParams.get('departmentId');

    // 3. Contract Validation
    const parsed = embedDashboardSchema.safeParse({
      dashboardId: dashboardIdStr,
      departmentId: departmentIdStr || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing dashboardId parameter',
          details: parsed.error.issues,
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    // 4. Generate signed token and iframe URL
    const iframeUrl = getMetabaseEmbedUrl(parsed.data.dashboardId, parsed.data.departmentId);

    const response = NextResponse.json({
      success: true,
      iframeUrl,
      expiresInSeconds: 600,
    });

    // Add CORS headers for internal applications
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return response;
  });
}
