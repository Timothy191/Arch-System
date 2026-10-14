import type { IStore } from '../interfaces';
import { MemoryStore } from './memory.store';

export interface SimpleRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX: number }): Promise<string | null | undefined>;
  del(key: string): Promise<number | undefined>;
  eval?(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

export class RedisStore implements IStore {
  private fallback = new MemoryStore();

  constructor(private client: SimpleRedisClient) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const safeTtl = Math.max(1, ttlSeconds);
    try {
      await this.client.set(key, value, { EX: safeTtl });
    } catch {
      await this.fallback.set(key, value, safeTtl);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      await this.fallback.delete(key);
    }
  }

  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    if (typeof this.client.eval === 'function') {
      return this.client.eval(script, {
        keys,
        arguments: args,
      });
    }
    throw new Error('Redis client does not support eval method');
  }
}
