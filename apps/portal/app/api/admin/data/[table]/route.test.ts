/**
 * @jest-environment node
 */

import { FixedWindowStrategy, RateLimiter, RedisStore } from '@repo/rate-limiter';
import { NextRequest, type NextResponse } from 'next/server';
import { DELETE, GET, POST, PUT } from './route';

jest.mock('@/lib/api/rate-limit-middleware', () => ({
  withRateLimit: jest.fn((_req: Request, handler: () => Promise<NextResponse>) => handler()),
}));

jest.mock('@/lib/server-cache', () => ({
  tagTable: jest.fn((tableName: string) => `table:${tableName}`),
  updateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@repo/logger', () => ({
  serverLogger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('@repo/rate-limiter', () => ({
  RateLimiter: jest.fn(),
  RedisStore: jest.fn(),
  FixedWindowStrategy: jest.fn(),
}));

const { withRateLimit } = require('@/lib/api/rate-limit-middleware');
const { updateTags } = require('@/lib/server-cache');
const { serverLogger } = require('@repo/logger');
const { createServerSupabaseClient } = require('@repo/supabase/server');
const { createServiceRoleClient } = require('@repo/supabase/service-role');
const { getRedisClient } = require('@repo/redis');

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function mockAuth(user: { id: string } | null, employee: { id: string; role: string } | null) {
  const authChain = {
    getUser: jest.fn().mockResolvedValue({ data: { user } }),
  };

  const employeeChain = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: employee }),
        }),
      }),
    }),
  };

  createServerSupabaseClient.mockResolvedValue({
    auth: authChain,
    ...employeeChain,
  });

  return { authChain, employeeChain };
}

function mockServiceRole(overrides?: {
  from?: jest.Mock;
  select?: jest.Mock;
  eq?: jest.Mock;
  is?: jest.Mock;
  single?: jest.Mock;
  maybeSingle?: jest.Mock;
  order?: jest.Mock;
  range?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
  insert?: jest.Mock;
}) {
  const updateChain = {
    eq: jest.fn().mockResolvedValue({ data: [{ id: '1' }], count: 1, error: null }),
  };

  const deleteChain = {
    eq: jest.fn().mockResolvedValue({ data: [{ id: '1' }], count: 1, error: null }),
  };

  const insertChain = {
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: { id: 'new-1' }, error: null }),
    }),
    error: null,
  };

  const query: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [{ id: '1' }], count: 1, error: null }),
    update: jest.fn().mockReturnValue(updateChain),
    delete: jest.fn().mockReturnValue(deleteChain),
    insert: jest.fn().mockReturnValue(insertChain),
    ...overrides,
  };

  const from = jest.fn().mockReturnValue(query);
  createServiceRoleClient.mockReturnValue({ from });

  return { from, query, updateChain, deleteChain, insertChain };
}

describe('GET /api/admin/data/[table]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withRateLimit as jest.Mock).mockImplementation((_req, handler) => handler());
  });

  it('returns 401 when user is missing', async () => {
    mockAuth(null, null);

    const req = buildRequest('http://localhost:3000/api/admin/data/machines');
    const res = await GET(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when employee role is not admin', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'operator' });

    const req = buildRequest('http://localhost:3000/api/admin/data/machines');
    const res = await GET(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
  });

  it('returns 404 for unknown table', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });

    const req = buildRequest('http://localhost:3000/api/admin/data/secret_table');
    const res = await GET(req, { params: Promise.resolve({ table: 'secret_table' }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toBe('Unknown table');
  });

  it('rejects invalid order_by identifiers with 400', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    mockServiceRole();

    const req = buildRequest(
      'http://localhost:3000/api/admin/data/machines?order_by=created_at;DROP'
    );
    const res = await GET(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('applies deleted_at IS NULL on soft-delete tables and skips on non-soft-delete tables', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    const softDeleteService = mockServiceRole();

    const softReq = buildRequest(
      'http://localhost:3000/api/admin/data/machines?limit=10&offset=20&order_by=created_at&order_dir=asc'
    );
    const softRes = await GET(softReq, { params: Promise.resolve({ table: 'Machines' }) });

    expect(softRes.status).toBe(200);
    expect(softDeleteService.query.is).toHaveBeenCalledWith('deleted_at', null);
    const json = await softRes.json();
    expect(json.data).toEqual([{ id: '1' }]);
    expect(json.count).toBe(1);
    expect(json.limit).toBe(10);
    expect(json.offset).toBe(20);

    const nonSoftService = mockServiceRole();
    const logReq = buildRequest('http://localhost:3000/api/admin/data/daily_logs');
    const logRes = await GET(logReq, { params: Promise.resolve({ table: 'daily_logs' }) });
    expect(logRes.status).toBe(200);
    expect(nonSoftService.query.is).not.toHaveBeenCalled();
  });

  it('returns 500 when database query fails', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    mockServiceRole({
      range: jest.fn().mockResolvedValue({ data: null, count: null, error: new Error('boom') }),
    });

    const req = buildRequest('http://localhost:3000/api/admin/data/machines');
    const res = await GET(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.message).toBe('Database query failed');
  });
});

