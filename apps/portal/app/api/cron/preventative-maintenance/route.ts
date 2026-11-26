import { randomUUID } from 'node:crypto';
import { logger } from '@repo/logger/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

export const maxDuration = 60;

const METRIC_JOB_ID = 'cron.preventative-maintenance';

export async function GET(req: Request) {
  const unauthorizedResponse = authorizeCronRequest(req);
  if (unauthorizedResponse) {
    recordJobExecution(METRIC_JOB_ID, 0, false);
    return unauthorizedResponse;
  }

  const startedAtMs = Date.now();
  try {
    const jobId = randomUUID();
    const runTimestamp = new Date().toISOString();
    const [dispatchResult] = await Promise.allSettled([
      triggerTrackedWorkflow(
        jobId,
        '/webhook/pm-smu-sweep',
        { timestamp: runTimestamp },
        {
          awaitCompletion: true,
          fallback: async () => {
            const supabase = createServiceRoleClient();
            const { count, error } = await supabase
              .from('machines')
              .select('id', { count: 'exact', head: true })
              .is('deleted_at', null);

            if (error) {
              throw error;
            }

            const activeMachinesCount = count ?? 0;
            logger.info({
              event: 'pm_smu_sweep_fallback_completed',
              jobId,
              activeMachinesCount,
              runTimestamp,
            });
            return { activeMachinesCount, runTimestamp };
          },
        }
      ),
    ]);

    if (dispatchResult.status === 'rejected' || dispatchResult.value.status === 'failed') {
      recordJobExecution(METRIC_JOB_ID, Date.now() - startedAtMs, false);
      return NextResponse.json(
        { success: false, error: 'Failed to dispatch PM SMU sweep workflow', jobId },
        { status: 502 }
      );
    }

    recordJobExecution(METRIC_JOB_ID, Date.now() - startedAtMs, true);
    return NextResponse.json({
      success: true,
      message: 'PM SMU sweep completed',
      jobId,
      result: dispatchResult.value.result ?? null,
    });
  } catch (err) {
    recordJobExecution(METRIC_JOB_ID, Date.now() - startedAtMs, false);
    logger.error(
      { event: 'pm_smu_sweep_cron_failed', err: err instanceof Error ? err.message : String(err) },
      'Preventative maintenance cron failed'
    );
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
