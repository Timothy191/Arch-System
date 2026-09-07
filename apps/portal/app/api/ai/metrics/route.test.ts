/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/errors/error-logger", () => ({
  logError: jest.fn(),
}));

const { createServerSupabaseClient } = require("@repo/supabase/server");
const { logError } = require("@/lib/errors/error-logger");

function buildRequest(url = "http://localhost:3000/api/ai/metrics") {
  return new Request(url, { method: "GET" });
}

function createQueryMock(rows: unknown[]) {
  const promise = Promise.resolve({ data: rows, error: null });

  const builder = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  };

  Object.assign(builder, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  });

  return builder;
}

function mockSupabase(rows: unknown[]) {
  createServerSupabaseClient.mockResolvedValue({
    from: jest.fn(() => createQueryMock(rows)),
  });
}

describe("GET /api/ai/metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns zeroed metrics when usage is empty", async () => {
    mockSupabase([]);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.metrics.totalTokens).toBe(0);
    expect(json.metrics.totalRequests).toBe(0);
    expect(json.metrics.byModel).toEqual([]);
    expect(json.metrics.recentUsage).toEqual([]);
  });

  it("aggregates totals, costs, cache ratio, and model breakdown", async () => {
    const rows = [
      {
        id: "usage-0",
        created_at: "2026-09-07T10:00:00Z",
        model_name: "gpt-4o",
        total_tokens: 100,
        prompt_tokens: 60,
        completion_tokens: 40,
        cached_prompt_tokens: 30,
        total_cost_usd_cents: 50,
        latency_ms: 120,
        status: "success",
        department_id: null,
      },
      {
        id: "usage-1",
        created_at: "2026-09-07T09:00:00Z",
        model_name: "gpt-4o",
        total_tokens: 200,
        prompt_tokens: 120,
        completion_tokens: 80,
        cached_prompt_tokens: 90,
        total_cost_usd_cents: 80,
        latency_ms: 180,
        status: "success",
        department_id: null,
      },
      {
        id: "usage-2",
        created_at: "2026-09-07T08:00:00Z",
        model_name: "claude-3.5",
        total_tokens: 50,
        prompt_tokens: 30,
        completion_tokens: 20,
        cached_prompt_tokens: 10,
        total_cost_usd_cents: 25,
        latency_ms: 90,
        status: "success",
        department_id: null,
      },
    ];

    mockSupabase(rows);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    expect(json.metrics.totalTokens).toBe(350);
    expect(json.metrics.totalPromptTokens).toBe(210);
    expect(json.metrics.totalCompletionTokens).toBe(140);
    expect(json.metrics.totalCachedTokens).toBe(130);
    expect(json.metrics.totalCostUSD).toBeCloseTo(1.55, 5);
    expect(json.metrics.totalCostZAR).toBeCloseTo(1.55 * 18.52, 5);
    expect(json.metrics.cacheHitRatio).toBeCloseTo(Math.round((130 / 210) * 100 * 10) / 10, 5);
    expect(json.metrics.tokensSaved).toBe(130 * 0.75);
    expect(json.metrics.totalRequests).toBe(3);
    expect(json.metrics.avgLatency).toBe(Math.round((120 + 180 + 90) / 3));

    expect(json.metrics.byModel).toHaveLength(2);
    const gpt = json.metrics.byModel.find((m) => m.name === "gpt-4o");
    expect(gpt.tokens).toBe(300);
    expect(gpt.cost).toBe(130);
    expect(gpt.requests).toBe(2);
    expect(gpt.cachedTokens).toBe(120);
    expect(gpt.percentage).toBeCloseTo(Math.round((300 / 350) * 100 * 10) / 10, 5);

    const claude = json.metrics.byModel.find((m) => m.name === "claude-3.5");
    expect(claude.percentage).toBeCloseTo(Math.round((50 / 350) * 100 * 10) / 10, 5);

    expect(json.metrics.recentUsage).toHaveLength(3);
    expect(json.metrics.recentUsage[0]).toMatchObject({
      id: "usage-0",
      model: "gpt-4o",
      tokens: 100,
      costCents: 50,
      latency: 120,
      status: "success",
    });
  });

  it("limits recent usage to 20 rows", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `usage-${i}`,
      created_at: new Date(Date.now() - i * 1000).toISOString(),
      model_name: "gpt-4o",
      total_tokens: i + 1,
      prompt_tokens: i + 1,
      completion_tokens: 0,
      cached_prompt_tokens: 0,
      total_cost_usd_cents: i + 1,
      latency_ms: 100,
      status: "success",
      department_id: null,
    }));

    mockSupabase(rows);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.metrics.recentUsage).toHaveLength(20);
    expect(json.metrics.recentUsage[0].tokens).toBe(1);
    expect(json.metrics.recentUsage[19].tokens).toBe(20);
  });

  it("returns 500 and logs when Supabase query errors", async () => {
    const promise = Promise.resolve({ data: null, error: new Error("db failure") });

    const builder = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };

    Object.assign(builder, {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    });

    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn(() => builder),
    });

    const res = await GET(buildRequest());
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("db failure");
    expect(logError).toHaveBeenCalledWith(expect.any(Error), { context: "ai_metrics_route" });
  });
});
