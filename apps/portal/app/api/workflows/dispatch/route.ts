import { workflowDispatchSchema } from '@repo/contract';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeWorkflowRequest } from '@/lib/api/telemetry-auth';
import { getWorkflowQueue } from '@/lib/workflows/queue';

const WORKFLOW_JOB_NAME = 'execute-workflow';

export async function POST(req: NextRequest) {
  const unauthorized = authorizeWorkflowRequest(req);
  if (unauthorized) {
    return unauthorized;
  }

  const rawPayload = await req.json().catch(() => ({}));
  const parseResult = workflowDispatchSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid payload schema', details: parseResult.error } },
      { status: 400 }
    );
  }
  const payload = parseResult.data;

  const idempotencyKey = payload.idempotencyKey?.trim();
  const jobId = idempotencyKey
    ? `idem_${idempotencyKey}`
    : `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const jobData = {
    jobId,
    workflowId: payload.workflowId || 'custom_workflow',
    name: payload.name || 'n8n Automated Workflow',
    nodesCount: payload.nodes?.length || 0,
    edgesCount: payload.edges?.length || 0,
    triggeredBy: payload.triggeredBy || process.env.DEFAULT_TRIGGERED_BY || 'system',
    enqueuedAt: new Date().toISOString(),
    status: 'queued',
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };

  const activeQueue = getWorkflowQueue();
  if (!activeQueue) {
    return NextResponse.json({ success: true, jobId, queueStatus: 'simulated', details: jobData });
  }

  try {
    await activeQueue.add(WORKFLOW_JOB_NAME, jobData, {
      jobId,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    return NextResponse.json({ success: true, jobId, queueStatus: 'enqueued', details: jobData });
  } catch (_err: unknown) {
    return NextResponse.json(
      { success: false, queueStatus: 'unavailable', jobId, message: 'Queue unavailable' },
      { status: 503 }
    );
  }
}
