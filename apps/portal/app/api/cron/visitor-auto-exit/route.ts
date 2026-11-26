import { logger } from '@repo/logger/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { NextResponse } from 'next/server';
import { executeVisitorAutoExitSweep } from '@/app/(departments)/access-control/visitors/auto-exit-service';
import { triggerOperationalAlertWorkflow } from '@/lib/alerts/operational-alert-triggers';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

export const maxDuration = 60;

const JOB_ID = 'cron.visitor-auto-exit';

export async function GET(req: Request) {
  const unauthorizedResponse = authorizeCronRequest(req);
  if (unauthorizedResponse) {
    recordJobExecution(JOB_ID, 0, false);
    return unauthorizedResponse;
  }

  const startedAtMs = Date.now();
  try {
    const supabase = createServiceRoleClient();
    const { data: deptRow } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'access-control')
      .maybeSingle();

    if (!deptRow?.id) {
      recordJobExecution(JOB_ID, Date.now() - startedAtMs, true);
      return NextResponse.json({ success: true, autoExited: [] });
    }

    const result = await executeVisitorAutoExitSweep(supabase, deptRow.id);
    await triggerOperationalAlertWorkflow({
      event: {
        eventType: 'visitor.auto_exit.completed',
        source: 'cron.visitor-auto-exit',
        autoExitedCount: result.autoExited.length,
        visitorIds: result.autoExited.map((visitor) => visitor.id),
        departmentId: deptRow.id,
        timestamp: new Date().toISOString(),
      },
    });
    recordJobExecution(JOB_ID, Date.now() - startedAtMs, true);
    return NextResponse.json({
      success: true,
      autoExitedCount: result.autoExited.length,
      autoExited: result.autoExited,
    });
  } catch (err) {
    recordJobExecution(JOB_ID, Date.now() - startedAtMs, false);
    logger.error(
      {
        event: 'visitor_auto_exit_cron_failed',
        err: err instanceof Error ? err.message : String(err),
      },
      'Visitor auto-exit cron failed'
    );
    return NextResponse.json(
      { success: false, error: 'Failed to execute visitor auto-exit sweep' },
      { status: 500 }
    );
  }
}
