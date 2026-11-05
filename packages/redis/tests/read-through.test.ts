import { clearMemoryCache } from '../src/cache';
import { getRedisClient } from '../src/client';
import { getOrSet, NULL_SENTINEL } from '../src/read-through';

jest.mock('../src/client', () => ({
  getRedisClient: jest.fn(),
  createRedisSubscriber: jest.fn(async () => null),
}));

describe('read-through getOrSet', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    clearMemoryCache();
    const sendCommand = jest.fn(async (args: string[]) => {
      const cmd = String(args[0]).toUpperCase();
      if (cmd === 'GET') return store.get(String(args[1])) ?? null;
      if (cmd === 'SET') {
        const key = String(args[1]);
        const val = String(args[2]);
        if (args.includes('NX') && store.has(key)) return null;
        store.set(key, val);
        return 'OK';
      }
      if (cmd === 'EVALSHA' || cmd === 'EVAL' || cmd === 'UNLINK' || cmd === 'DEL') {
        store.delete(String(args[2] ?? args[1]));
        return 1;
      }
      return 'OK';
    });
    (getRedisClient as jest.Mock).mockResolvedValue({
      sendCommand,
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      setEx: jest.fn(async (k: string, _ttl: number, v: string) => {
        store.set(k, v);
        return 'OK';
      }),
    });
  });

  it('coalesces concurrent misses into a single fetcher call', async () => {
    let calls = 0;
    const fetcher = jest.fn(async () => {
      calls += 1;
      await Promise.resolve();
      return { id: 42 };
    });

    const [r1, r2, r3] = await Promise.all([
      getOrSet('arch:entity:42', fetcher, { ttl: 120 }),
      getOrSet('arch:entity:42', fetcher, { ttl: 120 }),
      getOrSet('arch:entity:42', fetcher, { ttl: 120 }),
    ]);

    expect(calls).toBe(1);
    expect(r1).toEqual({ id: 42 });
    expect(r2).toEqual({ id: 42 });
    expect(r3).toEqual({ id: 42 });
  });

  it('caches NULL_SENTINEL on null result to prevent cache penetration', async () => {
    const fetcher = jest.fn(async () => null);
    const first = await getOrSet('arch:entity:missing', fetcher, { ttl: 120, negativeTtl: 30 });
    const second = await getOrSet('arch:entity:missing', fetcher, { ttl: 120, negativeTtl: 30 });

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(NULL_SENTINEL).toBeDefined();
  });
});
