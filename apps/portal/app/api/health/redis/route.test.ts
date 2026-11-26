/**
 * @jest-environment node
 */
import { GET } from './route';

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn(),
  isServerlessRedis: jest.fn(() => false),
  getCacheStats: jest.fn(async () => ({ hits: 10, misses: 2 })),
  detectCapabilities: jest.fn(async () => ({ redisVersion: '7.4.0', streams: true })),
  searchAvailability: jest.fn(async () => ({ available: true, reason: 'ok' })),
  vectorIndexStats: jest.fn(async (index: string) => ({ index, numDocs: 42 })),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

const redisMocks = jest.requireMock('@repo/redis') as {
  getRedisClient: jest.Mock;
  getCacheStats: jest.Mock;
  detectCapabilities: jest.Mock;
};
const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase') as {
  getAuthenticatedEmployee: jest.Mock;
};

describe('GET /api/health/redis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthenticatedEmployee.mockResolvedValue(null);
  });

  it('returns minimal { status, mode, timestamp } for unauthenticated probes without internal telemetry', async () => {
    redisMocks.getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const req = new Request('http://localhost:3000/api/health/redis');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(Object.keys(json).sort()).toEqual(['mode', 'status', 'timestamp']);
    expect(json.status).toBe('healthy');
    expect(json.mode).toBe('tcp');
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
    expect(json.vectorIndexes).toBeUndefined();
    expect(json.cacheStats).toBeUndefined();
    expect(json.capabilities).toBeUndefined();
    expect(redisMocks.getCacheStats).not.toHaveBeenCalled();
    expect(redisMocks.detectCapabilities).not.toHaveBeenCalled();
  });

  it('returns minimal payload for authenticated non-admin users', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'u-1' },
      employee: { id: 'emp-1', role: 'operator' },
    });
    redisMocks.getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const res = await GET(new Request('http://localhost:3000/api/health/redis'));
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual(['mode', 'status', 'timestamp']);
  });

  it('returns full cacheStats, capabilities, and vectorIndexes for authenticated admins', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'admin-1' },
      employee: { id: 'emp-admin', role: 'admin' },
    });
    redisMocks.getRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const res = await GET(new Request('http://localhost:3000/api/health/redis'));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.status).toBe('healthy');
    expect(json.engine).toBe('redis-7.4.0');
    expect(typeof json.latencyMs).toBe('number');
    expect(json.cacheStats).toEqual({ hits: 10, misses: 2 });
    expect(json.capabilities).toEqual({ redisVersion: '7.4.0', streams: true });
    expect(json.vectorIndexes).toHaveLength(2);
  });

  it('returns a degraded 503 minimal payload when Redis is unavailable', async () => {
    redisMocks.getRedisClient.mockRejectedValue(new Error('Redis down'));

    const req = new Request('http://localhost:3000/api/health/redis');
    const res = await GET(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toEqual({
      status: 'degraded',
      mode: 'tcp',
      timestamp: expect.any(String),
    });
  });
});
