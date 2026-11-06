import { workflowDispatchSchema } from '@repo/contract';
import { Queue } from 'bullmq';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeWorkflowRequest } from '@/lib/api/telemetry-auth';

const WORKFLOW_QUEUE_NAME = 'n8n-workflow-queue';
const WORKFLOW_JOB_NAME = 'execute-workflow';

function getRedisConnectionOptions() {
  const redisUrl = process.env.QUEUE_REDIS_URL || process.env.REDIS_URL;
  const insecureTls = process.env.REDIS_TLS_INSECURE === 'true';
  const options: {
    maxRetriesPerRequest: null;
    enableOfflineQueue: boolean;
    lazyConnect: boolean;
    host?: string;
    port?: number;
    password?: string;
    username?: string;
    tls?: { rejectUnauthorized: boolean };
  } = {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
  };

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      options.host = parsed.hostname;
      options.port = parseInt(parsed.port || '6379', 10);
      if (parsed.password) options.password = decodeURIComponent(parsed.password);
      if (parsed.username && parsed.username !== 'default') options.username = parsed.username;
      if (parsed.protocol === 'rediss:' || parsed.hostname.includes('upstash.io')) {
        options.tls = { rejectUnauthorized: !insecureTls };
      }
      return options;
    } catch {}
  }
  options.host = process.env.REDIS_HOST || 'localhost';
  options.port = parseInt(process.env.REDIS_PORT || '6379', 10);
  options.password = process.env.REDIS_PASSWORD || '';
  if (
    process.env.REDIS_TLS === 'true' ||
    options.host.includes('upstash.io') ||
    options.port === 6380
  ) {
    options.tls = { rejectUnauthorized: !insecureTls };
  }
  return options;
}

let queue: Queue | null = null;
function getWorkflowQueue(): Queue | null {
  if (queue) return queue;
  if (process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || process.env.REDIS_HOST) {
    queue = new Queue(WORKFLOW_QUEUE_NAME, { connection: getRedisConnectionOptions() });
  }
  return queue;
}

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
