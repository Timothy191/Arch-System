import { createClient, type RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

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

  connecting = (async () => {
    // @ts-ignore — pnpm hoists two copies of @redis/client types, causing
    // spurious "Two different types with this name exist" errors. Cast to
    // any so TS uses structural typing instead of nominal.
    const next: RedisClientType = createClient({
      url: REDIS_URL,
      socket: {
        keepAlive: true,
        reconnectStrategy(retries: number) {
          if (retries > 3) {
            return new Error("Redis connection failed");
          }
          return Math.min(retries * 50, 500);
        },
      },
    } as any);

    next.on("error", () => {
      if (client === next) client = null;
      connecting = null;
    });

    next.on("end", () => {
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
  }
  connecting = null;
}
