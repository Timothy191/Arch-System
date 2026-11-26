/**
 * @jest-environment node
 */

import { logger } from '@repo/logger/server';
import { getRedisClient } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import type { NextRequest } from 'next/server';
import { DELETE, GET } from './route';

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
const mockLogger = jest.mocked(logger);

function makeRequest(options?: { params?: string; body?: unknown }): NextRequest {
  const params = options?.params ?? '';
  const url = `http://localhost:3000/api/admin/redis/inspect${params ? `?${params}` : ''}`;
  return {
    nextUrl: new URL(url),
    json: async () => options?.body ?? null,
  } as unknown as NextRequest;
}

describe('GET & DELETE /api/admin/redis/inspect', () => {
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

  it('scans keys, inspects string/hash/list/set/zset/stream values, and redacts sensitive keys', async () => {
    // 1. String JSON value
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-types' },
      employee: { id: 'emp-types', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['portal:config', 'session:tok-1'] }),
      type: jest.fn().mockResolvedValue('string'),
      ttl: jest.fn().mockResolvedValue(120),
      get: jest.fn().mockResolvedValue('{"mode":"live"}'),
    } as never);

    const stringRes = await GET(makeRequest({ params: 'pattern=portal:*&key=portal:config' }));
    const stringBody = await stringRes.json();
    expect(stringRes.status).toBe(200);
    expect(stringBody.inspected).toEqual({
      key: 'portal:config',
      type: 'string',
      ttlSeconds: 120,
      value: { mode: 'live' },
    });

    // 2. Hash value
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-types' },
      employee: { id: 'emp-types', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['dept:production:meta'] }),
      type: jest.fn().mockResolvedValue('hash'),
      ttl: jest.fn().mockResolvedValue(300),
      hGetAll: jest.fn().mockResolvedValue({ shift: 'day', activeRigs: '4' }),
    } as never);

    const hashRes = await GET(makeRequest({ params: 'key=dept:production:meta' }));
    const hashBody = await hashRes.json();
    expect(hashBody.inspected).toEqual({
      key: 'dept:production:meta',
      type: 'hash',
      ttlSeconds: 300,
      value: { shift: 'day', activeRigs: '4' },
    });

    // 3. List, Set, ZSet, Stream via sendCommand / typed methods
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-types' },
      employee: { id: 'emp-types', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['queue:jobs'] }),
      type: jest.fn().mockResolvedValue('list'),
      ttl: jest.fn().mockResolvedValue(-1),
      lRange: jest.fn().mockResolvedValue(['job-1', 'job-2']),
    } as never);
    const listBody = await (await GET(makeRequest({ params: 'key=queue:jobs' }))).json();
    expect(listBody.inspected.value).toEqual(['job-1', 'job-2']);

    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-types' },
      employee: { id: 'emp-types', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['arch:__tags__:hub'] }),
      type: jest.fn().mockResolvedValue('set'),
      ttl: jest.fn().mockResolvedValue(-1),
      sMembers: jest.fn().mockResolvedValue(['cache:hub:k1', 'cache:hub:k2']),
    } as never);
    const setBody = await (await GET(makeRequest({ params: 'key=arch:__tags__:hub' }))).json();
    expect(setBody.inspected.value).toEqual(['cache:hub:k1', 'cache:hub:k2']);

    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-types' },
      employee: { id: 'emp-types', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['leaderboard:yield'] }),
      type: jest.fn().mockResolvedValue('zset'),
      ttl: jest.fn().mockResolvedValue(600),
      sendCommand: jest.fn().mockResolvedValue(['pit-a', '94.5', 'pit-b', '89.2']),
    } as never);
    const zsetBody = await (await GET(makeRequest({ params: 'key=leaderboard:yield' }))).json();
    expect(zsetBody.inspected.value).toEqual([
      { member: 'pit-a', score: 94.5 },
      { member: 'pit-b', score: 89.2 },
    ]);

    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-types' },
      employee: { id: 'emp-types', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['stream:scada'] }),
      type: jest.fn().mockResolvedValue('stream'),
      ttl: jest.fn().mockResolvedValue(-1),
      sendCommand: jest.fn().mockResolvedValue([['1700000000-0', ['rig', 'DR-01', 'rpm', '118']]]),
    } as never);
    const streamBody = await (await GET(makeRequest({ params: 'key=stream:scada' }))).json();
    expect(streamBody.inspected.value).toEqual([
      { id: '1700000000-0', fields: { rig: 'DR-01', rpm: '118' } },
    ]);

    // 4. Sensitive key redaction
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-types' },
      employee: { id: 'emp-types', role: 'admin' },
    } as never);
    const getSpy = jest.fn().mockResolvedValue('secret-session-blob');
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      scan: jest.fn().mockResolvedValue({ keys: ['session:tok-1'] }),
      type: jest.fn().mockResolvedValue('string'),
      ttl: jest.fn().mockResolvedValue(60),
      get: getSpy,
    } as never);

    const sensitiveRes = await GET(makeRequest({ params: 'key=session:tok-1' }));
    const sensitiveBody = await sensitiveRes.json();
    expect(sensitiveRes.status).toBe(200);
    expect(sensitiveBody.inspected.value).toBe('[REDACTED — sensitive key]');
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('deletes non-protected keys with audit log and blocks protected/sensitive keys on DELETE', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-del' },
      employee: { id: 'emp-del', role: 'admin' },
    } as never);
    const blockedRes = await DELETE(makeRequest({ params: 'key=session:user-123' }));
    expect(blockedRes.status).toBe(403);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin_redis_protected_key_delete_blocked',
        key: 'session:user-123',
      })
    );

    const delMock = jest.fn().mockResolvedValue(1);
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'u-admin-del' },
      employee: { id: 'emp-del', role: 'admin' },
    } as never);
    mockGetRedisClient.mockResolvedValueOnce({
      isOpen: true,
      del: delMock,
    } as never);

    const deleteRes = await DELETE(makeRequest({ params: 'key=cache:shift_001' }));
    const deleteBody = await deleteRes.json();
    expect(deleteRes.status).toBe(200);
    expect(delMock).toHaveBeenCalledWith('cache:shift_001');
    expect(deleteBody).toEqual({
      success: true,
      key: 'cache:shift_001',
      deleted: true,
      deletedCount: 1,
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin_redis_key_deleted',
        actorId: 'u-admin-del',
        key: 'cache:shift_001',
        deletedCount: 1,
      })
    );
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
