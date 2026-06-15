import { IStore } from "../interfaces";

export interface SimpleRedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { EX: number },
  ): Promise<string | null | void>;
  del(key: string): Promise<number | void>;
}

export class RedisStore implements IStore {
  constructor(private client: SimpleRedisClient) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { EX: Math.max(1, ttlSeconds) });
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    if (typeof (this.client as any).eval === "function") {
      return (this.client as any).eval(script, {
        keys,
        arguments: args,
      });
    }
    throw new Error("Redis client does not support eval method");
  }
}
