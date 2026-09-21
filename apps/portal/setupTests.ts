import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || (TextDecoder as unknown as typeof global.TextDecoder);

// Override environment variables to prevent local development .env from polluting tests
process.env.DISABLE_RATE_LIMIT = "false";
process.env.NEXT_PUBLIC_FUXA_URL = "http://localhost:1881";

// Jest setup file — provide Web API globals that Next.js server modules expect
// but jsdom may not define in all versions.

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((cb) => cb),
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

// next/font/google is rewritten by the Next build pipeline and cannot execute
// under @swc/jest, so any page that loads a font fails at import time. Each
// font export resolves to a stub with the same shape (className / variable /
// style) that the page spreads into its root element.
//
// The `variable` here is derived from the font's export name; the real CSS
// custom property comes from the `variable` option passed at the call site and
// only has meaning once a stylesheet is applied, which never happens in jsdom.
jest.mock("next/font/google", () => {
  const makeStub = (name: string) => () => ({
    className: `font-${name}`,
    variable: `--font-${name.toLowerCase().replace(/_/g, "-")}`,
    style: { fontFamily: name },
  });

  return new Proxy({}, { get: (_target, name) => makeStub(String(name)) });
});

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
    constructor(_body?: BodyInit | null, _init?: ResponseInit) {
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
    value: MockIntersectionObserver as unknown as typeof IntersectionObserver,
  });

  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

  // Mock ResizeObserver
  class MockResizeObserver {
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: MockResizeObserver as unknown as typeof ResizeObserver,
  });

  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}
