import { randomUUID } from 'node:crypto';
import { logger } from '@repo/logger/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

export const maxDuration = 60;

const EXPIRY_WINDOW_HOURS = 48;
const METRIC_JOB_ID = 'cron.contractor-expiry';

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
    const cutoffIso = new Date(Date.now() + EXPIRY_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const [dispatchResult] = await Promise.allSettled([
      triggerTrackedWorkflow(
        jobId,
        '/webhook/contractor-expiry-check',
        {
          target_hours: EXPIRY_WINDOW_HOURS,
          run_timestamp: runTimestamp,
        },
        {
          awaitCompletion: true,
          fallback: async () => {
            const supabase = createServiceRoleClient();
            const { data: expiringBadges, error } = await supabase
              .from('badges')
              .select('id, qr_code, expires_at')
              .eq('is_active', true)
              .not('expires_at', 'is', null)
              .lte('expires_at', cutoffIso);

            if (error) {
              throw error;
            }

            const expiringCount = expiringBadges?.length ?? 0;
            logger.info({
              event: 'contractor_expiry_fallback_completed',
              jobId,
              expiringCount,
              cutoffIso,
            });

            if (expiringCount > 0 && process.env.NOVU_API_KEY) {
              try {
                const { sendOperationalAlert } = await import('@repo/utils/novu');
                await sendOperationalAlert('access-control-ops', 'contractor-expiry-alert', {
                  expiringCount,
                  cutoffIso,
                  runTimestamp,
                });
              } catch (alertErr) {
                logger.warn({
                  event: 'contractor_expiry_alert_failed',
                  jobId,
                  error: alertErr instanceof Error ? alertErr.message : String(alertErr),
                });
              }
            }

            return { expiringCount, cutoffIso, runTimestamp };
          },
        }
      ),
    ]);

    if (dispatchResult.status === 'rejected' || dispatchResult.value.status === 'failed') {
      recordJobExecution(METRIC_JOB_ID, Date.now() - startedAtMs, false);
      return NextResponse.json(
        { success: false, error: 'Failed to dispatch contractor expiry workflow', jobId },
        { status: 502 }
      );
    }

    recordJobExecution(METRIC_JOB_ID, Date.now() - startedAtMs, true);
    return NextResponse.json({
      success: true,
      message: 'Contractor expiry sweep completed',
      jobId,
      result: dispatchResult.value.result ?? null,
    });
  } catch (err) {
    recordJobExecution(METRIC_JOB_ID, Date.now() - startedAtMs, false);
    logger.error(
      {
        event: 'contractor_expiry_cron_failed',
        err: err instanceof Error ? err.message : String(err),
      },
      'Contractor expiry cron failed'
    );
    return NextResponse.json(
      { success: false, error: 'Failed to initiate sweep' },
      { status: 500 }
    );
  }
}
