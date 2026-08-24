import {
  APIError,
  AuthError,
  FetchTimeoutError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@repo/errors";
import { FetchClient, createFetchClient } from "./fetch-client";

describe("FetchClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("performs a successful GET request and parses JSON", async () => {
    const mockData = { id: 1, name: "Test Unit" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockData),
    } as unknown as Response);

    const client = createFetchClient();
    const result = await client.get<{ id: number; name: string }>("/api/test");

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("prepends baseURL when relative URL is provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ status: "ok" }),
    } as unknown as Response);

    const client = new FetchClient({ baseURL: "https://api.archsystem.local/v1" });
    await client.get("/telemetry");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.archsystem.local/v1/telemetry",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("wraps TypeError('Failed to fetch') as NetworkError", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const client = new FetchClient({ maxRetries: 0 });

    await expect(client.get("/offline-endpoint")).rejects.toThrow(NetworkError);
  });

  it("maps 401 response to AuthError", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "content-type": "application/json" }),
      json: jest.fn().mockResolvedValue({ message: "Invalid session token" }),
    } as unknown as Response);

    const client = createFetchClient({ maxRetries: 0 });

    await expect(client.get("/protected")).rejects.toThrow(AuthError);
  });

  it("maps 404 response to NotFoundError", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers({ "content-type": "application/json" }),
      json: jest.fn().mockResolvedValue({ message: "Equipment record not found" }),
    } as unknown as Response);

    const client = createFetchClient({ maxRetries: 0 });

    await expect(client.get("/equipment/999")).rejects.toThrow(NotFoundError);
  });

  it("retries on retryable 503 status up to maxRetries", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        headers: new Headers(),
        text: jest.fn().mockResolvedValue("Unavailable"),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true }),
      } as unknown as Response);

    global.fetch = mockFetch;

    const client = new FetchClient({
      maxRetries: 2,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });

    const res = await client.get<{ success: boolean }>("/status");
    expect(res).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("executes onRequest interceptor before executing fetch", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as Response);

    const client = new FetchClient({
      interceptors: {
        onRequest: (_url, init) => {
          const headers = new Headers(init.headers);
          headers.set("X-Arch-Trace-Id", "trace-12345");
          return { ...init, headers };
        },
      },
    });

    await client.get("/health");

    expect(global.fetch).toHaveBeenCalledWith(
      "/health",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });
});
