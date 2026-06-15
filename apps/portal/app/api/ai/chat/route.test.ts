/**
 * @jest-environment node
 */

import { POST } from "./route";
import { resetRateLimits } from "@/lib/ai/rate-limiter";
import { resetMiddlewareRateLimits } from "@/lib/api/rate-limit-middleware";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
  }),
}));

jest.mock("@/lib/ai/ollama", () => ({
  ollamaChatStream: jest.fn().mockResolvedValue(
    (async function* () {
      yield "Hello";
    })(),
  ),
  ollamaChat: jest.fn().mockResolvedValue("Hello"),
  ollamaEmbed: jest.fn().mockResolvedValue([[0.1, 0.2]]),
  DEFAULT_MODEL: "gemma4:latest",
}));

jest.mock("@/lib/ai/providers", () => ({
  models: {
    primary: { id: "primary-model" },
    secondary: { id: "secondary-model" },
  },
}));

jest.mock("@/lib/ai/prompts", () => ({
  systemPrompts: {
    chat: jest.fn((ctx?: string) => `system prompt: ${ctx || "default"}`),
  },
}));

jest.mock("@/lib/ai/tools", () => ({
  aiTools: { machineStatus: {} },
}));

jest.mock("@/lib/ai/memory", () => ({
  storeMemory: jest.fn().mockResolvedValue(undefined),
  retrieveRelevantMemories: jest.fn().mockResolvedValue([]),
  formatMemoriesForContext: jest.fn().mockReturnValue(""),
}));

// Mock tool dispatch — avoids actual fetch() to local Ollama in tests
jest.mock("@/lib/ai/tool-dispatch", () => ({
  dispatchTool: jest.fn().mockResolvedValue(null),
  formatToolDescriptions: jest.fn().mockReturnValue(""),
}));

// Mock tool cache — uses a fresh in-memory store per test
jest.mock("@/lib/ai/tool-cache", () => {
  const store = new Map<string, unknown>();
  return {
    getCachedToolResult: jest.fn(
      (toolName: string, args: Record<string, unknown>) => {
        const key = `${toolName}:${JSON.stringify(args)}`;
        return store.get(key);
      },
    ),
    setCachedToolResult: jest.fn(
      (toolName: string, args: Record<string, unknown>, result: unknown) => {
        const key = `${toolName}:${JSON.stringify(args)}`;
        store.set(key, result);
      },
    ),
    invalidateToolCache: jest.fn((toolName: string) => {
      for (const key of store.keys()) {
        if (key.startsWith(`${toolName}:`)) store.delete(key);
      }
    }),
    clearToolCache: jest.fn(() => store.clear()),
    getToolCacheSize: jest.fn(() => store.size),
  };
});

// Mock @repo/redis to avoid actual connections in test environment, falling back to MemoryStore
jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn(() => {
    throw new Error("Redis mock not configured");
  }),
}));

const { createServerSupabaseClient } = jest.requireMock(
  "@repo/supabase/server",
);
const { storeMemory, retrieveRelevantMemories } =
  jest.requireMock("@/lib/ai/memory");
const { ollamaChatStream } = jest.requireMock("@/lib/ai/ollama");
describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    resetMiddlewareRateLimits();
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
    });
    ollamaChatStream.mockResolvedValue(
      (async function* () {
        yield "Hello";
      })(),
    );
  });

  function createRequest(body: unknown, headers?: Record<string, string>) {
    return new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.0.0.1",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  it("rejects malformed input with 400", async () => {
    const req = createRequest({ messages: "not-an-array" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid request");
    expect(json.details).toBeDefined();
  });

  it("accepts valid input and returns stream response", async () => {
    const req = createRequest({
      messages: [{ id: "1", role: "user", content: "Hello" }],
      context: "test-context",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(ollamaChatStream).toHaveBeenCalledTimes(1);
  });

  it("rate limits after 30 requests from the same IP", async () => {
    const body = {
      messages: [{ id: "1", role: "user", content: "Hello" }],
    };

    // 30 requests should succeed
    for (let i = 0; i < 30; i++) {
      const req = createRequest(body);
      const res = await POST(req);
      // Each request re-auths via agent graph; ollama is mocked so 200
      expect(res.status).toBe(200);
    }

    // 31st request should be rate limited
    const req = createRequest(body);
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: "Rate limit exceeded" }),
    );
  });

  it("resets rate limit window after 60 seconds", async () => {
    jest.useFakeTimers();
    const body = {
      messages: [{ id: "1", role: "user", content: "Hello" }],
    };

    // Exhaust the rate limit
    for (let i = 0; i < 30; i++) {
      const req = createRequest(body);
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    const blockedReq = createRequest(body);
    const blockedRes = await POST(blockedReq);
    expect(blockedRes.status).toBe(429);

    // Advance time past the window
    jest.advanceTimersByTime(61_000);

    const nextReq = createRequest(body);
    const nextRes = await POST(nextReq);
    expect(nextRes.status).toBe(200);

    jest.useRealTimers();
  });

  it("rejects messages with invalid roles", async () => {
    const req = createRequest({
      messages: [{ id: "1", role: "invalid-role", content: "Hello" }],
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects more than 50 messages", async () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      id: String(i),
      role: "user" as const,
      content: "hi",
    }));

    const req = createRequest({ messages });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when Ollama fails", async () => {
    ollamaChatStream.mockRejectedValue(new Error("Ollama down"));

    const req = createRequest({
      messages: [{ id: "1", role: "user", content: "Hello" }],
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to generate response");
  });

  it("returns 401 when user is not authenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Not authenticated"),
        }),
      },
    });

    const req = createRequest({
      messages: [{ id: "1", role: "user", content: "Hello" }],
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("stores and retrieves memories for user message", async () => {
    const req = createRequest({
      messages: [
        { id: "msg-1", role: "user", content: "Tell me about mining" },
      ],
      sessionId: "session-abc",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(storeMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-abc",
        content: expect.stringContaining("Tell me about mining"),
        memoryType: "episodic",
      }),
    );
    expect(retrieveRelevantMemories).toHaveBeenCalledTimes(2);
  });

  it("generates a session ID when none provided", async () => {
    const req = createRequest({
      messages: [{ id: "msg-1", role: "user", content: "Hello" }],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    // sessionId is generated internally and passed to storeMemory
    expect(storeMemory).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: expect.stringMatching(/^sess_/) }),
    );
  });

  it("continues when memory retrieval fails", async () => {
    retrieveRelevantMemories.mockRejectedValue(
      new Error("Memory service down"),
    );

    const req = createRequest({
      messages: [{ id: "msg-1", role: "user", content: "Hello" }],
    });

    const res = await POST(req);
    // Should still succeed despite memory failure
    expect(res.status).toBe(200);
  });
});
