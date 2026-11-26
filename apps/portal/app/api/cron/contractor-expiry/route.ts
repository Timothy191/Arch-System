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
    const [dispatchResult] = await Promise.allSettled([
      triggerTrackedWorkflow(
        jobId,
        '/webhook/contractor-expiry-check',
        {
          target_hours: 48,
          run_timestamp: new Date().toISOString(),
        },
        { awaitCompletion: true }
      ),
    ]);

    if (dispatchResult.status === 'rejected' || dispatchResult.value.status === 'failed') {
      return NextResponse.json(
        { success: false, error: 'Failed to dispatch contractor expiry workflow', jobId },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contractor expiry sweep initiated',
      jobId,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to initiate sweep' },
      { status: 500 }
    );
  }
}
