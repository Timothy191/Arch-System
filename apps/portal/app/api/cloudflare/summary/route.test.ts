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
  cloudflareSummaryResponseSchema: {
    parse: jest.fn((payload: unknown) => payload),
  },
}));

jest.mock('@/lib/cloudflare/cloudflare-client', () => ({
  getCloudflareClient: jest.fn(() => ({
    getAccountStatus: jest.fn(async () => ({ mode: 'not_connected' })),
    getZeroTrustStatus: jest.fn(async () => ({ mode: 'not_connected' })),
    getTunnelStatus: jest.fn(async () => ({ mode: 'not_connected' })),
    getWorkersStatus: jest.fn(async () => ({ mode: 'not_connected' })),
    getQueuesStatus: jest.fn(async () => ({ mode: 'not_connected' })),
    getTurnstileStatus: jest.fn(async () => ({ mode: 'not_connected' })),
    getAiGatewayStatus: jest.fn(async () => ({ mode: 'not_connected' })),
    getR2Status: jest.fn(async () => ({ mode: 'not_connected' })),
    getSecurityCentreStatus: jest.fn(async () => ({ mode: 'not_connected' })),
  })),
}));

const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase') as {
  getAuthenticatedEmployee: jest.Mock;
};

describe('GET /api/cloudflare/summary RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedEmployee.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not admin', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-op' },
      employee: { id: 'emp-op', role: 'operator' },
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 200 summary payload for admin', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-admin' },
      employee: { id: 'emp-admin', role: 'admin' },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.account.mode).toBe('not_connected');
  });
});
