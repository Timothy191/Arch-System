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
      triggerTrackedWorkflow(jobId, '/webhook/pm-smu-sweep', {
        timestamp: new Date().toISOString(),
      }),
    ]);

    if (dispatchResult.status === 'rejected') {
      return NextResponse.json(
        { success: false, error: 'Failed to dispatch PM SMU sweep workflow', jobId },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, message: 'PM SMU sweep initiated', jobId });
  } catch (_error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
