import { createLogger } from '@repo/logger';
import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { recordJobExecution } from '@/lib/observability/simple-metrics';
import { deliverQueuedWebhooks } from '@/lib/webhooks/deliveries';

const logger = createLogger('portal:cron-webhook-deliveries');

export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const authError = authorizeCronRequest(req);
  if (authError) {
    recordJobExecution('cron.webhook_deliveries', 0, false);
    return authError;
  }

  const startedAtMs = Date.now();
  try {
    const summary = await deliverQueuedWebhooks(50);
    recordJobExecution('cron.webhook_deliveries', Date.now() - startedAtMs, summary.failed === 0);
    logger.info({ ...summary }, 'Webhook delivery worker completed');
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    recordJobExecution('cron.webhook_deliveries', Date.now() - startedAtMs, false);
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Webhook delivery worker failed'
    );
    return NextResponse.json({ success: false, error: 'Webhook delivery failed' }, { status: 500 });
  }
}
