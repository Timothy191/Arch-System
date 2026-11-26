/**
 * @jest-environment node
 */
import { GET } from './route';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/contract', () => ({
  observabilitySummaryResponseSchema: {
    parse: jest.fn((payload: unknown) => payload),
  },
}));

jest.mock('@/lib/observability/observability-clients', () => ({
  fetchObservabilitySummary: jest.fn(async () => ({
    generatedAt: '2026-11-26T06:00:00.000Z',
    deploymentTarget: 'local',
    services: [],
    metrics: [],
    dashboards: [],
    cacheSnapshot: {
      hits: 1,
      misses: 0,
      l1Hits: 1,
      l2Hits: 0,
      redisErrors: 0,
      avgLatencyMs: 1,
      p95LatencyMs: 2,
    },
  })),
}));

const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase') as {
  getAuthenticatedEmployee: jest.Mock;
};

describe('GET /api/observability/summary RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedEmployee.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated employee is not admin', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-op' },
      employee: { id: 'emp-op', role: 'operator' },
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 200 with summary payload for admin', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-admin' },
      employee: { id: 'emp-admin', role: 'admin' },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cacheSnapshot.l1Hits).toBe(1);
  });
});
