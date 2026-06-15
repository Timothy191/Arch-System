export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface IStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete?(key: string): Promise<void>;
  eval?(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export interface IStrategy {
  check(
    key: string,
    limit: number,
    windowMs: number,
    store: IStore,
  ): Promise<RateLimitResult>;
}

export interface RateLimitOptions {
  store: IStore;
  strategy: IStrategy;
  limit: number;
  windowMs: number;
  keyPrefix?: string;
}
