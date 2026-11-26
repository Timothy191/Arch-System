/** @jest-environment node */

import { NextResponse } from 'next/server';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

const mockExecuteVisitorAutoExitSweep = jest.fn();
jest.mock('@/app/(departments)/access-control/visitors/auto-exit-service', () => ({
  executeVisitorAutoExitSweep: (...args: unknown[]) => mockExecuteVisitorAutoExitSweep(...args),
}));

const mockSendOperationalAlert = jest.fn().mockResolvedValue({ acknowledged: true });
jest.mock('@repo/utils/novu', () => ({
  sendOperationalAlert: (...args: unknown[]) => mockSendOperationalAlert(...args),
}));

import { resetAlertTriggerCooldowns } from '@/lib/alerts/operational-alert-triggers';
import { GET } from './route';

function makeRequest(url: string, headers?: Record<string, string>): Request {
  return {
    url,
    method: 'GET',
    headers: new Headers(headers),
  } as unknown as Request;
}

describe('GET /api/cron/visitor-auto-exit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAlertTriggerCooldowns();
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-cron-secret',
      NOVU_API_KEY: 'test-novu-key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 401 when cron secret is missing or invalid', async () => {
    const req = makeRequest('http://localhost/api/cron/visitor-auto-exit');
    const res = await GET(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(401);
  });

  it('returns 200 when authorized and sweep succeeds', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'dept-access-control' },
      error: null,
    });
    mockExecuteVisitorAutoExitSweep.mockResolvedValueOnce({
      autoExited: [{ id: 'visitor-1' }],
    });

    const req = makeRequest('http://localhost/api/cron/visitor-auto-exit', {
      authorization: 'Bearer test-cron-secret',
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.autoExitedCount).toBe(1);
    expect(mockSendOperationalAlert).toHaveBeenCalledWith(
      'access-control-ops',
      'visitor-auto-exit-alert',
      expect.objectContaining({
        autoExitedCount: 1,
        visitorIds: ['visitor-1'],
        departmentId: 'dept-access-control',
      })
    );
  });

  it('suppresses sendOperationalAlert when zero visitors are auto-exited', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'dept-access-control' },
      error: null,
    });
    mockExecuteVisitorAutoExitSweep.mockResolvedValueOnce({
      autoExited: [],
    });

    const req = makeRequest('http://localhost/api/cron/visitor-auto-exit', {
      authorization: 'Bearer test-cron-secret',
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.autoExitedCount).toBe(0);
    expect(mockSendOperationalAlert).not.toHaveBeenCalled();
  });
});
