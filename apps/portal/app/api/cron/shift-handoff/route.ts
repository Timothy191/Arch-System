import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

export async function GET(req: Request) {
  const unauthorizedResponse = authorizeCronRequest(req);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
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
