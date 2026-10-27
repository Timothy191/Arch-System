/**
 * @jest-environment node
 */

import { GET, REGISTERED_VERCEL_CRONS } from './route';

const TEST_CRON_SECRET = 'super-secret-vercel-cron-token-2026';

describe('GET /api/cron', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
  });

  afterAll(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = new Request('http://localhost/api/cron', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header has an invalid bearer token', async () => {
    const req = new Request('http://localhost/api/cron', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid-cron-secret-value' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not configured in environment', async () => {
    delete process.env.CRON_SECRET;
    const req = new Request('http://localhost/api/cron', {
      method: 'GET',
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const res = await GET(req);
    expect([401, 503]).toContain(res.status);
  });

  it('returns 200 with { ok: true } and registered jobs when authorized with CRON_SECRET', async () => {
    const req = new Request('http://localhost/api/cron', {
      method: 'GET',
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe('healthy');
    expect(body.jobs).toEqual(REGISTERED_VERCEL_CRONS);
    expect(body.jobs[0]).toEqual(
      expect.objectContaining({
        path: '/api/cron',
        schedule: '0 10 * * *',
      })
    );
  });
});
