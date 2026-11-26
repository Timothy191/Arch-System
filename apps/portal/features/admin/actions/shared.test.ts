/**
 * @jest-environment node
 */

import { assertAdmin, logAdminAuditEvent } from './shared';

const mockCheck = jest.fn();

jest.mock('@repo/rate-limiter', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    check: (...args: unknown[]) => mockCheck(...args),
  })),
  RedisStore: jest.fn().mockImplementation(() => ({ kind: 'redis' })),
  MemoryStore: jest.fn().mockImplementation(() => ({ kind: 'memory' })),
  FixedWindowStrategy: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { RedisStore } = jest.requireMock('@repo/rate-limiter') as { RedisStore: jest.Mock };
const { getRedisClient } = jest.requireMock('@repo/redis') as { getRedisClient: jest.Mock };
const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server') as {
  createServerSupabaseClient: jest.Mock;
};
const { createServiceRoleClient } = jest.requireMock('@repo/supabase/service-role') as {
  createServiceRoleClient: jest.Mock;
};
const { logger } = jest.requireMock('@repo/logger/server') as {
  logger: { info: jest.Mock; warn: jest.Mock };
};

function buildAdminSupabaseMock(options: {
  user: { id: string } | null;
  employee: { id: string; role: string } | null;
}) {
  const single = jest.fn().mockResolvedValue({ data: options.employee });
  const is = jest.fn().mockReturnValue({ single });
  const eq = jest.fn().mockReturnValue({ is, single });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  const supabase = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: options.user } }) },
    from,
  };
  createServerSupabaseClient.mockResolvedValue(supabase);
  return { supabase, is };
}

describe('Admin shared guards & audit persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheck.mockResolvedValue({ allowed: true });
  });

  it('enforces deleted_at IS NULL on employees and uses RedisStore when Redis is available', async () => {
    const fakeRedis = { isOpen: true };
    getRedisClient.mockResolvedValue(fakeRedis);
    const { is } = buildAdminSupabaseMock({
      user: { id: '11111111-1111-4111-8111-111111111111' },
      employee: { id: '22222222-2222-4222-8222-222222222222', role: 'admin' },
    });

    const result = await assertAdmin();

    expect('userId' in result && result.userId).toBe('11111111-1111-4111-8111-111111111111');
    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(RedisStore).toHaveBeenCalledWith(fakeRedis);
    expect(mockCheck).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('falls back to MemoryStore when Redis client is unavailable and returns 429 on limit', async () => {
    getRedisClient.mockRejectedValue(new Error('Redis offline'));
    mockCheck.mockResolvedValue({ allowed: false });
    buildAdminSupabaseMock({
      user: { id: 'admin-1' },
      employee: { id: 'emp-1', role: 'admin' },
    });

    const result = await assertAdmin();

    expect(result).toEqual({ error: 'Rate limit exceeded', status: 429 });
    expect(RedisStore).not.toHaveBeenCalled();
  });

  it('rejects soft-deleted admin employees (null row after deleted_at IS NULL)', async () => {
    getRedisClient.mockResolvedValue(null);
    const { is } = buildAdminSupabaseMock({
      user: { id: 'soft-deleted-admin' },
      employee: null,
    });

    const result = await assertAdmin();

    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(result).toEqual({ error: 'Forbidden: admin role required', status: 403 });
  });

  it('persists normalized audit_logs rows best-effort without breaking on DB errors', async () => {
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: '22222222-2222-4222-8222-222222222222' } });
    createServiceRoleClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({ maybeSingle }),
              }),
            }),
          };
        }
        return { insert: auditInsert };
      }),
    });

    logAdminAuditEvent({
      actorId: '11111111-1111-4111-8111-111111111111',
      action: 'archive',
      resource: 'departments',
      resourceId: '33333333-3333-4333-8333-333333333333',
      metadata: { slug: 'geology' },
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin_mutation',
        action: 'archive',
        resource: 'departments',
      })
    );
    expect(auditInsert).toHaveBeenCalledWith({
      action: 'update',
      table_name: 'departments',
      record_id: '33333333-3333-4333-8333-333333333333',
      old_data: null,
      new_data: expect.objectContaining({
        event_action: 'archive',
        slug: 'geology',
      }),
      performed_by: '22222222-2222-4222-8222-222222222222',
    });

    auditInsert.mockResolvedValueOnce({ error: { message: 'db down' } });
    expect(() =>
      logAdminAuditEvent({
        actorId: '11111111-1111-4111-8111-111111111111',
        action: 'create',
        resource: 'departments',
      })
    ).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(logger.warn).toHaveBeenCalled();
  });
});
