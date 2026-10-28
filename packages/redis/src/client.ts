import { createClient, type RedisClientType } from 'redis';
import { ServerlessRedisClient } from './serverless-client';

function resolveRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;
let connectingClient: RedisClientType | null = null;
let subscribers: RedisClientType[] = [];
let serverlessMode = false;

// Circuit breaker: avoid repeated multi-second connection attempts when Redis is
// unreachable. After a failed connect, short-circuit for a cooldown window so
// callers (proxy, cache) fail fast instead of hanging page switches/actions.
const REDIS_FAILURE_COOLDOWN_MS = 15000;
let lastFailureAt = 0;

/** True when the active connection is the HTTP/REST (Upstash) adapter. */
export function isServerlessRedis(): boolean {
  return serverlessMode;
}

/**
 * Options accepted by the node-redis `SET` command.
 * Only the expiry family is honoured; the adapter rejects nothing but ignores
 * the rest, mirroring the subset this codebase uses.
 */
interface SetOptions {
  EX?: number;
  PX?: number;
  NX?: boolean;
  XX?: boolean;
}

function parseSetOptions(options?: SetOptions): string[] {
  if (!options) return [];
  const args: string[] = [];
  if (typeof options.EX === 'number') args.push('EX', String(Math.ceil(options.EX)));
  if (typeof options.PX === 'number') args.push('PX', String(Math.ceil(options.PX)));
  if (options.NX) args.push('NX');
  if (options.XX) args.push('XX');
  return args;
}

function toKeyArray(keys: string | string[]): string[] {
  return Array.isArray(keys) ? keys : [keys];
}

/**
 * Wrap the REST client in the node-redis surface used across the monorepo.
 *
 * Every method that consumers actually call is implemented against a real Redis
 * command. Methods that REST Redis genuinely cannot serve (Pub/Sub) are explicit
 * no-ops. Crucially, SCAN/SSCAN are backed by real cursor loops — they used to be
 * empty async generators, which made prefix and tag invalidation silently delete
 * zero keys on every serverless deployment.
 */
