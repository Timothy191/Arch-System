/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from './route';

const mockCreateServerSupabaseClient = jest.fn();
const mockGetAuthenticatedEmployee = jest.fn();

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: (...args: unknown[]) => mockGetAuthenticatedEmployee(...args),
}));

jest.mock('@repo/logger/server', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/api/rate-limit-middleware', () => ({
  withRateLimit: (_req: NextRequest, handler: () => Promise<Response>) => handler(),
}));

jest.mock('@/lib/api/body-limit', () => ({
  withBodyLimit: (_req: NextRequest, handler: () => Promise<Response>) => handler(),
}));

const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/support/ice-servers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/support/ice-servers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.CLOUDFLARE_CALLS_TURN_TOKEN_ID;
    delete process.env.CLOUDFLARE_CALLS_TURN_API_TOKEN;
    delete process.env.TURN_URLS;
    delete process.env.TURN_SHARED_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 401 when unauthenticated', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetAuthenticatedEmployee.mockResolvedValue(null);

    const res = await POST(makeRequest({ sessionId: SESSION_ID }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not a participant or support staff', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-other' },
      employee: { id: 'emp-other', role: 'operator' },
    });
    mockCreateServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: SESSION_ID,
                status: 'active',
                requester_employee_id: 'emp-owner',
                agent_employee_id: 'emp-agent',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({ sessionId: SESSION_ID }));
    expect(res.status).toBe(403);
  });

  it('mints coturn HMAC credentials when TURN_URLS and TURN_SHARED_SECRET are configured', async () => {
    process.env.TURN_URLS = 'turns:turn.plantcor.local:5349?transport=tcp';
    process.env.TURN_SHARED_SECRET = 'super-secret-turn-key';

    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-owner' },
      employee: { id: 'emp-owner', role: 'operator' },
    });
    mockCreateServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: SESSION_ID,
                status: 'active',
                requester_employee_id: 'emp-owner',
                agent_employee_id: 'emp-agent',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({ sessionId: SESSION_ID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe('coturn_hmac');
    expect(json.relayAvailable).toBe(true);
    expect(json.iceServers[1].username).toContain(SESSION_ID);
    expect(json.iceServers[1].credential).toBeTruthy();
  });

  it('falls back to STUN when no TURN provider is configured', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-owner' },
      employee: { id: 'emp-owner', role: 'operator' },
    });
    mockCreateServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: SESSION_ID,
                status: 'pending',
                requester_employee_id: 'emp-owner',
                agent_employee_id: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({ sessionId: SESSION_ID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe('stun_fallback');
    expect(json.relayAvailable).toBe(false);
  });
});
