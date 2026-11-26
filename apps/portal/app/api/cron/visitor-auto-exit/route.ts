import { createServiceRoleClient } from '@repo/supabase/service-role';
import { NextResponse } from 'next/server';
import { executeVisitorAutoExitSweep } from '@/app/(departments)/access-control/visitors/auto-exit-service';
import { authorizeCronRequest } from '@/lib/api/cron-auth';

export async function GET(req: Request) {
  const unauthorizedResponse = authorizeCronRequest(req);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: deptRow } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'access-control')
      .maybeSingle();

    if (!deptRow?.id) {
      return NextResponse.json({ success: true, autoExited: [] });
    }

    const result = await executeVisitorAutoExitSweep(supabase, deptRow.id);
    return NextResponse.json({
      success: true,
      autoExitedCount: result.autoExited.length,
      autoExited: result.autoExited,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to execute visitor auto-exit sweep' },
      { status: 500 }
    );
  }
}
