// packages/redis/src/client-factory.ts
export interface PooledClientOptions {
  highWatermark?: number;
  lowWatermark?: number;
  maxReconnectAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface PooledClient {
  config: Required<PooledClientOptions>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: () => boolean;
}

const DEFAULTS: Required<PooledClientOptions> = {
  highWatermark: 100,
  lowWatermark: 10,
  maxReconnectAttempts: 10,
  baseBackoffMs: 100,
  maxBackoffMs: 30_000,
};

export function createPooledClient(options: PooledClientOptions = {}): PooledClient {
  const config = { ...DEFAULTS, ...options };
  let connected = false;
  return {
    config,
    connect: async () => {
      connected = true;
    },
    disconnect: async () => {
      connected = false;
    },
    isConnected: () => connected,
  };
}

export function computeBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  return exp + Math.floor(Math.random() * exp * 0.25);
}
