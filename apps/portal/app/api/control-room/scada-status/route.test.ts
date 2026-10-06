/**
 * @jest-environment node
 */

import { getRedisClient } from '@repo/redis';
import { GET } from './route';

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    scan: jest
      .fn()
      .mockResolvedValue({ cursor: 0, keys: ['telemetry:last:tag1', 'telemetry:last:tag2'] }),
    get: jest.fn().mockResolvedValue(null),
  }),
}));
jest.mock('@/lib/errors/error-logger', () => ({ logError: jest.fn() }));

describe('GET /api/control-room/scada-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns degraded status when FUXA SCADA is unreachable but Redis is connected', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const req = new Request('http://localhost:3000/api/control-room/scada-status');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('degraded');
    expect(json.fuxa_healthy).toBe(false);
    expect(json.redis_connected).toBe(true);
    expect(json.cached_tag_count).toBe(2);
  });

  it('returns healthy status when FUXA SCADA responds ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const req = new Request('http://localhost:3000/api/control-room/scada-status');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('healthy');
    expect(json.fuxa_healthy).toBe(true);
    expect(json.redis_connected).toBe(true);
  });

  it('counts cached tags across Redis scan pages without retaining key names', async () => {
    const scan = jest
      .fn()
      .mockResolvedValueOnce({ cursor: 42, keys: ['telemetry:last:tag1'] })
      .mockResolvedValueOnce({
        cursor: 0,
        keys: ['telemetry:last:tag2', 'telemetry:last:tag3'],
      });
    jest.mocked(getRedisClient).mockResolvedValue({
      scan,
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    } as never);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const response = await GET(new Request('http://localhost:3000/api/control-room/scada-status'));
    const body = await response.json();

    expect(body.cached_tag_count).toBe(3);
    expect(scan).toHaveBeenNthCalledWith(1, 0, {
      MATCH: 'telemetry:last:*',
      COUNT: 100,
    });
    expect(scan).toHaveBeenNthCalledWith(2, 42, {
      MATCH: 'telemetry:last:*',
      COUNT: 100,
    });
  });

  it('reports degraded status when FUXA is healthy but Redis cache reads fail', async () => {
    jest.mocked(getRedisClient).mockResolvedValue({
      scan: jest.fn().mockRejectedValue(new Error('Redis scan failed')),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    } as never);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const response = await GET(new Request('http://localhost:3000/api/control-room/scada-status'));
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.fuxa_healthy).toBe(true);
    expect(body.redis_connected).toBe(false);
    expect(body.reasons).toContain('Redis telemetry cache read failed');
  });

  it('returns offline status when FUXA and Redis are both unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('FUXA unreachable'));

    const { getRedisClient } = require('@repo/redis');
    getRedisClient.mockRejectedValueOnce(new Error('Redis unreachable'));

    const req = new Request('http://localhost:3000/api/control-room/scada-status');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('offline');
    expect(json.fuxa_healthy).toBe(false);
    expect(json.redis_connected).toBe(false);
  });
});