describe('POST /api/admin/data/[table]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withRateLimit as jest.Mock).mockImplementation((_req, handler) => handler());
  });

  it('returns 400 when request body is invalid JSON', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });

    const req = buildRequest('http://localhost:3000/api/admin/data/sites', {
      method: 'POST',
      body: '{invalid-json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ table: 'sites' }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe('Invalid JSON body');
  });

  it('writes action: "insert" to audit_logs, logs audit failure safely, and calls updateTags', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    const auditInsert = jest.fn().mockResolvedValue({ error: { message: 'audit transient err' } });
    createServiceRoleClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'audit_logs') {
          return { insert: auditInsert };
        }
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'site-1' }, error: null }),
            }),
          }),
        };
      }),
    });

    const req = buildRequest('http://localhost:3000/api/admin/data/sites', {
      method: 'POST',
      body: JSON.stringify({ name: 'North Pit', site_code: 'NP-01' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ table: 'sites' }) });

    expect(res.status).toBe(200);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'insert',
        table_name: 'sites',
        record_id: 'site-1',
        performed_by: 'emp-1',
      })
    );
    expect(serverLogger.error).toHaveBeenCalled();
    expect(updateTags).toHaveBeenCalledWith(['table:sites']);
  });
});

describe('PUT /api/admin/data/[table]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withRateLimit as jest.Mock).mockImplementation((_req, handler) => handler());
  });

  it('returns 401 when user is missing', async () => {
    mockAuth(null, null);

    const req = buildRequest('http://localhost:3000/api/admin/data/machines', {
      method: 'PUT',
      body: JSON.stringify({ id: '1', active: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(401);
  });

  it('returns 400 when JSON body is malformed', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });

    const req = buildRequest('http://localhost:3000/api/admin/data/machines', {
      method: 'PUT',
      body: 'not-valid-json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe('Invalid JSON body');
  });

  it('returns 400 when id is missing', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });

    const req = buildRequest('http://localhost:3000/api/admin/data/machines', {
      method: 'PUT',
      body: JSON.stringify({ active: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe('Missing record id');
  });

  it('returns 404 for unknown table', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });

    const req = buildRequest('http://localhost:3000/api/admin/data/unknown', {
      method: 'PUT',
      body: JSON.stringify({ id: '1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: 'unknown' }) });

    expect(res.status).toBe(404);
  });

  it('returns 404 when PUT matches 0 rows', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    mockServiceRole({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const req = buildRequest('http://localhost:3000/api/admin/data/sites', {
      method: 'PUT',
      body: JSON.stringify({ id: 'missing-id', active: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: 'sites' }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 when update fails', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    mockServiceRole({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: new Error('db') }),
      }),
    });

    const req = buildRequest('http://localhost:3000/api/admin/data/machines', {
      method: 'PUT',
      body: JSON.stringify({ id: '1', active: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.message).toBe('Update failed');
  });

  it('returns success, writes audit log, and invalidates tags on successful update', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    const service = mockServiceRole();

    const req = buildRequest('http://localhost:3000/api/admin/data/machines', {
      method: 'PUT',
      body: JSON.stringify({ id: '1', active: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(service.from).toHaveBeenCalledWith('audit_logs');
    expect(service.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        table_name: 'machines',
        record_id: '1',
        performed_by: 'emp-1',
      })
    );
    expect(updateTags).toHaveBeenCalledWith(['table:machines', 'table:fleet', 'table:equipment']);
  });

  it('returns 429 when machine status rate limiter rejects the request', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    mockServiceRole();

    (getRedisClient as jest.Mock).mockResolvedValue({ isOpen: true });
    const rateLimiter = {
      check: jest.fn().mockResolvedValue({ allowed: false, retryAfter: 42 }),
    };
    (RateLimiter as unknown as jest.Mock).mockImplementation(
      () => rateLimiter as unknown as RateLimiter
    );
    (RedisStore as unknown as jest.Mock).mockImplementation(() => ({}) as RedisStore);
    (FixedWindowStrategy as unknown as jest.Mock).mockImplementation(
      () => ({}) as FixedWindowStrategy
    );

    const req = buildRequest('http://localhost:3000/api/admin/data/machines', {
      method: 'PUT',
      body: JSON.stringify({ id: '1', active: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain('Too many status updates');
    expect(json.retryAfter).toBe(42);
  });
});

describe('DELETE /api/admin/data/[table]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withRateLimit as jest.Mock).mockImplementation((_req, handler) => handler());
  });

  it('returns 401 when user is missing', async () => {
    mockAuth(null, null);

    const req = buildRequest('http://localhost:3000/api/admin/data/machines?id=1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(401);
  });

  it('returns 400 when id query parameter is missing', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });

    const req = buildRequest('http://localhost:3000/api/admin/data/machines', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe('Missing id query parameter');
  });

  it('returns 404 for unknown table', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });

    const req = buildRequest('http://localhost:3000/api/admin/data/unknown?id=1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: 'unknown' }) });

    expect(res.status).toBe(404);
  });

  it('returns 404 when DELETE matches 0 rows', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    mockServiceRole({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const req = buildRequest('http://localhost:3000/api/admin/data/sites?id=missing-1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: 'sites' }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 when delete fails', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    mockServiceRole({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ count: 0, error: new Error('db') }),
      }),
    });

    const req = buildRequest('http://localhost:3000/api/admin/data/machines?id=1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.message).toBe('Delete failed');
  });

  it('returns success, writes audit log, and calls updateTags on successful delete', async () => {
    mockAuth({ id: 'user-1' }, { id: 'emp-1', role: 'admin' });
    const service = mockServiceRole();

    const req = buildRequest('http://localhost:3000/api/admin/data/machines?id=1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ table: 'machines' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(service.from).toHaveBeenCalledWith('audit_logs');
    expect(service.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        table_name: 'machines',
        record_id: '1',
        performed_by: 'emp-1',
      })
    );
    expect(updateTags).toHaveBeenCalledWith(['table:machines', 'table:fleet', 'table:equipment']);
  });
});
