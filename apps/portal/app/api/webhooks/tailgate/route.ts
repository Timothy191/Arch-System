import { randomUUID } from 'node:crypto';
import { cacheInvalidateTags } from '@repo/redis';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { authorizeIngest } from '@/lib/api/telemetry-auth';
import { logError } from '@/lib/errors/error-logger';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

const MAX_TAILGATE_BODY_BYTES = 262_144;

const tailgateSchema = z.object({
  gate_id: z.string().min(1),
  location: z.string(),
  sensor_type: z.enum(['OPTICAL', 'LIDAR', 'WEIGHT']),
  timestamp: z.string().datetime(),
  camera_snapshot_url: z.string().url().optional(),
});

async function persistTailgateAccessLog(alert: z.infer<typeof tailgateSchema>): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('access_logs').insert({
    badge_id: null,
    access_type: 'OPTICAL_SENSOR',
    direction: 'IN',
    gate_location: alert.location || alert.gate_id,
    access_granted: false,
    denial_reason: `Tailgate Alert (${alert.sensor_type} sensor at ${alert.gate_id})`,
    device_id: alert.gate_id,
    scanned_at: alert.timestamp,
  });
  if (error) {
    await logError(new Error(error.message), { context: 'tailgate_access_log_insert_failed' });
    return false;
  }
  await cacheInvalidateTags(['table:access_logs']);
  return true;
}

async function handleTailgatePost(req: Request): Promise<NextResponse> {
  const authFailure = authorizeIngest(req);
  if (authFailure) return authFailure;

  try {
    const body = await req.json();
    const alert = tailgateSchema.parse(body);
    const jobId = randomUUID();

    // Persist audit log and trigger SOC Alert via n8n background workflow in parallel
    const [persistResult, workflowResult] = await Promise.allSettled([
      persistTailgateAccessLog(alert),
      triggerTrackedWorkflow(jobId, '/webhook/soc-tailgate-alert', alert, {
        awaitCompletion: true,
      }),
    ]);

    const persisted = persistResult.status === 'fulfilled' && persistResult.value;
    const socAlerted =
      workflowResult.status === 'fulfilled' &&
      Boolean((workflowResult.value as { success?: boolean } | undefined)?.success ?? true);

    if (!persisted && !socAlerted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to persist tailgate event and notify SOC',
          persisted,
          socAlerted,
          jobId,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        persisted,
        socAlerted,
        message: persisted
          ? 'Tailgate violation recorded.'
          : 'SOC alerted, but access_logs persistence failed.',
        jobId,
      },
      { status: 202 }
    );
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const response = await withRateLimit(req, () =>
    withBodyLimit(req, () => handleTailgatePost(req), { maxSize: MAX_TAILGATE_BODY_BYTES })
  );
  return applyCors(req, response);
}
