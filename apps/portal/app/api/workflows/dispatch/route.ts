import { workflowDispatchSchema } from '@repo/contract';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { authorizeWorkflowRequest } from '@/lib/api/telemetry-auth';
import { logError } from '@/lib/errors/error-logger';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';
import { getWorkflowQueue } from '@/lib/workflows/queue';

const WORKFLOW_JOB_NAME = 'execute-workflow';
const JOB_COMPLETE_RETENTION_SECONDS = 3600;
const JOB_FAIL_RETENTION_SECONDS = 86_400;
const MAX_JOB_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 5000;
const MAX_DISPATCH_BODY_BYTES = 262_144;

function isBullMqWorkerDeployed(): boolean {
  return process.env.WORKFLOW_WORKER_ENABLED === 'true';
}

async function handleWorkflowDispatch(req: NextRequest): Promise<NextResponse> {
  const secretFailure = authorizeWorkflowRequest(req);
  if (secretFailure) {
    const principal = await getAuthenticatedEmployee().catch(() => null);
    if (principal?.employee?.role !== 'admin') {
      return secretFailure;
    }
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

  const workerDeployed = isBullMqWorkerDeployed();
  if (!workerDeployed) {
    const directResult = await triggerTrackedWorkflow(
      jobId,
      `/webhook/${jobData.workflowId}`,
      jobData,
      { awaitCompletion: true }
    );
    const didSucceed = directResult.status === 'completed';
    return NextResponse.json(
      {
        success: didSucceed,
        jobId,
        queueStatus: didSucceed ? 'executed_direct' : 'failed',
        workerDeployed: false,
        details: jobData,
        ...(directResult.error ? { error: directResult.error } : {}),
      },
      { status: didSucceed ? 200 : 502 }
    );
  }

  const activeQueue = getWorkflowQueue();
  if (!activeQueue) {
    return NextResponse.json(
      {
        success: false,
        queueStatus: 'unavailable',
        workerDeployed,
        jobId,
        message: 'Workflow queue is not configured (no Redis connection)',
      },
      { status: 503 }
    );
  }

  try {
    await activeQueue.add(WORKFLOW_JOB_NAME, jobData, {
      jobId,
      removeOnComplete: { age: JOB_COMPLETE_RETENTION_SECONDS },
      removeOnFail: { age: JOB_FAIL_RETENTION_SECONDS },
      attempts: MAX_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: BACKOFF_DELAY_MS },
    });
    return NextResponse.json({
      success: true,
      jobId,
      queueStatus: 'enqueued',
      workerDeployed,
      details: jobData,
    });
  } catch (err: unknown) {
    await logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'workflow_dispatch_enqueue_failed',
      jobId,
    });
    return NextResponse.json(
      {
        success: false,
        queueStatus: 'unavailable',
        workerDeployed,
        jobId,
        message: 'Queue unavailable',
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, () =>
    withBodyLimit(req, () => handleWorkflowDispatch(req), { maxSize: MAX_DISPATCH_BODY_BYTES })
  );
}
