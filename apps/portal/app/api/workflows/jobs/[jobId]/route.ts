import { NextRequest, NextResponse } from 'next/server';
import { authorizeWorkflowRequest } from '@/lib/api/telemetry-auth';
import { getWorkflowQueue } from '@/lib/workflows/queue';

const VALID_JOB_ID_PATTERN = /^[\w:-]{1,128}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const unauthorized = authorizeWorkflowRequest(req);
  if (unauthorized) {
    return unauthorized;
  }

  const { jobId } = await params;
  if (!VALID_JOB_ID_PATTERN.test(jobId)) {
    return NextResponse.json(
      { found: false, queueAvailable: false, jobId, message: 'Invalid jobId format' },
      { status: 400 }
    );
  }

  const activeQueue = getWorkflowQueue();
  if (!activeQueue) {
    return NextResponse.json({
      found: false,
      queueAvailable: false,
      jobId,
      message: 'Queue not wired',
    });
  }

  try {
    const job = await activeQueue.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { found: false, queueAvailable: true, jobId, message: 'Job not found' },
        { status: 404 }
      );
    }
    const state = await job.getState();
    return NextResponse.json({
      found: true,
      queueAvailable: true,
      jobId,
      state,
      attemptsMade: job.attemptsMade,
      madeAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      details: job.data ?? {},
    });
  } catch (_err: unknown) {
    return NextResponse.json(
      { found: false, queueAvailable: false, jobId, message: 'Lookup failed' },
      { status: 503 }
    );
  }
}
