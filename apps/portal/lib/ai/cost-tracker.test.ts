/**
 * @jest-environment node
 */
import { trackUsage, getUsageSummary, getSessionUsage } from "./cost-tracker";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock(
  "@repo/supabase/server",
);

function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  const mock = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    ...overrides,
  };
  createServerSupabaseClient.mockResolvedValue(mock);
  return mock;
}

describe("trackUsage", () => {
  it("inserts usage record with estimated cost", async () => {
    const mock = buildSupabaseMock();
    mock.insert.mockResolvedValue({ error: null });

    await trackUsage("session-1", "user-1", "primary", {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    });

    expect(mock.from).toHaveBeenCalledWith("ai_usage_logs");
    const insertCall = mock.insert.mock.calls[0][0];
    expect(insertCall.session_id).toBe("session-1");
    expect(insertCall.user_id).toBe("user-1");
    expect(insertCall.provider).toBe("primary");
    expect(insertCall.model).toBe("llama-3.1-8b-instant");
    expect(insertCall.prompt_tokens).toBe(1000);
    expect(insertCall.completion_tokens).toBe(500);
    expect(insertCall.total_tokens).toBe(1500);
    expect(insertCall.estimated_cost_usd).toBeGreaterThan(0);
  });

  it("does not throw on insert error", async () => {
    const mock = buildSupabaseMock();
    mock.insert.mockResolvedValue({ error: new Error("DB down") });

    await expect(
      trackUsage("session-1", "user-1", "primary", {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      }),
    ).resolves.not.toThrow();
  });

  it("maps secondary provider to fallback model", async () => {
    const mock = buildSupabaseMock();
    mock.insert.mockResolvedValue({ error: null });

    await trackUsage("session-1", "user-1", "secondary", {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    });

    const insertCall = mock.insert.mock.calls[0][0];
    expect(insertCall.model).toBe("meta-llama/llama-3.1-8b-instruct");
  });
});

describe("getUsageSummary", () => {
  it("aggregates cost and tokens over a date range", async () => {
    const mock = buildSupabaseMock();
    // Resolve at the end of the Supabase query chain (.lte)
    mock.lte.mockResolvedValue({
      data: [
        { estimated_cost_usd: 0.0001, total_tokens: 100 },
        { estimated_cost_usd: 0.0002, total_tokens: 200 },
      ],
      error: null,
    });

    const summary = await getUsageSummary(
      "user-1",
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );

    expect(summary.totalCostUsd).toBeCloseTo(0.0003, 6);
    expect(summary.totalTokens).toBe(300);
    expect(summary.requestCount).toBe(2);
  });

  it("throws DatabaseError on query failure", async () => {
    const mock = buildSupabaseMock();
    mock.lte.mockResolvedValue({ data: null, error: new Error("fail") });

    await expect(
      getUsageSummary("user-1", new Date(), new Date()),
    ).rejects.toThrow();
  });
});

describe("getSessionUsage", () => {
  it("returns formatted usage records", async () => {
    const mock = buildSupabaseMock();
    mock.limit.mockResolvedValue({
      data: [
        {
          id: "log-1",
          session_id: "s-1",
          user_id: "u-1",
          provider: "primary",
          model: "gemma4:latest",
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          estimated_cost_usd: 0.00001,
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    const records = await getSessionUsage("s-1");
    expect(records).toHaveLength(1);
    expect(records[0]!.sessionId).toBe("s-1");
    expect(records[0]!.estimatedCostUsd).toBe(0.00001);
  });

  it("returns empty array on error", async () => {
    const mock = buildSupabaseMock();
    mock.limit.mockResolvedValue({ data: null, error: new Error("fail") });

    const records = await getSessionUsage("s-1");
    expect(records).toEqual([]);
  });
});
