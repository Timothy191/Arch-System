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
  observabilityCiResponseSchema: {
    parse: jest.fn((payload: unknown) => payload),
  },
}));

jest.mock('@/lib/observability/observability-clients', () => ({
  fetchObservabilityCi: jest.fn(async () => ({
    generatedAt: '2026-11-26T06:00:00.000Z',
    mode: 'fallback',
    detail: 'GitHub Actions fallback',
    pipelines: [],
  })),
}));

const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase') as {
  getAuthenticatedEmployee: jest.Mock;
};

describe('GET /api/observability/ci RBAC', () => {
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
      user: { id: 'u-sup' },
      employee: { id: 'emp-sup', role: 'supervisor' },
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 200 with CI payload for admin', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-admin' },
      employee: { id: 'emp-admin', role: 'admin' },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe('fallback');
  });
});
