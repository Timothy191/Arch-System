import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || (TextDecoder as any);

// Override environment variables to prevent local development .env from polluting tests
process.env.DISABLE_RATE_LIMIT = 'false';

// Jest setup file — provide Web API globals that Next.js server modules expect
// but jsdom may not define in all versions.

jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((cb) => cb),
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

global.Request =
  global.Request ||
  class Request {
    url: string;
    constructor(input: string | Request) {
      this.url = typeof input === 'string' ? input : input.url;
    }
  };

global.Response =
  global.Response ||
  class Response {
    status: number;
    constructor(_body?: BodyInit | null, _init?: ResponseInit) {
      this.status = _init?.status ?? 200;
    }
  };

// Global mock for redis to avoid database connection timeout/hangs in tests
jest.mock('@repo/redis', () => {
  const actual = jest.requireActual('@repo/redis');
  const mockCache = new Map<string, string>();
  const mockHashes = new Map<string, Map<string, string>>();
  const mockLists = new Map<string, string[]>();
  const mockSets = new Map<string, Set<string>>();
  const mockRedisClient = {
    get: jest.fn(async (key: string) => mockCache.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockCache.set(key, value);
      return 'OK';
    }),
    setEx: jest.fn(async (key: string, _seconds: number, value: string) => {
      mockCache.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      let removed = 0;
      for (const k of arr) {
        if (mockCache.delete(k)) removed++;
      }
      return removed;
    }),
    incr: jest.fn(async (key: string) => {
      const val = parseInt(mockCache.get(key) || '0', 10) + 1;
      mockCache.set(key, val.toString());
      return val;
    }),
    expire: jest.fn(async (_key: string, _seconds: number) => true),
    hIncrBy: jest.fn(async (key: string, field: string, increment: number) => {
      const hash = mockHashes.get(key) ?? new Map<string, string>();
      const next = (parseInt(hash.get(field) || '0', 10) || 0) + increment;
      hash.set(field, String(next));
      mockHashes.set(key, hash);
      return next;
    }),
    hGetAll: jest.fn(async (key: string) => {
      const hash = mockHashes.get(key);
      return hash ? Object.fromEntries(hash.entries()) : {};
    }),
    lPush: jest.fn(async (key: string, elements: string | string[]) => {
      const list = mockLists.get(key) ?? [];
      const items = Array.isArray(elements) ? elements : [elements];
      list.unshift(...items);
      mockLists.set(key, list);
      return list.length;
    }),
    lTrim: jest.fn(async (key: string, start: number, stop: number) => {
      const list = mockLists.get(key) ?? [];
      mockLists.set(key, list.slice(start, stop + 1));
      return 'OK';
    }),
    lRange: jest.fn(async (key: string, start: number, stop: number) => {
      const list = mockLists.get(key) ?? [];
      return stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
    }),
    sAdd: jest.fn(async (key: string, members: string | string[]) => {
      const set = mockSets.get(key) ?? new Set<string>();
      const arr = Array.isArray(members) ? members : [members];
      for (const m of arr) set.add(m);
      mockSets.set(key, set);
      return arr.length;
    }),
    sMembers: jest.fn(async (key: string) => Array.from(mockSets.get(key) ?? [])),
    scan: jest.fn(async () => ({ cursor: 0, keys: Array.from(mockCache.keys()) })),
    publish: jest.fn(async () => 1),
    ping: jest.fn(async () => 'PONG'),
    flushDb: jest.fn(async () => {
      mockCache.clear();
      mockHashes.clear();
      mockLists.clear();
      mockSets.clear();
    }),
    isOpen: true,
  };
  return {
    ...actual,
    getRedisClient: jest.fn(async () => mockRedisClient),
    closeRedis: jest.fn(async () => {}),
  };
});

jest.mock('../../packages/redis/src/client', () => {
  const mockCache = new Map<string, string>();
  const mockRedisClient = {
    get: jest.fn(async (key: string) => mockCache.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockCache.set(key, value);
      return 'OK';
    }),
    setEx: jest.fn(async (key: string, _seconds: number, value: string) => {
      mockCache.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      mockCache.delete(key);
      return 1;
    }),
    incr: jest.fn(async (key: string) => {
      const val = parseInt(mockCache.get(key) || '0', 10) + 1;
      mockCache.set(key, val.toString());
      return val;
    }),
    expire: jest.fn(async (_key: string, _seconds: number) => true),
    ping: jest.fn(async () => 'PONG'),
    flushDb: jest.fn(async () => {
      mockCache.clear();
    }),
    isOpen: true,
  };
  return {
    getRedisClient: jest.fn(async () => mockRedisClient),
    closeRedis: jest.fn(async () => {}),
    isServerlessRedis: jest.fn(() => false),
  };
});

// Mock window.matchMedia and IntersectionObserver only if running in a browser-like environment (jsdom)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver
  class MockIntersectionObserver {
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });

  global.IntersectionObserver = MockIntersectionObserver as any;

  // Mock ResizeObserver
  class MockResizeObserver {
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
  });

  global.ResizeObserver = MockResizeObserver as any;
}

jest.mock('../../packages/redis/src/cache', () => {
  const actual = jest.requireActual('../../packages/redis/src/cache');
  return {
    ...actual,
    cacheGet: jest.fn(async () => null),
    cacheGetWithStats: jest.fn(async () => ({ value: null, stats: null })),
    cacheSet: jest.fn(async () => undefined),
    cacheSetWithTags: jest.fn(async () => undefined),
    cacheWrap: jest.fn(async (_key, _ttl, loader) => loader()),
    cacheDelete: jest.fn(async () => undefined),
    cacheDeletePattern: jest.fn(async () => undefined),
    cacheEvictL1ByPrefix: jest.fn(() => undefined),
    clearMemoryCache: jest.fn(() => undefined),
  };
});

jest.mock('@repo/agents', () => ({
  SubagentCoordinator: class {
    run() {
      return Promise.resolve('AI Summary Mock');
    }
  },
}));
