/**
 * @jest-environment node
 */

import { getRedisClient } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import type { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetAuthenticatedEmployee = jest.mocked(getAuthenticatedEmployee);
const mockGetRedisClient = jest.mocked(getRedisClient);

function makeRequest(params = ''): NextRequest {
  const url = `http://localhost:3000/api/admin/redis/inspect${params ? `?${params}` : ''}`;
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

describe('GET /api/admin/redis/inspect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-op' },
      employee: { id: 'emp-op', role: 'operator' },
    } as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 503 when Redis client is disconnected', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-1' },
      employee: { id: 'emp-1', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({ isOpen: false } as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });

  it('scans keys, inspects non-sensitive JSON values, and redacts sensitive keys', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-2' },
      employee: { id: 'emp-2', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['portal:config', 'session:tok-1'] }),
      type: jest.fn().mockResolvedValue('string'),
      ttl: jest.fn().mockResolvedValue(120),
      get: jest.fn().mockResolvedValue('{"mode":"live"}'),
    } as never);

    const res1 = await GET(makeRequest('pattern=portal:*&key=portal:config'));
    const body1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(body1.inspected).toEqual({
      key: 'portal:config',
      type: 'string',
      ttlSeconds: 120,
      value: { mode: 'live' },
    });

    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-2' },
      employee: { id: 'emp-2', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['session:tok-1'] }),
      type: jest.fn().mockResolvedValue('string'),
      ttl: jest.fn().mockResolvedValue(60),
      get: jest.fn().mockResolvedValue('secret-session-blob'),
    } as never);

    const res2 = await GET(makeRequest('key=session:tok-1'));
    const body2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(body2.inspected.value).toBe('[REDACTED — sensitive key]');
  });

  it('enforces per-actor 60 req/min rate limit returning 429', async () => {
    for (let i = 0; i < 60; i += 1) {
      mockGetAuthenticatedEmployee.mockResolvedValueOnce({
        user: { id: 'u-rate-test' },
        employee: { id: 'emp-rate', role: 'admin' },
      } as never);
      mockGetRedisClient.mockResolvedValueOnce({
        isOpen: true,
        scan: jest.fn().mockResolvedValue({ keys: [] }),
      } as never);
      const okRes = await GET(makeRequest());
      expect(okRes.status).toBe(200);
    }

    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-rate-test' },
      employee: { id: 'emp-rate', role: 'admin' },
    } as never);
    const limitedRes = await GET(makeRequest());
    expect(limitedRes.status).toBe(429);
  });
});
