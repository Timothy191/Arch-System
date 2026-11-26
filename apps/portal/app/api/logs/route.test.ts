/**
 * @jest-environment node
 */
import { GET, PATCH, POST } from './route';

jest.mock('@/lib/api/rate-limit-middleware', () => ({
  withRateLimit: jest.fn((_req: unknown, handler: () => Promise<Response>) => handler()),
  getClientIp: jest.fn(() => '203.0.113.10'),
}));

jest.mock('@/lib/logging/system-logs', () => ({
  recordSystemLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { withRateLimit } = jest.requireMock('@/lib/api/rate-limit-middleware') as {
  withRateLimit: jest.Mock;
};
const { recordSystemLog } = jest.requireMock('@/lib/logging/system-logs') as {
  recordSystemLog: jest.Mock;
};
const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase') as {
  getAuthenticatedEmployee: jest.Mock;
};
const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server') as {
  createServerSupabaseClient: jest.Mock;
};

const ADMIN_PRINCIPAL = {
  user: { id: 'auth-1' },
  employee: { id: 'emp-1', role: 'admin', department_id: 'dept-1' },
};

function postRequest(body: unknown, extraHeaders: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/logs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function getRequest(query = ''): Request {
  return new Request(`http://localhost/api/logs${query}`, { method: 'GET' });
}

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/logs', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthenticatedEmployee.mockResolvedValue(null);
  });

  it('accepts a valid unauthenticated client error report', async () => {
    const res = await POST(
      postRequest({
        level: 'error',
        source: 'client',
        category: 'runtime',
        message: 'TypeError: boom',
        stack: 'at foo',
        url: '/drilling',
      }) as never
    );

    expect(res.status).toBe(201);
    expect(withRateLimit).toHaveBeenCalledTimes(1);
    expect(recordSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        source: 'client',
        message: 'TypeError: boom',
        employeeId: null,
        ipAddress: '203.0.113.10',
      })
    );
  });

  it('rejects oversized bodies via withBodyLimit with 413', async () => {
    const res = await POST(
      postRequest(
        { level: 'error', source: 'client', message: 'huge payload' },
        { 'content-length': '200000' }
      ) as never
    );

    expect(res.status).toBe(413);
    expect(recordSystemLog).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads with 400', async () => {
    const res = await POST(postRequest({ level: 'error', source: 'client' }) as never);

    expect(res.status).toBe(400);
    expect(recordSystemLog).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with 400', async () => {
    const req = new Request('http://localhost/api/logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
    expect(recordSystemLog).not.toHaveBeenCalled();
  });

  it('attaches employee identity when a session exists', async () => {
    getAuthenticatedEmployee.mockResolvedValue(ADMIN_PRINCIPAL);

    const res = await POST(
      postRequest({ level: 'warn', source: 'api', message: 'slow query' }) as never
    );

    expect(res.status).toBe(201);
    expect(recordSystemLog).toHaveBeenCalled();
  });

  it('accepts W3C 32-hex traceId and extracts traceparent/request-id headers', async () => {
    const req = new Request('http://localhost/api/logs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        traceparent: '00-68c830d6e21ff5b0747afc0a817e9c61-00f067aa0ba902b7-01',
        'x-vercel-id': 'cpt1::req-trace-check',
      },
      body: JSON.stringify({
        level: 'error',
        source: 'server',
        category: 'request',
        message: 'Correlated W3C trace test',
      }),
    });

    const res = await POST(req as never);

    expect(res.status).toBe(201);
    expect(recordSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: '68c830d6e21ff5b0747afc0a817e9c61',
        requestId: 'cpt1::req-trace-check',
      })
    );
  });
});

describe('GET /api/logs', () => {
  function mockSupabase(result: { data: unknown; count: number; error: unknown }) {
    const builder: Record<string, jest.Mock> = {};
    const chain = () => builder;
    for (const method of ['select', 'eq', 'or', 'order', 'range', 'update', 'in']) {
      builder[method] = jest.fn(chain);
    }
    builder.range = jest.fn(() => Promise.resolve(result));
    builder.in = jest.fn(() => Promise.resolve(result));
    createServerSupabaseClient.mockResolvedValue({ from: jest.fn(() => builder) });
    return builder;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps GET with rate limiting and returns 401 for unauthenticated users', async () => {
    getAuthenticatedEmployee.mockResolvedValue(null);
    const res = await GET(getRequest() as never);
    expect(withRateLimit).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-2' },
      employee: { id: 'emp-2', role: 'operator', department_id: 'dept-1' },
    });
    const res = await GET(getRequest() as never);
    expect(res.status).toBe(403);
  });

  it('returns paginated logs for admins and supports category filter', async () => {
    getAuthenticatedEmployee.mockResolvedValue(ADMIN_PRINCIPAL);
    const builder = mockSupabase({
      data: [{ id: 'log-1', message: 'boom', level: 'error', category: 'telemetry' }],
      count: 1,
      error: null,
    });

    const res = await GET(
      getRequest('?level=error&category=telemetry&page=1&pageSize=10') as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('category', 'telemetry');
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.totalCount).toBe(1);
  });

  it('sanitizes search filter via sanitizePostgrestFilterValue against PostgREST injection', async () => {
    getAuthenticatedEmployee.mockResolvedValue(ADMIN_PRINCIPAL);
    const builder = mockSupabase({
      data: [],
      count: 0,
      error: null,
    });

    const res = await GET(getRequest('?search=test,id.eq.1()%25*&page=1&pageSize=10') as never);

    expect(res.status).toBe(200);
    expect(builder.or).toHaveBeenCalledWith(
      'message.ilike.%testiddeq1%,category.ilike.%testiddeq1%,trace_id.ilike.%testiddeq1%,request_id.ilike.%testiddeq1%'.replace(
        /testiddeq1/g,
        'testideq1'
      )
    );
  });
});

describe('PATCH /api/logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps PATCH with rate limiting and returns 403 for non-admin users', async () => {
    getAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-2' },
      employee: { id: 'emp-2', role: 'operator' },
    });
    const res = await PATCH(patchRequest({ ids: ['x'], resolved: true }) as never);
    expect(withRateLimit).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(403);
  });

  it('marks entries resolved for admins', async () => {
    getAuthenticatedEmployee.mockResolvedValue(ADMIN_PRINCIPAL);
    const update = jest.fn(() => ({ in: jest.fn(() => Promise.resolve({ error: null })) }));
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn(() => ({ update })),
    });

    const res = await PATCH(
      patchRequest({ ids: ['11111111-1111-4111-8111-111111111111'], resolved: true }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: true, resolved_by: 'emp-1' })
    );
  });
});
