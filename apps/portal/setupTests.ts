import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || (TextDecoder as any);

// Override environment variables to prevent local development .env from polluting tests
process.env.DISABLE_RATE_LIMIT = "false";
process.env.NEXT_PUBLIC_FUXA_URL = "http://localhost:1881";

// Jest setup file — provide Web API globals that Next.js server modules expect

// but jsdom may not define in all versions.

global.Request =
  global.Request ||
  class Request {
    url: string;
    constructor(input: string | Request) {
      this.url = typeof input === "string" ? input : input.url;
    }
  };

global.Response =
  global.Response ||
  class Response {
    status: number;
    constructor(body?: BodyInit | null, _init?: ResponseInit) {
      this.status = _init?.status ?? 200;
    }
  };

// Global mock for redis to avoid database connection timeout/hangs in tests
jest.mock("@repo/redis", () => {
  const actual = jest.requireActual("@repo/redis");
  const mockCache = new Map<string, string>();
  const mockRedisClient = {
    get: jest.fn(async (key: string) => mockCache.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockCache.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      mockCache.delete(key);
    }),
    incr: jest.fn(async (key: string) => {
      const val = parseInt(mockCache.get(key) || "0", 10) + 1;
      mockCache.set(key, val.toString());
      return val;
    }),
    // AGENT-TRACE: Mock expire function - parameters prefixed with underscore to fix ESLint warnings
    // These are unused in the mock implementation but required for interface compatibility
    expire: jest.fn(async (_key: string, _seconds: number) => {
      return true;
    }),
    // AGENT-TRACE: Align flushDb name with actual client type
    flushDb: jest.fn(async () => {
      mockCache.clear();
    }),
    isOpen: true,
  };
  return {
    ...actual,
    getRedisClient: jest.fn(async () => mockRedisClient),
    closeRedis: jest.fn(async () => {}),
  };
});

jest.mock("../../packages/redis/src/client", () => {
  const mockCache = new Map<string, string>();
  const mockRedisClient = {
    get: jest.fn(async (key: string) => mockCache.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockCache.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      mockCache.delete(key);
    }),
    incr: jest.fn(async (key: string) => {
      const val = parseInt(mockCache.get(key) || "0", 10) + 1;
      mockCache.set(key, val.toString());
      return val;
    }),
    // AGENT-TRACE: Mock expire function - parameters prefixed with underscore to fix ESLint warnings
    // These are unused in the mock implementation but required for interface compatibility
    expire: jest.fn(async (_key: string, _seconds: number) => {
      return true;
    }),
    // AGENT-TRACE: Align flushDb name with actual client type
    flushDb: jest.fn(async () => {
      mockCache.clear();
    }),
    isOpen: true,
  };
  return {
    getRedisClient: jest.fn(async () => mockRedisClient),
    closeRedis: jest.fn(async () => {}),
  };
});

// Mock window.matchMedia and IntersectionObserver only if running in a browser-like environment (jsdom)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
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

  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });

  global.IntersectionObserver = MockIntersectionObserver as any;
}
