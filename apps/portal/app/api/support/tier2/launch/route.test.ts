/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from './route';

const mockCreateServerSupabaseClient = jest.fn();
const mockGetAuthenticatedEmployee = jest.fn();
const mockCacheSet = jest.fn().mockResolvedValue(undefined);

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: (...args: unknown[]) => mockGetAuthenticatedEmployee(...args),
}));

jest.mock('@repo/redis', () => ({
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
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

const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/support/tier2/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/support/tier2/launch', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      REMOTE_DESKTOP_GATEWAY_URL: 'wss://remote-gw.plantcor.local',
      REMOTE_DESKTOP_TOKEN_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('forbids non-support roles', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u1' },
      employee: { id: 'emp-op', role: 'operator' },
    });

    const res = await POST(makeRequest({ deviceId: DEVICE_ID, sessionId: SESSION_ID }));
    expect(res.status).toBe(403);
  });

  it('rejects launch when consent is required but consent_granted_at is missing', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-sup' },
      employee: { id: 'emp-sup', role: 'supervisor' },
    });
    mockCreateServerSupabaseClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'remote_support_devices') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: DEVICE_ID,
                      hostname: 'CR-OP-01',
                      protocol: 'rdp',
                      network_host: '10.20.4.18',
                      network_port: 3389,
                      require_user_consent: true,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: SESSION_ID, status: 'active', consent_granted_at: null },
                error: null,
              }),
            }),
          }),
        };
      }),
    });

    const res = await POST(makeRequest({ deviceId: DEVICE_ID, sessionId: SESSION_ID }));
    expect(res.status).toBe(403);
  });

  it('mints an encrypted token, stores JTI in Redis, and audits launch when consent is granted', async () => {
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const deviceUpdateEq = jest.fn().mockResolvedValue({ error: null });

    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-sup' },
      employee: { id: 'emp-sup', role: 'supervisor' },
    });
    mockCreateServerSupabaseClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'remote_support_devices') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: DEVICE_ID,
                      hostname: 'CR-OP-01',
                      protocol: 'rdp',
                      network_host: '10.20.4.18',
                      network_port: 3389,
                      require_user_consent: true,
                      protocol_options: { security: 'nla' },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({ eq: deviceUpdateEq }),
          };
        }
        if (table === 'remote_support_sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: SESSION_ID,
                    status: 'active',
                    consent_granted_at: '2026-11-25T07:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { insert: auditInsert };
      }),
    });

    const res = await POST(makeRequest({ deviceId: DEVICE_ID, sessionId: SESSION_ID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.gatewayWsUrl).toBe('wss://remote-gw.plantcor.local');
    expect(json.token.split('.')).toHaveLength(3);
    expect(mockCacheSet).toHaveBeenCalled();
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'tier2_token_issued' })
    );
  });
});
