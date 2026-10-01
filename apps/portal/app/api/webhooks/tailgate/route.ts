import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyCors } from '@/lib/api/cors';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

const tailgateSchema = z.object({
  gate_id: z.string().min(1),
  location: z.string(),
  sensor_type: z.enum(['OPTICAL', 'LIDAR', 'WEIGHT']),
  timestamp: z.string().datetime(),
  camera_snapshot_url: z.string().url().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const alert = tailgateSchema.parse(body);
    const jobId = randomUUID();

    // Trigger SOC Alert via n8n background workflow
    await Promise.allSettled([triggerTrackedWorkflow(jobId, '/webhook/soc-tailgate-alert', alert)]);

    const response = NextResponse.json(
      {
        success: true,
        message: 'Tailgate violation recorded and SOC alerted.',
        jobId,
      },
      { status: 202 }
    );

    return applyCors(req, response);
  } catch (error) {
    return applyCors(
      req,
      NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    );
  }
}
