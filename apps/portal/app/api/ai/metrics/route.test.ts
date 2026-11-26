/**
 * @jest-environment node
 */

import { getCacheStats } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { logError } from '@/lib/errors/error-logger';
import { GET } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  getCacheStats: jest.fn(),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

const mockGetAuthenticatedEmployee = jest.mocked(getAuthenticatedEmployee);
const mockCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient);
const mockGetCacheStats = jest.mocked(getCacheStats);
const mockLogError = jest.mocked(logError);

function buildRequest(url = 'http://localhost:3000/api/ai/metrics') {
  return new Request(url, { method: 'GET' });
}

function mockAdminPrincipal(role = 'admin') {
  mockGetAuthenticatedEmployee.mockResolvedValue({
    user: { id: 'u-admin-1' },
    employee: { id: 'emp-admin-1', role },
  } as never);
}

function createQueryMock(options: {
  readonly rows?: unknown[] | null;
  readonly error?: unknown;
  readonly count?: number | null;
}) {
  const promise = Promise.resolve({
    data: options.rows ?? null,
    error: options.error ?? null,
    count: options.count ?? (Array.isArray(options.rows) ? options.rows.length : null),
  });

  const builder = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };

  Object.assign(builder, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  });

  return builder;
}

function mockSupabase(rows: unknown[], count?: number) {
  const builder = createQueryMock({ rows, count });
  mockCreateServerSupabaseClient.mockResolvedValue({
    from: jest.fn(() => builder),
  } as never);
  return builder;
}

