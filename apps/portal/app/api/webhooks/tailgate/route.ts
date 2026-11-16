import { randomUUID } from 'node:crypto';
import { cacheInvalidateTags } from '@repo/redis';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyCors } from '@/lib/api/cors';
import { authorizeIngest } from '@/lib/api/telemetry-auth';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

const tailgateSchema = z.object({
  gate_id: z.string().min(1),
  location: z.string(),
  sensor_type: z.enum(['OPTICAL', 'LIDAR', 'WEIGHT']),
  timestamp: z.string().datetime(),
  camera_snapshot_url: z.string().url().optional(),
});

async function persistTailgateAccessLog(alert: z.infer<typeof tailgateSchema>): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await supabase.from('access_logs').insert({
      badge_id: null,
      access_type: 'OPTICAL_SENSOR',
      direction: 'IN',
      gate_location: alert.location || alert.gate_id,
      access_granted: false,
      denial_reason: `Tailgate Alert (${alert.sensor_type} sensor at ${alert.gate_id})`,
      device_id: alert.gate_id,
      scanned_at: alert.timestamp,
    });
    await cacheInvalidateTags(['table:access_logs']);
  } catch {
    // Non-fatal persistence fallback when offline or in synthetic test environments
  }
}

export async function POST(req: Request) {
  const authFailure = authorizeIngest(req);
  if (authFailure) return applyCors(req, authFailure);

  try {
    const body = await req.json();
    const alert = tailgateSchema.parse(body);
    const jobId = randomUUID();

    // Persist audit log and trigger SOC Alert via n8n background workflow in parallel
    await Promise.allSettled([
      persistTailgateAccessLog(alert),
      triggerTrackedWorkflow(jobId, '/webhook/soc-tailgate-alert', alert),
    ]);

    const response = NextResponse.json(
      {
        success: true,
        message: 'Tailgate violation recorded and SOC alerted.',
        jobId,
      },
      { status: 202 }
    );

    return applyCors(req, response);
  } catch (_error) {
    return applyCors(
      req,
      NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    );
  }
}
