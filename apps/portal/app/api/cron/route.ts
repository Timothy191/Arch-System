import { createLogger } from '@repo/logger';
import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

const logger = createLogger('portal:cron-orchestrator');

export interface CronScheduleDescriptor {
  readonly path: string;
  readonly schedule: string;
  readonly description: string;
}

export const REGISTERED_VERCEL_CRONS: readonly CronScheduleDescriptor[] = [
  {
    path: '/api/cron',
    schedule: '0 10 * * *',
    description:
      'Daily Vercel cron heartbeat, operational telemetry verification, and schedule registry',
  },
  {
    path: '/api/cron/shift-handoff',
    schedule: '45 5,17 * * *',
    description:
      'Shift handoff summary aggregation 15 minutes prior to 06:00 and 18:00 shift change',
  },
  {
    path: '/api/cron/contractor-expiry',
    schedule: '0 6 * * *',
    description: 'Daily contractor credential and medical certificate expiration check',
  },
  {
    path: '/api/cron/preventative-maintenance',
    schedule: '0 2 * * *',
    description: 'Daily plant and mobile equipment preventative maintenance work-order generator',
  },
  {
    path: '/api/cron/research-briefing',
    schedule: '0 7 * * *',
    description: 'Daily autonomous executive and operations research briefing dispatch',
  },
] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const authError = authorizeCronRequest(req);
  if (authError) {
    recordJobExecution('cron.heartbeat', 0, false);
    return authError;
  }

  const executedAtIso = new Date().toISOString();
  recordJobExecution('cron.heartbeat', 0, true);

  logger.info(
    {
      executedAt: executedAtIso,
      registeredJobsCount: REGISTERED_VERCEL_CRONS.length,
    },
    'Vercel Cron heartbeat executed successfully'
  );

  return NextResponse.json({
    ok: true,
    status: 'healthy',
    executedAt: executedAtIso,
    jobs: REGISTERED_VERCEL_CRONS,
  });
}
