// Mock @supabase/ssr
jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
  createBrowserClient: jest.fn(),
}));

// Mock next/headers
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

// Mock @repo/logger
jest.mock("@repo/logger", () => ({
  serverLogger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

import { createServerSupabaseClient, getUserSafely, instrumentedFetch } from "../server";
import { createBrowserSupabaseClient } from "../client";

describe("instrumentedFetch", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("calls fetch with correct arguments", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await instrumentedFetch("https://api.example.com/data", { method: "GET" });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", { method: "GET" });
  });

  test("returns fetch response on success", async () => {
    const mockResponse = new Response("success", { status: 200 });
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await instrumentedFetch("https://api.example.com/data");

    expect(result).toBe(mockResponse);
    expect(result.status).toBe(200);
  });

  test("returns response even on failure (does not throw)", async () => {
    const mockResponse = new Response("error", { status: 500 });
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await instrumentedFetch("https://api.example.com/data");

    expect(result).toBe(mockResponse);
    expect(result.status).toBe(500);
  });

  test("logs slow queries (duration > 500ms)", async () => {
    const { serverLogger } = require("@repo/logger");

    // Mock fetch to simulate slow response
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(new Response("ok", { status: 200 })), 600),
        ),
    );

    await instrumentedFetch("https://api.supabase.co/v1/machines");

    expect(serverLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "machines",
        method: "GET",
      }),
      expect.stringContaining("Slow database query detected"),
    );
  });

  test("logs failed queries", async () => {
    const { serverLogger } = require("@repo/logger");

    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("error", { status: 500 }));

    await instrumentedFetch("https://api.supabase.co/v1/users");

    expect(serverLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "users",
        method: "GET",
      }),
      expect.stringContaining("Database query failed"),
    );
  });

  test("logs successful queries at debug level", async () => {
    const { serverLogger } = require("@repo/logger");

    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await instrumentedFetch("https://api.supabase.co/v1/equipment");

    expect(serverLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "equipment",
        method: "GET",
      }),
      expect.stringContaining("Database query"),
    );
  });

  test("extracts table name from Supabase REST URL", async () => {
    const { serverLogger } = require("@repo/logger");

    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await instrumentedFetch("https://mrwhtxbhrzyttlsyuofc.supabase.co/rest/v1/machines?select=*");

    expect(serverLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "machines",
      }),
      expect.any(String),
    );
  });

  test("handles URL object input", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const url = new URL("https://api.supabase.co/v1/machines");
    const result = await instrumentedFetch(url);

    expect(result).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith(url, undefined);
  });

  test("handles Request object input", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const request = new Request("https://api.supabase.co/v1/machines");
    const result = await instrumentedFetch(request);

    expect(result).toBeDefined();
  });

  test("extracts method from init options", async () => {
    const { serverLogger } = require("@repo/logger");

    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await instrumentedFetch("https://api.supabase.co/v1/machines", { method: "POST" });

    expect(serverLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
      }),
      expect.any(String),
    );
  });

  test("defaults to GET method", async () => {
    const { serverLogger } = require("@repo/logger");

    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await instrumentedFetch("https://api.supabase.co/v1/machines");

    expect(serverLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
      }),
      expect.any(String),
    );
  });

  test("handles invalid URL gracefully", async () => {
    const { serverLogger } = require("@repo/logger");

    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await instrumentedFetch("not-a-valid-url");

    expect(serverLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "unknown",
      }),
      expect.any(String),
    );
  });
});

