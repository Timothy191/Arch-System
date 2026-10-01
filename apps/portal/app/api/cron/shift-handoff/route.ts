import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const jobId = randomUUID();
    // Runs at 05:45 and 17:45. Aggregates all anomalies and creates an AI summary for the incoming supervisor.
    await Promise.allSettled([
      triggerTrackedWorkflow(jobId, '/webhook/shift-handoff-generation', {
        shift_date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
      }),
    ]);
    return NextResponse.json({
      success: true,
      message: 'Shift handoff generation initiated',
      jobId,
    });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
