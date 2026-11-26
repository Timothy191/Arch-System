/** @jest-environment node */

import { NextResponse } from 'next/server';

const mockLte = jest.fn();
const mockNot = jest.fn(() => ({ lte: mockLte }));
const mockEq = jest.fn(() => ({ not: mockNot }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSendOperationalAlert = jest.fn().mockResolvedValue({ acknowledged: true });
jest.mock('@repo/utils/novu', () => ({
  sendOperationalAlert: (...args: unknown[]) => mockSendOperationalAlert(...args),
}));

const mockTriggerTrackedWorkflow = jest.fn();
jest.mock('@/lib/jobs/workflow-runner', () => ({
  triggerTrackedWorkflow: (...args: unknown[]) => mockTriggerTrackedWorkflow(...args),
}));

import { GET } from './route';

function makeRequest(url: string, headers?: Record<string, string>): Request {
  return {
    url,
    method: 'GET',
    headers: new Headers(headers),
  } as unknown as Request;
}

describe('GET /api/cron/contractor-expiry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
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
    const req = makeRequest('http://localhost/api/cron/contractor-expiry');
    const res = await GET(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(401);
  });

  it('returns 200 when authorized and fallback executes', async () => {
    mockLte.mockResolvedValueOnce({
      data: [{ id: 'badge-1', badge_number: 'B-001', expires_at: '2026-11-27T00:00:00Z' }],
      error: null,
    });

    mockTriggerTrackedWorkflow.mockImplementationOnce(
      async (
        _jobId: string,
        _path: string,
        _payload: unknown,
        options?: { fallback?: () => Promise<unknown> }
      ) => {
        const result = options?.fallback ? await options.fallback() : null;
        return { jobId: _jobId, status: 'completed', result };
      }
    );

    const req = makeRequest('http://localhost/api/cron/contractor-expiry', {
      authorization: 'Bearer test-cron-secret',
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.expiringCount).toBe(1);
    expect(mockSendOperationalAlert).toHaveBeenCalledWith(
      'access-control-ops',
      'contractor-expiry-alert',
      expect.objectContaining({ expiringCount: 1 })
    );
  });
});
