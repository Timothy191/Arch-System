import { Queue } from 'bullmq';
import { NextRequest, NextResponse } from 'next/server';

const WORKFLOW_QUEUE_NAME = 'n8n-workflow-queue';
function getRedisConnectionOptions() {
  const redisUrl = process.env.QUEUE_REDIS_URL || process.env.REDIS_URL;
  const insecureTls = process.env.REDIS_TLS_INSECURE === 'true';
  const options: any = { maxRetriesPerRequest: null, enableOfflineQueue: false, lazyConnect: true };

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      options.host = parsed.hostname;
      options.port = parseInt(parsed.port || '6379', 10);
      if (parsed.password) options.password = decodeURIComponent(parsed.password);
      if (parsed.protocol === 'rediss:' || parsed.hostname.includes('upstash.io')) {
        options.tls = { rejectUnauthorized: !insecureTls };
      }
      return options;
    } catch {}
  }
  options.host = process.env.REDIS_HOST || 'localhost';
  options.port = parseInt(process.env.REDIS_PORT || '6379', 10);
  options.password = process.env.REDIS_PASSWORD || '';
  if (process.env.REDIS_TLS === 'true' || options.host.includes('upstash.io')) {
    options.tls = { rejectUnauthorized: !insecureTls };
  }
  return options;
}

let queue: Queue | null = null;
if (process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || process.env.REDIS_HOST) {
  queue = new Queue(WORKFLOW_QUEUE_NAME, { connection: getRedisConnectionOptions() });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!queue) {
    return NextResponse.json({
      found: false,
      queueAvailable: false,
      jobId,
      message: 'Queue not wired',
    });
  }

  try {
    const job = await queue.getJob(jobId);
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
  } catch (err: any) {
    return NextResponse.json(
      { found: false, queueAvailable: false, jobId, message: 'Lookup failed' },
      { status: 503 }
    );
  }
}
