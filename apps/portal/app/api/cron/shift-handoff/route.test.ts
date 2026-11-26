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

describe('GET /api/cron/shift-handoff', () => {
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
    const req = new Request('http://localhost/api/cron/shift-handoff', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 and synthesizes shift handoff brief when authorized', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            is: jest.fn(async () => ({ data: [], error: null })),
            then: (onFulfilled: (val: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(onFulfilled),
          })),
        })),
      })),
    });

    const req = new Request('http://localhost/api/cron/shift-handoff', {
      method: 'GET',
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; jobId: string; brief?: unknown };
    expect(body.success).toBe(true);
    expect(body.jobId).toBeTruthy();
    expect(body.brief).toBeDefined();
  });
});
