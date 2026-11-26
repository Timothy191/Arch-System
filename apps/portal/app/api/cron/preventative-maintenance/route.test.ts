/**
 * @jest-environment node
 */

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  serverlessRedis: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
  },
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { createServiceRoleClient } from '@repo/supabase/service-role';
import { GET } from './route';

const TEST_CRON_SECRET = 'test-cron-secret-value-at-least-16';

describe('GET /api/cron/preventative-maintenance', () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = TEST_CRON_SECRET;
  });

  afterAll(() => {
    if (prevSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = prevSecret;
    }
  });

  it('returns 401 when Authorization header is missing or invalid', async () => {
    const req = new Request('http://localhost/api/cron/preventative-maintenance', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 and executes Supabase fallback when authorized with CRON_SECRET', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          is: jest.fn(async () => ({ count: 14, error: null })),
        })),
      })),
    });

    const req = new Request('http://localhost/api/cron/preventative-maintenance', {
      method: 'GET',
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      result?: { activeMachinesCount: number };
    };
    expect(body.success).toBe(true);
    expect(body.result?.activeMachinesCount).toBe(14);
  });
});
