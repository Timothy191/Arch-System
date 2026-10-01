/**
 * Serverless Redis REST Client for Vercel Deployments
 * Communicates with /home/tim/Fork/redis or Upstash Redis over connectionless HTTP REST
 */

export interface ServerlessRedisConfig {
  baseUrl: string;
  token?: string;
}

export class ServerlessRedisClient {
  private baseUrl: string;
  private token: string;

  constructor(config?: Partial<ServerlessRedisConfig>) {
    this.baseUrl = (
      config?.baseUrl ||
      process.env.SERVERLESS_REDIS_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      'http://localhost:3005/api/v1'
    ).replace(/\/$/, '');

    this.token =
      config?.token ||
      process.env.REDIS_AUTH_SECRET ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      'plantcor-redis-secret';
  }

  private async fetchCommand(command: string, args: string[] = []): Promise<any> {
    const url = `${this.baseUrl}/${encodeURIComponent(command)}/${args.map(encodeURIComponent).join('/')}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Serverless Redis error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    return data.result;
  }

  public async get<T = string>(key: string): Promise<T | null> {
    const res = await this.fetchCommand('get', [key]);
    if (res === null || res === undefined) return null;
    try {
      return JSON.parse(res);
    } catch {
      return res as T;
    }
  }

  public async set(key: string, value: any, ttlSeconds?: number): Promise<'OK'> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const args = ttlSeconds ? [key, ttlSeconds.toString(), serialized] : [key, serialized];
    const cmd = ttlSeconds ? 'setex' : 'set';
    return this.fetchCommand(cmd, args);
  }

  public async del(...keys: string[]): Promise<number> {
    return this.fetchCommand('del', keys);
  }

  public async invalidateTags(...tags: string[]): Promise<number> {
    return this.fetchCommand('invalidate_tags', tags);
  }
}

export const serverlessRedis = new ServerlessRedisClient();
