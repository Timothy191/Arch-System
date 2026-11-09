import { Queue } from 'bullmq';

export const WORKFLOW_QUEUE_NAME = 'n8n-workflow-queue';

const DEFAULT_REDIS_PORT = 6379;
const TLS_REDIS_PORT = 6380;
const DECIMAL_RADIX = 10;
const UPSTASH_HOST_MARKER = 'upstash.io';

interface QueueRedisConnectionOptions {
  maxRetriesPerRequest: null;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
  host?: string;
  port?: number;
  password?: string;
  username?: string;
  tls?: { rejectUnauthorized: boolean };
}

function parsePort(rawPort: string | undefined): number {
  return Number.parseInt(rawPort || String(DEFAULT_REDIS_PORT), DECIMAL_RADIX);
}

function fromRedisUrl(
  redisUrl: string,
  base: QueueRedisConnectionOptions,
  rejectUnauthorized: boolean
): QueueRedisConnectionOptions | null {
  try {
    const parsed = new URL(redisUrl);
    const options: QueueRedisConnectionOptions = {
      ...base,
      host: parsed.hostname,
      port: parsePort(parsed.port),
    };
    if (parsed.password) options.password = decodeURIComponent(parsed.password);
    if (parsed.username && parsed.username !== 'default') options.username = parsed.username;
    if (parsed.protocol === 'rediss:' || parsed.hostname.includes(UPSTASH_HOST_MARKER)) {
      options.tls = { rejectUnauthorized };
    }
    return options;
  } catch {
    // Malformed URL: fall back to discrete REDIS_HOST/REDIS_PORT env vars.
    return null;
  }
}

/** BullMQ connection options shared by workflow dispatch + job-status routes. */
export function getQueueRedisConnectionOptions(): QueueRedisConnectionOptions {
  const redisUrl = process.env.QUEUE_REDIS_URL || process.env.REDIS_URL;
  const rejectUnauthorized = process.env.REDIS_TLS_INSECURE !== 'true';
  const base: QueueRedisConnectionOptions = {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
  };

  const fromUrl = redisUrl ? fromRedisUrl(redisUrl, base, rejectUnauthorized) : null;
  if (fromUrl) return fromUrl;

  const host = process.env.REDIS_HOST || 'localhost';
  const port = parsePort(process.env.REDIS_PORT);
  const options: QueueRedisConnectionOptions = {
    ...base,
    host,
    port,
    password: process.env.REDIS_PASSWORD || '',
  };
  if (
    process.env.REDIS_TLS === 'true' ||
    host.includes(UPSTASH_HOST_MARKER) ||
    port === TLS_REDIS_PORT
  ) {
    options.tls = { rejectUnauthorized };
  }
  return options;
}

let workflowQueue: Queue | null = null;

/** Lazily-created singleton BullMQ queue; `null` when no Redis is configured. */
export function getWorkflowQueue(): Queue | null {
  if (workflowQueue) return workflowQueue;
  if (process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || process.env.REDIS_HOST) {
    workflowQueue = new Queue(WORKFLOW_QUEUE_NAME, {
      connection: getQueueRedisConnectionOptions(),
    });
  }
  return workflowQueue;
}
