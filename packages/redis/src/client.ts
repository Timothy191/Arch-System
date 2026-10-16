import { createClient, type RedisClientType } from 'redis';
import { ServerlessRedisClient } from './serverless-client';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;
let subscribers: RedisClientType[] = [];

function createServerlessAdapter(restClient: ServerlessRedisClient): RedisClientType {
  const adapter = {
    isOpen: true,
    ping: () => restClient.ping(),
    get: (key: string) => restClient.get<string>(key),
    set: (key: string, value: string) => restClient.set(key, value),
    setEx: (key: string, seconds: number, value: string) => restClient.set(key, value, seconds),
    del: (keys: string | string[]) => restClient.del(...(Array.isArray(keys) ? keys : [keys])),
    unlink: (keys: string | string[]) => restClient.del(...(Array.isArray(keys) ? keys : [keys])),
    exists: (key: string) => restClient.exists(key).then((ok) => (ok ? 1 : 0)),
    expire: (key: string, seconds: number) => restClient.expire(key, seconds),
    ttl: (key: string) => restClient.ttl(key),
    incr: (key: string) => restClient.incr(key),
    incrBy: (key: string, increment: number) => restClient.incrby(key, increment),
    mGet: (keys: string[]) => restClient.mget(keys),
    hGet: (key: string, field: string) => restClient.hget(key, field),
    hGetAll: (key: string) => restClient.hgetall(key),
    multi: () => {
      const commands: string[][] = [];
      const chain = {
        sAdd: (key: string, member: string) => {
          commands.push(['SADD', key, member]);
          return chain;
        },
        exec: () => (commands.length > 0 ? restClient.pipeline(commands) : Promise.resolve([])),
      };
      return chain;
    },
    sScanIterator: async function* () {
      // No-op iterator fallback for REST client
    },
    scanIterator: async function* () {
      // No-op iterator fallback for REST client
    },
    publish: async () => 0,
    subscribe: async () => {},
    duplicate: () => adapter,
    connect: async () => adapter,
    quit: async () => {},
  };
  return adapter as unknown as RedisClientType;
}

/**
 * Get or create the singleton Redis client.
 *
 * Reconnection behaviour:
 *  - Existing open socket → returned immediately.
 *  - In-flight connect → awaited (prevents thundering herd).
 *  - On connect/disconnect error → reset state so the next caller retries.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  const isHttpRedisUrl = REDIS_URL.startsWith('http://') || REDIS_URL.startsWith('https://');
  const hasUpstashRest = Boolean(
    process.env.UPSTASH_REDIS_REST_URL || process.env.SERVERLESS_REDIS_URL
  );

  // Use the HTTP REST adapter when REDIS_URL is an HTTP(S) endpoint (e.g. Upstash REST)
  // or when running on Vercel without a TCP Redis URL but with Upstash REST configured.
  if (
    isHttpRedisUrl ||
    (process.env.VERCEL === '1' && REDIS_URL.includes('localhost') && hasUpstashRest)
  ) {
    const restClient = new ServerlessRedisClient({
      baseUrl: isHttpRedisUrl
        ? REDIS_URL
        : process.env.SERVERLESS_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_AUTH_SECRET,
    });
    client = createServerlessAdapter(restClient);
    return client;
  }

  // Short-circuit on Vercel if no valid Redis URL is provided.
  // Avoids hanging for 15 seconds (3 retries * 5s timeout) on every edge function cold start.
  if (process.env.VERCEL === '1' && REDIS_URL.includes('localhost')) {
    // Return a dummy client or throw. The cache functions handle null/throw gracefully.
    throw new Error('Redis is not configured in this Vercel environment.');
  }

  connecting = (async () => {
    // cast to any — pnpm may hoist multiple copies of @redis/client types;
    // structural typing via `any` keeps this compatible across all resolutions.
    const next: RedisClientType = createClient({
      url: REDIS_URL,
      socket: {
        keepAlive: true,
        // Bounded socket timeout: prevents requests from hanging indefinitely
        // if Redis becomes unresponsive. Permanent Redis Rules — Timeouts.
        connectTimeout: 5000,
        reconnectStrategy(retries: number) {
          if (retries > 3) {
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 500);
        },
      },
    } as any);

    next.on('error', () => {
      if (client === next) client = null;
      connecting = null;
    });

    next.on('end', () => {
      if (client === next) client = null;
      connecting = null;
    });

    await next.connect();
    client = next;
    connecting = null;
    return client;
  })();

  return connecting;
}

/**
 * Gracefully close the Redis connection.
 * Call on shutdown or test cleanup.
 */
export async function closeRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
    client = null;
    connecting = null;
  }

  for (const sub of subscribers) {
    if (sub.isOpen) {
      await sub.quit();
    }
  }
  subscribers = [];
}

/**
 * Create a new duplicate Redis client specifically for Pub/Sub subscriptions.
 */
export async function createRedisSubscriber(): Promise<RedisClientType> {
  const baseClient = await getRedisClient();
  const sub = baseClient.duplicate();
  subscribers.push(sub);
  await sub.connect();
  return sub;
}
