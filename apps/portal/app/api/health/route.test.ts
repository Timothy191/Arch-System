/**
 * @jest-environment node
 */
import { GET } from './route';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn(),
  isServerlessRedis: jest.fn(() => false),
}));

const { createServerSupabaseClient } = require('@repo/supabase/server');
const { getRedisClient, isServerlessRedis } = require('@repo/redis');

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FUXA_URL = 'https://fuxa.example.com';
    isServerlessRedis.mockReturnValue(false);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as any;
  });

  afterEach(() => {
    delete process.env.FUXA_URL;
  });

  it('returns healthy status response when all services respond cleanly', async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 'm-1' }], error: null }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(createServerSupabaseClient).toHaveBeenCalledWith({ healthProbe: true });
    expect(res.headers.get('Server-Timing')).toMatch(
      /supabase;dur=\d+, redis;dur=\d+, fuxa;dur=\d+, total;dur=\d+/
    );
    const json = await res.json();
    expect(['healthy', 'degraded']).toContain(json.status);
    expect(json.services.supabase.status).toBe('healthy');
    expect(json.services.redis.status).toBe('healthy');
    expect(json.services.redis.mode).toBe('tcp');
    expect(json.services.fuxa.status).toBe('healthy');
    expect(typeof json.latencyMs).toBe('number');
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
  });

  it('reports fuxa as degraded when FUXA_URL is not configured', async () => {
    delete process.env.FUXA_URL;
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 'm-1' }], error: null }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('healthy');
    expect(json.services.fuxa.status).toBe('degraded');
    expect(json.services.fuxa.error).toBe('FUXA_URL is not configured');
  });

  it('reports serverless-rest mode when Redis transport uses REST adapter', async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 'm-1' }], error: null }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });
    isServerlessRedis.mockReturnValue(true);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(createServerSupabaseClient).toHaveBeenCalledWith({ healthProbe: true });
    const json = await res.json();
    expect(json.services.redis.status).toBe('healthy');
    expect(json.services.redis.mode).toBe('serverless-rest');
  });

  it('runs Supabase and Redis probes concurrently while recording individual durations', async () => {
    const events: string[] = [];
    let releaseSupabase!: () => void;
    const supabaseGate = new Promise<void>((resolve) => {
      releaseSupabase = resolve;
    });

    createServerSupabaseClient.mockImplementation(async () => {
      events.push('supabase:start');
      await supabaseGate;
      events.push('supabase:end');
      return {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [{ id: 'm-1' }], error: null }),
      };
    });

    getRedisClient.mockImplementation(async () => {
      events.push('redis:start');
      releaseSupabase();
      return {
        isOpen: true,
        ping: jest.fn().mockResolvedValue('PONG'),
      };
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(events[0]).toBe('supabase:start');
    expect(events[1]).toBe('redis:start');
    expect(res.headers.get('Server-Timing')).toMatch(
      /supabase;dur=\d+, redis;dur=\d+, fuxa;dur=\d+, total;dur=\d+/
    );
  });

  it('returns unhealthy status when database throws critical exception', async () => {
    createServerSupabaseClient.mockRejectedValue(new Error('Fatal DB Connection Error'));

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe('unhealthy');
    expect(json.services.supabase.status).toBe('unhealthy');
  });

  it('treats PostgreSQL 42501 anon permission lockdown as healthy database reachability', async () => {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for table machines' },
      }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Server-Timing')).toMatch(
      /supabase;dur=\d+, redis;dur=\d+, fuxa;dur=\d+, total;dur=\d+/
    );
    const json = await res.json();
    expect(json.status).toBe('healthy');
    expect(json.services.supabase.status).toBe('healthy');
    expect(json.services.supabase.error).toBeUndefined();
  });

  it('probes FUXA_URL independently when configured and marks fuxa degraded on non-200 response', async () => {
    const prevFuxaUrl = process.env.FUXA_URL;
    process.env.FUXA_URL = 'http://fuxa.internal:1881';

    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 'm-1' }], error: null }),
    });

    getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as any;

    try {
      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('degraded');
      expect(json.services.redis.status).toBe('healthy');
      expect(json.services.fuxa.status).toBe('degraded');
      expect(json.services.fuxa.error).toContain('503');
    } finally {
      if (prevFuxaUrl === undefined) {
        delete process.env.FUXA_URL;
      } else {
        process.env.FUXA_URL = prevFuxaUrl;
      }
    }
  });
});