function createServerlessAdapter(restClient: ServerlessRedisClient): RedisClientType {
  const adapter = {
    isOpen: true,
    ping: () => restClient.ping(),
    get: (key: string) => restClient.get(key),
    set: (key: string, value: string, options?: SetOptions) =>
      restClient.command('set', [key, value, ...parseSetOptions(options)]),
    setEx: (key: string, seconds: number, value: string) => restClient.setEx(key, seconds, value),
    del: (keys: string | string[]) => restClient.del(...toKeyArray(keys)),
    unlink: (keys: string | string[]) => restClient.unlink(...toKeyArray(keys)),
    exists: (key: string) => restClient.exists(key).then((ok) => (ok ? 1 : 0)),
    expire: (key: string, seconds: number) => restClient.expire(key, seconds),
    ttl: (key: string) => restClient.ttl(key),
    incr: (key: string) => restClient.incr(key),
    incrBy: (key: string, increment: number) => restClient.incrby(key, increment),
    mGet: (keys: string[]) => restClient.mget(keys),
    mSet: (entries: Record<string, string>) => restClient.mSet(entries),
    hGet: (key: string, field: string) => restClient.hget(key, field),
    hSet: (key: string, record: Record<string, string>) =>
      restClient.hset(key, ...(Object.entries(record) as [string, string][])),
    hIncrBy: (key: string, field: string, increment: number) =>
      restClient.hIncrBy(key, field, increment),
    hDel: (key: string, fields: string | string[]) => restClient.hDel(key, ...toKeyArray(fields)),
    hGetAll: (key: string) => restClient.hgetall(key),
    lPush: (key: string, values: string | string[]) => restClient.lPush(key, ...toKeyArray(values)),
    rPush: (key: string, values: string | string[]) => restClient.rPush(key, ...toKeyArray(values)),
    lTrim: (key: string, start: number, stop: number) => restClient.lTrim(key, start, stop),
    lRange: (key: string, start: number, stop: number) => restClient.lRange(key, start, stop),
    lLen: (key: string) => restClient.lLen(key),
    sAdd: (key: string, members: string | string[]) => restClient.sAdd(key, ...toKeyArray(members)),
    sRem: (key: string, members: string | string[]) => restClient.sRem(key, ...toKeyArray(members)),
    sMembers: (key: string) => restClient.sMembers(key),

    // Raw command surface: lets `raw.ts` drive commands (EVAL, streams, HLL,
    // ZSET, GETEX, MODULE/INFO probes) that this adapter does not mirror.
    // Without it every capability module silently failed on serverless.
    sendCommand: (args: string[]) => restClient.command(args[0] as string, args.slice(1)),
    eval: (
      script: string,
      options?: { numberOfKeys?: number; keys?: string[]; arguments?: (string | number)[] }
    ) => {
      const keys = options?.keys ?? [];
      const argv = options?.arguments ?? [];
      const numKeys = options?.numberOfKeys ?? keys.length;
      return restClient.command('eval', [script, String(numKeys), ...keys, ...argv]);
    },

    // Real cursor-based SCAN — non-blocking, unlike KEYS.
    scan: (cursor: number | string, options?: { MATCH?: string; COUNT?: number; TYPE?: string }) =>
      restClient.scan(cursor, options),
    sScan: (key: string, cursor: number | string, options?: { MATCH?: string; COUNT?: number }) =>
      restClient.sScan(key, cursor, options),

    async *scanIterator(options?: { MATCH?: string; COUNT?: number; TYPE?: string }) {
      let cursor: number | string = 0;
      do {
        const page = await restClient.scan(cursor, options);
        cursor = page.cursor;
        for (const key of page.keys) yield key;
      } while (cursor !== 0);
    },

    async *sScanIterator(
      key: string,
      options?: { MATCH?: string; COUNT?: number }
    ): AsyncGenerator<string> {
      let cursor: number | string = 0;
      do {
        const page = await restClient.sScan(key, cursor, options);
        cursor = page.cursor;
        for (const member of page.keys) yield member;
      } while (cursor !== 0);
    },

    multi: () => {
      const commands: string[][] = [];
      const chain = {
        sAdd: (key: string, member: string) => {
          commands.push(['SADD', key, member]);
          return chain;
        },
        setEx: (key: string, seconds: number, value: string) => {
          commands.push(['SETEX', key, String(Math.ceil(seconds)), value]);
          return chain;
        },
        exec: () => (commands.length > 0 ? restClient.pipeline(commands) : Promise.resolve([])),
      };
      return chain;
    },

    // Pub/Sub has no equivalent on the REST protocol. These are intentional,
    // documented no-ops: cross-instance invalidation degrades to local-only
    // (invalidation.ts purges this instance's L1 unconditionally).
    publish: async () => 0,
    subscribe: async () => {},
    duplicate: () => adapter,
    connect: async () => adapter,
    quit: async () => {
      await restClient.flushPending();
    },
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
 *  - A *failed* connect never leaves a rejected promise cached: the in-flight
 *    slot is always cleared, so a transient outage cannot permanently poison
 *    every subsequent caller in the process.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (client?.isOpen) return client;

  // Circuit breaker: if a recent connect attempt failed, fail fast instead of
  // re-attempting a (potentially multi-second) connection on every request.
  if (Date.now() - lastFailureAt < REDIS_FAILURE_COOLDOWN_MS) {
    throw new Error('Redis is in failure cooldown; skipping connection attempt.');
  }

  if (connecting) return connecting;

  const explicitRedisUrl = process.env.REDIS_URL;
  const REDIS_URL = resolveRedisUrl();
  const isHttpRedisUrl = REDIS_URL.startsWith('http://') || REDIS_URL.startsWith('https://');
  const restUrl =
    process.env.SERVERLESS_REDIS_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const hasUpstashRest = Boolean(restUrl);

  // Use the HTTP REST adapter when REDIS_URL is an HTTP(S) endpoint (e.g. Upstash REST)
  // or when Upstash/Serverless REST is configured without an explicit non-localhost TCP URL.
  if (
    isHttpRedisUrl ||
    (hasUpstashRest && (!explicitRedisUrl || REDIS_URL.includes('localhost')))
  ) {
    const restClient = new ServerlessRedisClient({
      baseUrl: (isHttpRedisUrl ? REDIS_URL : restUrl) as string,
      token:
        process.env.UPSTASH_REDIS_REST_TOKEN ||
        process.env.REDIS_AUTH_SECRET ||
        process.env.KV_REST_API_TOKEN,
    });
    client = createServerlessAdapter(restClient);
    serverlessMode = true;
    return client;
  }

  // Short-circuit on Vercel if no valid Redis URL is provided.
  // Avoids hanging for 15 seconds (3 retries * 5s timeout) on every edge function cold start.
  if (process.env.VERCEL === '1' && REDIS_URL.includes('localhost')) {
    throw new Error('Redis is not configured in this Vercel environment.');
  }

  const attempt = (async () => {
    // cast to any — pnpm may hoist multiple copies of @redis/client types;
    // structural typing via `any` keeps this compatible across all resolutions.
    const next: RedisClientType = createClient({
      url: REDIS_URL,
      socket: {
        keepAlive: true,
        // Bounded socket timeout: prevents requests from hanging indefinitely
        // if Redis becomes unresponsive. Permanent Redis Rules — Timeouts.
        connectTimeout: 1000,
        reconnectStrategy(retries: number) {
          if (retries > 3) {
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 500);
        },
      },
    } as any);

    const resetIfCurrent = () => {
      if (client === next) client = null;
      if (connecting === attempt) connecting = null;
      if (connectingClient === next) connectingClient = null;
      lastFailureAt = Date.now();
    };

    next.on('error', resetIfCurrent);
    next.on('end', resetIfCurrent);

    connectingClient = next;
    await next.connect();
    connectingClient = null;
    client = next;
    serverlessMode = false;
    lastFailureAt = 0;
    return client;
  })();

  connecting = attempt;

  try {
    return await attempt;
  } catch (error) {
    // Record failure for circuit breaker cooldown.
    lastFailureAt = Date.now();
    // Release the in-flight slot on failure so the next caller retries instead of
    // awaiting a permanently rejected promise.
    if (connecting === attempt) connecting = null;
    connectingClient = null;
    throw error;
  }
}

/**
 * Gracefully close the Redis connection.
 * Call on shutdown or test cleanup.
 */
export async function closeRedis(): Promise<void> {
  const pending = connecting;
  const pendingClient = connectingClient;
  connecting = null;
  connectingClient = null;

  if (pendingClient) {
    await pendingClient.disconnect().catch(() => undefined);
  }

  if (client?.isOpen) {
    await client.quit().catch(() => client?.disconnect().catch(() => undefined));
  }
  client = null;
  serverlessMode = false;

  // A connect that is still in flight must not resurrect the singleton.
  if (pending) {
    await pending.catch(() => undefined);
  }

  for (const sub of subscribers) {
    if (sub.isOpen) {
      await sub.quit().catch(() => sub.disconnect().catch(() => undefined));
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
