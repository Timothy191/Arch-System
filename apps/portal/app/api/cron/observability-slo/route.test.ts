/** @jest-environment node */

import { NextResponse } from 'next/server';

const mockCaptureAndPersistSloSnapshot = jest.fn();
jest.mock('@/lib/observability/slo-snapshot', () => ({
  captureAndPersistSloSnapshot: (...args: unknown[]) => mockCaptureAndPersistSloSnapshot(...args),
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
import { GET } from './route';

function makeRequest(url: string, headers?: Record<string, string>): Request {
  return {
    url,
    method: 'GET',
    headers: new Headers(headers),
  } as unknown as Request;
}

describe('GET /api/cron/observability-slo', () => {
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

  it('returns 401 when cron secret is missing', async () => {
    const req = makeRequest('http://localhost/api/cron/observability-slo');
    const res = await GET(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(401);
  });

  it('triggers observability-slo-breach only for breached targets and suppresses healthy targets', async () => {
    mockCaptureAndPersistSloSnapshot.mockResolvedValueOnce({
      recordedTargets: ['supabase', 'redis'],
      persistence: { persisted: true },
      summaries: [
        {
          targetId: 'supabase',
          label: 'Supabase Cloud (Postgres & Auth)',
          currentStatus: 'UP',
          sloBudgetState: 'HEALTHY',
          sla24hPct: 100,
          p95LatencyMs: 120,
          ticks: [],
        },
        {
          targetId: 'redis',
          label: 'Redis L1/L2 Cache Engine',
          currentStatus: 'DOWN',
          sloBudgetState: 'CRITICAL',
          sla24hPct: 91.5,
          p95LatencyMs: 1850,
          ticks: [],
        },
      ],
    });

    const req = makeRequest('http://localhost/api/cron/observability-slo', {
      authorization: 'Bearer test-cron-secret',
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSendOperationalAlert).toHaveBeenCalledTimes(1);
    expect(mockSendOperationalAlert).toHaveBeenCalledWith(
      'platform-ops',
      'observability-slo-breach',
      expect.objectContaining({
        targetId: 'redis',
        sloBudgetState: 'CRITICAL',
      })
    );
  });
});
