/**
 * @jest-environment node
 */
import { POST } from './route';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    set: jest.fn().mockResolvedValue('OK'),
    xAdd: jest.fn().mockResolvedValue('1700000000000-0'),
    publish: jest.fn().mockResolvedValue(1),
  }),
}));

// The entry limiter is exercised in rate-limit-middleware.test.ts and the
// real-Redis integration suite; here only the per-machine limit matters.
jest.mock('@/lib/api/rate-limit-middleware', () => ({
  withRateLimit: jest.fn(async (_req: Request, handler: () => Promise<Response>) => handler()),
  checkRateLimit: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');
const { getRedisClient } = jest.requireMock('@repo/redis');
const { checkRateLimit } = jest.requireMock('@/lib/api/rate-limit-middleware');

const MACHINE_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('POST /api/telemetry/drilling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockResolvedValue({
      allowed: true,
      limit: 600,
      remaining: 599,
      resetTime: Date.now() + 60_000,
    });
  });

  it('returns 400 for invalid body payload', async () => {
    const req = new Request('http://localhost:3000/api/telemetry/drilling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid_field: 123 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when target machine is not found', async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/api/telemetry/drilling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: '123e4567-e89b-12d3-a456-426614174000',
        bit_depth: 25.5,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toBe('Machine not found');
  });

  it('successfully ingests drill telemetry payload', async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn((table) => {
        if (table === 'machines') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                    name: 'DR-101',
                    department_id: 'dept-1',
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'machine_telemetry') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const req = new Request('http://localhost:3000/api/telemetry/drilling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: '123e4567-e89b-12d3-a456-426614174000',
        engine_rpm: 1800,
        bit_depth: 45.2,
        penetration_rate: 12.5,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.machine_id).toBe('123e4567-e89b-12d3-a456-426614174000');
    // Reverse-flow ingest (D2-a): FUXA pulls /api/scada/tags — no FUXA REST write.
    expect(global.fetch).not.toHaveBeenCalled();

    const redis = await getRedisClient();
    expect(redis.xAdd).toHaveBeenCalledWith(
      'drilling:telemetry:stream',
      '*',
      { data: expect.any(String) },
      {
        TRIM: {
          strategy: 'MAXLEN',
          strategyModifier: '~',
          threshold: 1000,
        },
      }
    );
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('falls back to pub/sub when the Redis client has no stream support', async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn((table) => {
        if (table === 'machines') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                    name: 'DR-101',
                    department_id: 'dept-1',
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'machine_telemetry') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    });

    const fallbackClient = {
      set: jest.fn().mockResolvedValue('OK'),
      publish: jest.fn().mockResolvedValue(1),
    };
    getRedisClient.mockResolvedValueOnce(fallbackClient);

    const req = new Request('http://localhost:3000/api/telemetry/drilling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: '123e4567-e89b-12d3-a456-426614174000',
        engine_rpm: 1800,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(fallbackClient.publish).toHaveBeenCalledWith(
      'drilling:telemetry:stream',
      expect.any(String)
    );
  });

  it('returns 429 when the per-machine rate limit is exceeded', async () => {
    checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 600,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      retryAfter: 12,
    });

    const req = new Request('http://localhost:3000/api/telemetry/drilling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_id: MACHINE_ID, engine_rpm: 1800 }),
    });

    const res = await POST(req);

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers.get('Retry-After')).toBe('12');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith(
      `machine:${MACHINE_ID}`,
      { windowMs: 60_000, maxRequests: 600 },
      '/api/telemetry/drilling'
    );
  });

  it('rejects unsigned writes when an ingest secret is configured', async () => {
    const originalSecret = process.env.TELEMETRY_INGEST_SECRET;
    process.env.TELEMETRY_INGEST_SECRET = 'drill-secret';

    try {
      const req = new Request('http://localhost:3000/api/telemetry/drilling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_id: MACHINE_ID, engine_rpm: 1800 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    } finally {
      if (originalSecret === undefined) {
        delete process.env.TELEMETRY_INGEST_SECRET;
      } else {
        process.env.TELEMETRY_INGEST_SECRET = originalSecret;
      }
    }
  });

  it('accepts a matching bearer token', async () => {
    const originalSecret = process.env.TELEMETRY_INGEST_SECRET;
    process.env.TELEMETRY_INGEST_SECRET = 'drill-secret';

    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    try {
      const req = new Request('http://localhost:3000/api/telemetry/drilling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer drill-secret',
        },
        body: JSON.stringify({ machine_id: MACHINE_ID, engine_rpm: 1800 }),
      });

      // 404 proves the request passed auth and reached the machine lookup.
      const res = await POST(req);
      expect(res.status).toBe(404);
    } finally {
      if (originalSecret === undefined) {
        delete process.env.TELEMETRY_INGEST_SECRET;
      } else {
        process.env.TELEMETRY_INGEST_SECRET = originalSecret;
      }
    }
  });
});