describe("createServerSupabaseClient", () => {
  const mockCookies = {
    getAll: jest.fn().mockReturnValue([]),
    set: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { cookies } = require("next/headers");
    cookies.mockResolvedValue(mockCookies);

    const { createServerClient } = require("@supabase/ssr");
    createServerClient.mockReturnValue({
      auth: { getUser: jest.fn() },
      from: jest.fn(),
    });
  });

  test("creates Supabase client with correct configuration", async () => {
    const { createServerClient } = require("@supabase/ssr");

    await createServerSupabaseClient();

    expect(createServerClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        global: expect.objectContaining({
          fetch: instrumentedFetch,
        }),
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });

  test("uses environment variables when available", async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };

    const { createServerClient } = require("@supabase/ssr");

    await createServerSupabaseClient();

    expect(createServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.any(Object),
    );

    process.env = originalEnv;
  });

  test("cookies.getAll returns all cookies", async () => {
    mockCookies.getAll.mockReturnValue([{ name: "sb-auth-token", value: "token123" }]);

    const client = await createServerSupabaseClient();

    // Verify the client was created successfully
    expect(client).toBeDefined();
  });

  test("cookies.setAll handles cookie setting", async () => {
    const client = await createServerSupabaseClient();

    // Access the setAll function from the createServerClient call
    const { createServerClient } = require("@supabase/ssr");
    const cookieConfig = createServerClient.mock.calls[0][2].cookies;

    // Test setAll
    cookieConfig.setAll([{ name: "sb-auth-token", value: "new-token", options: { path: "/" } }]);

    // Should not throw (called from Server Component context)
  });
});

describe("getUserSafely", () => {
  test("returns user when authenticated", async () => {
    const mockClaims = { sub: "user-123", email: "test@example.com" };
    const mockSupabase = {
      auth: {
        getClaims: jest.fn().mockResolvedValue({ data: mockClaims, error: null }),
      },
    };

    const result = await getUserSafely(mockSupabase as any);

    expect(result).toEqual(mockClaims);
    expect(mockSupabase.auth.getClaims).toHaveBeenCalled();
  });

  test("returns null when not authenticated", async () => {
    const mockSupabase = {
      auth: {
        getClaims: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    };

    const result = await getUserSafely(mockSupabase as any);

    expect(result).toBeNull();
  });

  test("returns null on token validation error", async () => {
    const mockSupabase = {
      auth: {
        getClaims: jest.fn().mockResolvedValue({ data: null, error: { message: "Invalid token" } }),
      },
    };

    const result = await getUserSafely(mockSupabase as any);

    expect(result).toBeNull();
  });

  test("returns null on network error", async () => {
    const mockSupabase = {
      auth: {
        getClaims: jest.fn().mockRejectedValue(new Error("Network request failed")),
      },
    };

    const result = await getUserSafely(mockSupabase as any);

    expect(result).toBeNull();
  });

  test("handles JWT validation failure gracefully", async () => {
    const mockSupabase = {
      auth: {
        getClaims: jest
          .fn()
          .mockResolvedValue({ data: null, error: { message: "JWT validation failed" } }),
      },
    };

    const result = await getUserSafely(mockSupabase as any);

    expect(result).toBeNull();
  });
});

describe("createBrowserSupabaseClient", () => {
  const originalWindow = global.window;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  test("creates browser client with correct configuration", () => {
    const { createBrowserClient } = require("@supabase/ssr");

    createBrowserSupabaseClient();

    expect(createBrowserClient).toHaveBeenCalled();
    const callArgs = createBrowserClient.mock.calls[0];
    expect(callArgs[2]).toMatchObject({
      auth: expect.objectContaining({
        persistSession: true,
      }),
    });
  });

  test("uses environment variables when available", () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };

    const { createBrowserClient } = require("@supabase/ssr");

    createBrowserSupabaseClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.any(Object),
    );

    process.env = originalEnv;
  });

  test("rewrites hostname for localhost in LAN deployment", () => {
    // Mock window object
    global.window = {
      location: {
        hostname: "localhost",
      },
    } as any;

    // Mock URL to simulate non-HTTPS
    const originalURL = global.URL;
    global.URL = class extends originalURL {
      constructor(url: string | URL) {
        super(url);
        // Override protocol to http for testing
        Object.defineProperty(this, "protocol", { value: "http:" });
      }
    } as any;

    const { createBrowserClient } = require("@supabase/ssr");

    createBrowserSupabaseClient();

    expect(createBrowserClient).toHaveBeenCalled();

    global.URL = originalURL;
  });
});
