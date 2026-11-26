import { logger } from '@repo/logger/server';
import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { recordJobExecution } from '@/lib/observability/simple-metrics';
import { captureAndPersistSloSnapshot } from '@/lib/observability/slo-snapshot';

export const maxDuration = 60;

const JOB_ID = 'cron.observability-slo';
const HTTP_INTERNAL_ERROR = 500;

export async function GET(req: Request) {
  const unauthorizedResponse = authorizeCronRequest(req);
  if (unauthorizedResponse) {
    recordJobExecution(JOB_ID, 0, false);
    return unauthorizedResponse;
  }

  const startedAtMs = Date.now();
  try {
    const snapshot = await captureAndPersistSloSnapshot();
    recordJobExecution(JOB_ID, Date.now() - startedAtMs, true);

    return NextResponse.json({
      success: true,
      recordedTargets: snapshot.recordedTargets,
      persistence: snapshot.persistence,
      targets: snapshot.summaries.map((summary) => ({
        targetId: summary.targetId,
        sla24hPct: summary.sla24hPct,
        sloBudgetState: summary.sloBudgetState,
        p95LatencyMs: summary.p95LatencyMs,
      })),
    });
  } catch (err) {
    recordJobExecution(JOB_ID, Date.now() - startedAtMs, false);
    logger.error(
      {
        event: 'observability_slo_cron_failed',
        err: err instanceof Error ? err.message : String(err),
      },
      'Observability SLO cron failed'
    );
    return NextResponse.json({ success: false }, { status: HTTP_INTERNAL_ERROR });
  }
}
