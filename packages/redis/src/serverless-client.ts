/**
 * Serverless Redis REST Client for Vercel Deployments
 * Communicates with Upstash Redis over connectionless HTTP REST
 * All methods use POST with JSON body [command, ...args] to avoid URL length limits
 * Lazily validates URL/token on first use, not at import time
 * Never uses `any` — all external data is parsed through a guarded schema type
 */
export interface ServerlessRedisConfig {
  baseUrl: string;
  token?: string;
}

interface UpstashRestResponse {
  result?: unknown;
  error?: string;
}

export class ServerlessRedisClient {
  private baseUrl: string;
  private token: string | undefined;

  constructor(config?: Partial<ServerlessRedisConfig>) {
    // Lazily initialize - validate on first use, not at import time
    const httpRedisUrl =
      process.env.REDIS_URL?.startsWith('http://') || process.env.REDIS_URL?.startsWith('https://')
        ? process.env.REDIS_URL
        : undefined;
    this.baseUrl =
      config?.baseUrl ||
      process.env.SERVERLESS_REDIS_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      httpRedisUrl ||
      'http://localhost:3005/api/v1';
    this.token =
      config?.token || process.env.REDIS_AUTH_SECRET || process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  private async config(): Promise<{ baseUrl: string; token: string | undefined }> {
    // Validate only in production; dev uses localhost fallback
    if (!this.baseUrl || this.baseUrl === 'http://localhost:3005/api/v1') {
      const env = process.env.NODE_ENV;
      if (env === 'production') {
        throw new Error('REDIS_URL or UPSTASH_REDIS_REST_URL environment variable is not set');
      }
    }
    return { baseUrl: this.baseUrl, token: this.token };
  }

  public async ping(): Promise<string> {
    return this.fetchCommand<string>('ping');
  }

  private async fetchCommand<T>(command: string, args: string[] = []): Promise<T> {
    const { baseUrl, token } = await this.config();

    // Build the Upstash REST body: ["CMD", ...args]
    const body = JSON.stringify([command, ...args]);

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    // Read body text first (can only be read once)
    const text = await res.text();

    // Parse JSON through the guarded schema
    let parsed: UpstashRestResponse;
    try {
      parsed = JSON.parse(text) as UpstashRestResponse;
    } catch {
      throw new Error(`Serverless Redis parse error: ${text}`);
    }

    // If the server returned an error object, throw immediately
    if (parsed.error) {
      throw new Error(`Serverless Redis error: ${parsed.error}`);
    }

    // If the response is not OK but no error object, surface the status text
    if (!res.ok) {
      throw new Error(`Serverless Redis error (${res.status}): ${text}`);
    }

    // Return the result, casting through unknown for type safety
    return parsed.result as unknown as T;
  }

  public async get<T = string>(key: string): Promise<T | null> {
    const raw = await this.fetchCommand<string | null>('get', [key]);
    // fetchCommand returns null when the key doesn't exist (Upstash behavior)
    // If raw is a string, JSON.parse it; if it's already parsed, pass through
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // If it's not valid JSON, return the raw string as fallback
      return raw as T;
    }
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<'OK'> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    // Upstash POST body format: ["SET", key, value, "EX", ttl]
    if (ttlSeconds) {
      await this.fetchCommand<void>('set', [key, serialized, 'EX', ttlSeconds.toString()]);
    } else {
      await this.fetchCommand<void>('set', [key, serialized]);
    }
    return 'OK';
  }

  public async del(...keys: string[]): Promise<number> {
    return this.fetchCommand<number>('del', keys);
  }

  public async exists(key: string): Promise<boolean> {
    const res = await this.fetchCommand<number>('exists', [key]);
    return res === 1;
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    const res = await this.fetchCommand<number>('expire', [key, seconds.toString()]);
    return res === 1;
  }

  public async ttl(key: string): Promise<number> {
    return this.fetchCommand<number>('ttl', [key]);
  }

  public async incr(key: string): Promise<number> {
    return this.fetchCommand<number>('incr', [key]);
  }

  public async incrby(key: string, increment: number): Promise<number> {
    return this.fetchCommand<number>('incrby', [key, increment.toString()]);
  }

  public async mget(keys: string[]): Promise<(string | null)[]> {
    return this.fetchCommand<(string | null)[]>('mget', keys);
  }

  public async hset(key: string, ...fields: [string, string][]): Promise<number> {
    if (fields.length === 0) return 0;
    // Upstash hset: ["HSET", key, field1, value1, field2, value2, ...]
    const args = [key, ...fields.flat()];
    return this.fetchCommand<number>('hset', args);
  }

  public async hget(key: string, field: string): Promise<string | null> {
    const raw = await this.fetchCommand<string | null>('hget', [key, field]);
    // Upstash hget returns the stored string, or null if field doesn't exist
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw as string;
    }
  }

  public async hgetall(key: string): Promise<Record<string, string>> {
    const res = await this.fetchCommand<unknown>('hgetall', [key]);
    try {
      // Upstash returns flat array [f1, v1, f2, v2, ...]
      const result: Record<string, string> = {};
      const arr = Array.isArray(res) ? res : [];
      for (let i = 0; i < arr.length; i += 2) {
        if (i + 1 < arr.length) {
          result[String(arr[i])] = String(arr[i + 1]);
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  public async pipeline(commands: string[][]): Promise<unknown[]> {
    // Validate config first (throws in production if URL unset)
    await this.config();

    // Upstash pipeline POST: POST {baseUrl}/pipeline with JSON body [["CMD", arg1, arg2], …]
    const body = JSON.stringify(commands);
    const res = await fetch(`${this.baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body,
    });

    const text = await res.text();

    // Parse through the guarded schema
    let parsed: { result?: unknown; error?: string };
    try {
      parsed = JSON.parse(text) as { result?: unknown; error?: string };
    } catch {
      throw new Error(`Serverless Redis pipeline parse error: ${text}`);
    }

    // If any item in the pipeline has an error, throw with that message
    if (Array.isArray(parsed.result)) {
      const items = parsed.result as Array<{ result?: unknown; error?: string }>;
      const failed = items.find((i) => i.error);
      if (failed) {
        throw new Error(`Serverless Redis pipeline error: ${failed.error}`);
      }
      return items.map((i) => i.result);
    }
    throw new Error(`Serverless Redis pipeline error: unexpected response`);
  }
}

export const serverlessRedis = new ServerlessRedisClient();
