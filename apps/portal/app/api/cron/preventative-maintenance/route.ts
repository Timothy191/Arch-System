import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const jobId = randomUUID();
    // Triggers n8n to sweep Fleet SMU (Service Meter Unit) hours against PM schedules (250hr, 500hr, etc)
    await Promise.allSettled([
      triggerTrackedWorkflow(jobId, '/webhook/pm-smu-sweep', {
        timestamp: new Date().toISOString(),
      }),
    ]);
    return NextResponse.json({ success: true, message: 'PM SMU sweep initiated', jobId });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
