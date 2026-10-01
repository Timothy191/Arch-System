import { tkphAlertSchema } from '@repo/contract';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

export async function POST(req: Request) {
  return withBodyLimit(
    req,
    async () => {
      try {
        const body = await req.json();
        const data = tkphAlertSchema.parse(body);
        const jobId = randomUUID();

        if (data.threshold_exceeded) {
          // Generate a requisition draft for new tires (fire and forget)
          await Promise.allSettled([
            triggerTrackedWorkflow(jobId, '/webhook/tire-requisition', data),
          ]);
          const response = NextResponse.json({
            success: true,
            jobId,
            message: 'Workflow triggered for tire requisition',
          });
          return applyCors(req, response);
        }

        return applyCors(
          req,
          NextResponse.json({ success: true, message: 'Threshold not exceeded, no action taken' })
        );
      } catch (error) {
        return applyCors(
          req,
          NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
        );
      }
    },
    { maxSize: 10485760 }
  );
}
