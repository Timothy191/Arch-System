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
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-cron-secret',
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
  });
});
