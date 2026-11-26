/** @jest-environment node */

import { NextResponse } from 'next/server';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({
  select: jest.fn(() => ({
    maybeSingle: mockMaybeSingle,
  })),
}));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockOrder = jest.fn();
const mockSelect = jest.fn(() => ({ order: mockOrder }));
const mockFrom = jest.fn(() => ({
  update: mockUpdate,
  select: mockSelect,
}));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

jest.mock('@/lib/api/rate-limit-middleware', () => ({
  withRateLimit: jest.fn((_req: Request, handler: () => Promise<NextResponse>) => handler()),
}));

const mockCacheInvalidateTags = jest.fn().mockResolvedValue(undefined);
jest.mock('@repo/redis/cache', () => ({
  cacheInvalidateTags: (...args: unknown[]) => mockCacheInvalidateTags(...args),
}));

const mockSendOperationalAlert = jest.fn().mockResolvedValue({ acknowledged: true });
jest.mock('@repo/utils/novu', () => ({
  sendOperationalAlert: (...args: unknown[]) => mockSendOperationalAlert(...args),
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { resetAlertTriggerCooldowns } from '@/lib/alerts/operational-alert-triggers';
import { GET, POST } from './route';

function makeRequest(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): Request {
  return {
    url,
    method: init?.method ?? 'GET',
    headers: new Headers(init?.headers),
    json: async () => JSON.parse(init?.body ?? '{}'),
  } as unknown as Request;
}

describe('API /api/access-control/gates/heartbeat', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAlertTriggerCooldowns();
    process.env = {
      ...originalEnv,
      SCANNER_API_KEY: 'test-scanner-secret',
      NOVU_API_KEY: 'test-novu-key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 401 when authorization header is missing or invalid', async () => {
    const req = makeRequest('http://localhost/api/access-control/gates/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ gateId: 'GATE-01-NORTH' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when payload fails validation', async () => {
    const req = makeRequest('http://localhost/api/access-control/gates/heartbeat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-scanner-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when gate is not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest('http://localhost/api/access-control/gates/heartbeat', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-scanner-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ gateId: 'GATE-UNKNOWN' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 200, updates heartbeat, invalidates tags, and sends fault alert when faultMessage is present', async () => {
    const gateRecord = {
      id: 'GATE-01-NORTH',
      name: 'Main Gate North Turnstile',
      gate_location: 'Main Gate North Turnstile',
      zone: 'ZONE-01 (Primary Perimeter)',
      last_heartbeat_at: '2026-11-26T10:00:00.000Z',
      interlock_active: true,
      is_maintenance: false,
      department_id: '11111111-1111-4111-8111-111111111111',
    };
    mockMaybeSingle.mockResolvedValueOnce({ data: gateRecord, error: null });

    const req = makeRequest('http://localhost/api/access-control/gates/heartbeat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-scanner-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        gateId: 'GATE-01-NORTH',
        interlockActive: true,
        faultMessage: 'Turnstile optical sensor obstructed',
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.gate.id).toBe('GATE-01-NORTH');
    expect(mockCacheInvalidateTags).toHaveBeenCalledWith([
      'access-control',
      'dept:11111111-1111-4111-8111-111111111111',
    ]);
    expect(mockSendOperationalAlert).toHaveBeenCalledWith(
      'access-control-ops',
      'access-control-gate-fault',
      expect.objectContaining({
        gateId: 'GATE-01-NORTH',
        faultMessage: 'Turnstile optical sensor obstructed',
      })
    );
  });

  it('does not trigger sendOperationalAlert on normal heartbeat or during gate maintenance', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'GATE-01-NORTH',
          name: 'Main Gate North Turnstile',
          gate_location: 'Main Gate North Turnstile',
          zone: 'ZONE-01',
          last_heartbeat_at: '2026-11-26T10:00:00.000Z',
          interlock_active: false,
          is_maintenance: false,
          department_id: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'GATE-03-PLANT',
          name: 'Processing Plant Turnstile',
          gate_location: 'Processing Plant Turnstile',
          zone: 'ZONE-03',
          last_heartbeat_at: '2026-11-26T10:00:00.000Z',
          interlock_active: false,
          is_maintenance: true,
          department_id: null,
        },
        error: null,
      });

    const healthyReq = makeRequest('http://localhost/api/access-control/gates/heartbeat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-scanner-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ gateId: 'GATE-01-NORTH', interlockActive: false }),
    });
    const healthyRes = await POST(healthyReq);
    expect(healthyRes.status).toBe(200);

    const maintenanceReq = makeRequest('http://localhost/api/access-control/gates/heartbeat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-scanner-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        gateId: 'GATE-03-PLANT',
        isMaintenance: true,
        faultMessage: 'Planned calibration',
      }),
    });
    const maintenanceRes = await POST(maintenanceReq);
    expect(maintenanceRes.status).toBe(200);
    expect(mockSendOperationalAlert).not.toHaveBeenCalled();
  });

  it('GET returns 200 with gate status summary', async () => {
    const nowIso = new Date().toISOString();
    const staleIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    mockOrder.mockResolvedValueOnce({
      data: [
        {
          id: 'GATE-01-NORTH',
          name: 'Main Gate North Turnstile',
          gate_location: 'Main Gate North Turnstile',
          zone: 'ZONE-01',
          gate_type: 'TURNSTILE_ARRAY',
          last_heartbeat_at: nowIso,
          interlock_active: false,
          is_maintenance: false,
          department_id: null,
        },
        {
          id: 'GATE-02-EAST',
          name: 'East Pit Boom Gate',
          gate_location: 'East Pit Boom Gate',
          zone: 'ZONE-02',
          gate_type: 'BOOM_BARRIER',
          last_heartbeat_at: staleIso,
          interlock_active: false,
          is_maintenance: false,
          department_id: null,
        },
        {
          id: 'GATE-03-PLANT',
          name: 'Processing Plant Turnstile',
          gate_location: 'Processing Plant Turnstile',
          zone: 'ZONE-03',
          gate_type: 'TURNSTILE_ARRAY',
          last_heartbeat_at: null,
          interlock_active: false,
          is_maintenance: true,
          department_id: null,
        },
      ],
      error: null,
    });

    const req = makeRequest('http://localhost/api/access-control/gates/heartbeat', {
      method: 'GET',
      headers: {
        authorization: 'Bearer test-scanner-secret',
      },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.summary).toEqual({
      total: 3,
      online: 1,
      offline: 1,
      maintenance: 1,
    });
  });
});