describe('GET /api/ai/metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminPrincipal('admin');
    mockGetCacheStats.mockResolvedValue({
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l2Hits: 0,
      xFetchTriggers: 0,
      redisErrors: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      l1Evictions: 0,
      l2RoundTrips: 0,
      privilegeVersionChanges: 0,
      avgWriteThroughDelayMs: 0,
    });
  });

  it('returns 401 when caller is unauthenticated', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce(null);
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    mockAdminPrincipal('operator');
    const res = await GET(buildRequest());
    expect(res.status).toBe(403);
  });

  it('returns zeroed metrics without fabricated build snapshots or fake cache latencies when usage is empty', async () => {
    const builder = mockSupabase([]);

    const res = await GET(buildRequest('http://localhost:3000/api/ai/metrics?scope=24h&limit=100'));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(builder.range).toHaveBeenCalledWith(0, 99);
    expect(json.metrics.totalTokens).toBe(0);
    expect(json.metrics.totalRequests).toBe(0);
    expect(json.metrics.byModel).toEqual([]);
    expect(json.metrics.recentUsage).toEqual([]);
    expect(json.metrics.buildTelemetry).toBeUndefined();
    expect(json.metrics.redisCacheStats.avgLatencyMs).toBe(0);
    expect(json.metrics.redisCacheStats.p95LatencyMs).toBe(0);
    expect(json.metrics.redisCacheStats.hitRatePct).toBeNull();
    expect(json.metrics.systemHealth.status).toBe('healthy');
    expect(json.metrics.pagination).toEqual({
      limit: 100,
      offset: 0,
      returnedRows: 0,
      totalCount: 0,
      hasMore: false,
    });
  });

  it('aggregates totals, costs, cache ratio, pagination, and model breakdown', async () => {
    const rows = [
      {
        id: 'usage-0',
        created_at: '2026-09-07T10:00:00Z',
        model_name: 'gpt-4o',
        total_tokens: 100,
        prompt_tokens: 60,
        completion_tokens: 40,
        cached_prompt_tokens: 30,
        total_cost_usd_cents: 50,
        latency_ms: 120,
        status: 'success',
        department_id: null,
      },
      {
        id: 'usage-1',
        created_at: '2026-09-07T09:00:00Z',
        model_name: 'gpt-4o',
        total_tokens: 200,
        prompt_tokens: 120,
        completion_tokens: 80,
        cached_prompt_tokens: 90,
        total_cost_usd_cents: 80,
        latency_ms: 180,
        status: 'success',
        department_id: null,
      },
      {
        id: 'usage-2',
        created_at: '2026-09-07T08:00:00Z',
        model_name: 'claude-3.5',
        total_tokens: 50,
        prompt_tokens: 30,
        completion_tokens: 20,
        cached_prompt_tokens: 10,
        total_cost_usd_cents: 25,
        latency_ms: 90,
        status: 'success',
        department_id: null,
      },
    ];

    mockSupabase(rows, 10);

    const res = await GET(
      buildRequest('http://localhost:3000/api/ai/metrics?limit=3&offset=0&scope=all-time')
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.metrics.totalTokens).toBe(350);
    expect(json.metrics.totalPromptTokens).toBe(210);
    expect(json.metrics.totalCompletionTokens).toBe(140);
    expect(json.metrics.totalCachedTokens).toBe(130);
    expect(json.metrics.totalCostUSD).toBeCloseTo(1.55, 5);
    expect(json.metrics.totalCostZAR).toBeCloseTo(28.71, 2);
    expect(json.metrics.cacheHitRatio).toBeCloseTo(Math.round((130 / 210) * 100 * 10) / 10, 5);
    expect(json.metrics.tokensSaved).toBe(130 * 0.75);
    expect(json.metrics.totalRequests).toBe(3);
    expect(json.metrics.avgLatency).toBe(Math.round((120 + 180 + 90) / 3));
    expect(json.metrics.pagination).toEqual({
      limit: 3,
      offset: 0,
      returnedRows: 3,
      totalCount: 10,
      hasMore: true,
    });

    expect(json.metrics.byModel).toHaveLength(2);
    const gpt = json.metrics.byModel.find((m: { name: string }) => m.name === 'gpt-4o');
    expect(gpt.tokens).toBe(300);
    expect(gpt.cost).toBe(130);
    expect(gpt.requests).toBe(2);
    expect(gpt.cachedTokens).toBe(120);
    expect(gpt.percentage).toBeCloseTo(Math.round((300 / 350) * 100 * 10) / 10, 5);
  });

  it('limits recent usage to 20 rows', async () => {
    const rows = Array.from({ length: 25 }, (_, idx) => ({
      id: `usage-${idx}`,
      created_at: new Date(Date.now() - idx * 1000).toISOString(),
      model_name: 'gpt-4o',
      total_tokens: idx + 1,
      prompt_tokens: idx + 1,
      completion_tokens: 0,
      cached_prompt_tokens: 0,
      total_cost_usd_cents: idx + 1,
      latency_ms: 100,
      status: 'success',
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

  it('returns 500 with unhealthy systemHealth and logs when Supabase query errors', async () => {
    const builder = createQueryMock({ error: new Error('db failure') });
    mockCreateServerSupabaseClient.mockResolvedValue({
      from: jest.fn(() => builder),
    } as never);

    const res = await GET(buildRequest());
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Failed to load AI metrics');
    expect(json.systemHealth.status).toBe('unhealthy');
    expect(json.systemHealth.subsystems[0].status).toBe('unhealthy');
    expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), { context: 'ai_metrics_route' });
  });

  it('reports degraded Supabase status (never healthy) when ai_token_usage is missing from schema cache (PGRST205)', async () => {
    const builder = createQueryMock({
      error: {
        code: 'PGRST205',
        details: null,
        hint: null,
        message: "Could not find the table 'public.ai_token_usage' in the schema cache",
      },
    });
    mockCreateServerSupabaseClient.mockResolvedValue({
      from: jest.fn(() => builder),
    } as never);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.metrics.totalTokens).toBe(0);
    expect(json.metrics.totalRequests).toBe(0);
    expect(json.metrics.systemHealth.status).toBe('degraded');
    expect(json.metrics.systemHealth.subsystems[0].status).toBe('degraded');
    expect(json.metrics.dbError).toContain('ai_token_usage');
  });
});
