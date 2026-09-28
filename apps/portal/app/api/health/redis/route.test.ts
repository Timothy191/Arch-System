/**
 * @jest-environment node
 */
import { GET } from './route';

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn(),
}));

describe('GET /api/health/redis', () => {
  it('returns a healthy redis health payload when Redis is reachable', async () => {
    const redis = require('@repo/redis').getRedisClient;
    redis.mockResolvedValue({ isOpen: true, ping: jest.fn().mockResolvedValue('PONG') });

    const req = new Request('http://localhost:3000/api/health/redis');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('healthy');
    expect(typeof json.latencyMs).toBe('number');
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
  });

  it('returns a degraded payload when Redis is unavailable', async () => {
    const redis = require('@repo/redis').getRedisClient;
    redis.mockRejectedValue(new Error('Redis down'));

    const req = new Request('http://localhost:3000/api/health/redis');
    const res = await GET(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe('degraded');
  });
});
