/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST } from './route';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');

process.env.INTEGRATION_ENCRYPTION_KEY = 'test-integration-key-32-chars-min!';

function buildMock(
  overrides: {
    user?: unknown;
    employee?: unknown;
    webhooks?: unknown;
    insertData?: unknown;
    dbError?: unknown;
  } = {}
) {
  const user = overrides.user !== undefined ? overrides.user : { id: 'user-1' };
  const employee =
    overrides.employee !== undefined
      ? overrides.employee
      : {
          department_id: '11111111-1111-4111-a111-111111111111',
          role: 'supervisor',
          accessible_departments: [],
        };

  const mock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'employees') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: employee }),
            }),
          }),
        };
      }
      const queryResult = Promise.resolve({
        data: overrides.webhooks ?? [],
        error: overrides.dbError ?? null,
      });
      const isChain = Object.assign(queryResult, {
        eq: jest.fn().mockResolvedValue({
          data: overrides.webhooks ?? [],
          error: overrides.dbError ?? null,
        }),
        in: jest.fn().mockResolvedValue({
          data: overrides.webhooks ?? [],
          error: overrides.dbError ?? null,
        }),
        or: jest.fn().mockResolvedValue({
          data: overrides.webhooks ?? [],
          error: overrides.dbError ?? null,
        }),
      });
      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue(isChain),
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: overrides.insertData ?? {
                id: 'wh-1',
                url: 'https://example.com',
              },
              error: overrides.dbError ?? null,
            }),
          }),
        }),
      };
    }),
  };
  createServerSupabaseClient.mockResolvedValue(mock);
  return mock;
}

// ---------------------------------------------------------------------------
// GET /api/webhooks
// ---------------------------------------------------------------------------

describe('GET /api/webhooks', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockReq = new NextRequest('http://localhost/api/webhooks');

  it('returns 401 when not authenticated', async () => {
    buildMock({ user: null });
    const res = await GET(mockReq);
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toBe('Unauthorized');
  });

  it('returns 404 when employee not found', async () => {
    buildMock({ employee: null });
    const res = await GET(mockReq);
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe('Employee not found');
  });

  it('returns 200 with webhooks for non-admin (with .or filter)', async () => {
    const webhookList = [{ id: 'w1', url: 'https://example.com' }];
    buildMock({
      employee: {
        department_id: 'dept-1',
        role: 'supervisor',
        accessible_departments: [],
      },
      webhooks: webhookList,
    });
    const res = await GET(mockReq);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.webhooks).toEqual([{ id: 'w1', url: 'https://example.com', has_secret: false }]);
  });

  it('returns 500 on db error', async () => {
    buildMock({
      employee: {
        department_id: 'dept-1',
        role: 'supervisor',
        accessible_departments: [],
      },
      webhooks: null,
      dbError: { message: 'DB failure' },
    });
    const res = await GET(mockReq);
    expect(res.status).toBe(500);
  });

  it('returns 200 for admin without department filter', async () => {
    // Admin path: buildMock with role=admin — the mock's .is() resolves directly (no .or())
    const webhookList = [{ id: 'w2', url: 'https://admin.com' }];

    // Override to make the is() call resolve directly for admin
    const adminEmployee = {
      department_id: 'dept-1',
      role: 'admin',
      accessible_departments: [],
    };
    const mock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: adminEmployee }),
              }),
            }),
          };
        }
        // Admin skips .or(), so the chain is .select().is()
        const isResult = Promise.resolve({ data: webhookList, error: null });
        return {
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue(
              Object.assign(isResult, {
                or: jest.fn().mockResolvedValue({ data: webhookList, error: null }),
              })
            ),
          }),
        };
      }),
    };
    createServerSupabaseClient.mockResolvedValue(mock);
    const res = await GET(mockReq);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks
// ---------------------------------------------------------------------------

describe('POST /api/webhooks', () => {
  beforeEach(() => jest.clearAllMocks());

  const DEFAULT_DEPT = '11111111-1111-4111-a111-111111111111';

  function makeRequest(body: unknown) {
    const defaultBody = {
      department_id: DEFAULT_DEPT,
    };
    const finalBody =
      body && typeof body === 'object' && !Array.isArray(body) ? { ...defaultBody, ...body } : body;
    return new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(finalBody),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('returns 401 when not authenticated', async () => {
    buildMock({ user: null });
    const req = makeRequest({
      url: 'https://example.com',
      event_types: ['daily_log.created'],
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when url is missing', async () => {
    buildMock();
    const req = makeRequest({ event_types: ['daily_log.created'] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('invalid input');
  });

  it('returns 400 when event_types is empty', async () => {
    buildMock();
    const req = makeRequest({ url: 'https://example.com', event_types: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when employee not found', async () => {
    buildMock({ employee: null });
    const req = makeRequest({
      url: 'https://example.com',
      event_types: ['breakdown.created'],
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when non-admin tries to create webhook for different department', async () => {
    buildMock({
      employee: {
        department_id: '11111111-1111-4111-a111-111111111111',
        role: 'supervisor',
        accessible_departments: [],
      },
    });
    const req = makeRequest({
      url: 'https://example.com',
      event_types: ['daily_log.created'],
      department_id: '22222222-2222-4222-a222-222222222222',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 201 on successful creation', async () => {
    buildMock({
      employee: {
        department_id: '11111111-1111-4111-a111-111111111111',
        role: 'supervisor',
        accessible_departments: [],
      },
      insertData: {
        id: 'wh-new',
        url: 'https://example.com',
        event_types: ['breakdown.created'],
      },
    });
    const req = makeRequest({
      url: 'https://example.com',
      event_types: ['breakdown.created'],
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.webhook).toBeDefined();
  });

  it('rejects SSRF URLs targeting loopback, private, or .internal hosts with 400', async () => {
    buildMock();
    const req = makeRequest({
      url: 'http://127.0.0.1:8080/webhook',
      event_types: ['breakdown.created'],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('disallowed host');
  });

  it('persists optional secret and active fields on creation', async () => {
    const mock = buildMock();
    const req = makeRequest({
      url: 'https://hooks.plantcor.example/events',
      event_types: ['breakdown.created'],
      secret: 'hmac-secret-at-least-16-chars',
      active: false,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const webhookTableCalls = mock.from.mock.results
      .map((r, idx) => ({ table: mock.from.mock.calls[idx]?.[0], value: r.value }))
      .find((entry) => entry.table === 'webhook_endpoints');
    expect(webhookTableCalls?.value.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://hooks.plantcor.example/events',
        secret: expect.stringMatching(/^enc:v1:/),
        active: false,
      })
    );
  });

  it('returns 500 when insert fails', async () => {
    const employee = {
      department_id: '11111111-1111-4111-a111-111111111111',
      role: 'supervisor',
      accessible_departments: [],
    };
    const insertError = { message: 'Insert failed' };

    // Custom mock where insert returns an error
    const mock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: employee }),
              }),
            }),
          };
        }
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: insertError }),
            }),
          }),
        };
      }),
    };
    createServerSupabaseClient.mockResolvedValue(mock);

    const req = makeRequest({
      url: 'https://example.com',
      event_types: ['breakdown.created'],
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe('Failed to create webhook');
  });
});
