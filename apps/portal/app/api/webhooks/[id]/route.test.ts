/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { DELETE, GET, PUT } from './route';

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
    existingWebhook?: unknown;
    updatedWebhook?: unknown;
    updateError?: unknown;
  } = {}
) {
  const user = overrides.user !== undefined ? overrides.user : { id: 'user-1' };
  const employee =
    overrides.employee !== undefined
      ? overrides.employee
      : { department_id: 'dept-1', role: 'admin', accessible_departments: [] };
  const existingWebhook =
    overrides.existingWebhook !== undefined
      ? overrides.existingWebhook
      : { id: 'wh-1', url: 'https://example.com', department_id: 'dept-1' };
  const updatedWebhook = overrides.updatedWebhook ?? existingWebhook;

  const updateFn = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      is: jest.fn().mockReturnValue(
        Object.assign(Promise.resolve({ error: overrides.updateError ?? null }), {
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: overrides.updateError ? null : updatedWebhook,
              error: overrides.updateError ?? null,
            }),
          }),
        })
      ),
    }),
  });

  const selectIsFn = jest.fn().mockReturnValue({
    single: jest.fn().mockResolvedValue({ data: existingWebhook }),
  });

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
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: selectIsFn,
          }),
        }),
        update: updateFn,
      };
    }),
  };
  createServerSupabaseClient.mockResolvedValue(mock);
  return { mock, updateFn, selectIsFn };
}

function makePutRequest(body: unknown = {}) {
  return new NextRequest('http://localhost/api/webhooks/wh-1', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GET /api/webhooks/[id]', () => {
  beforeEach(() => jest.clearAllMocks());
  const params = Promise.resolve({ id: '11111111-1111-4111-a111-111111111111' });

  it('returns 200 and filters soft-deleted webhooks via .is(deleted_at, null)', async () => {
    const { selectIsFn } = buildMock();
    const res = await GET(new NextRequest('http://localhost/api/webhooks/wh-1'), { params });
    expect(res.status).toBe(200);
    expect(selectIsFn).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns 404 when webhook is soft-deleted or missing', async () => {
    buildMock({ existingWebhook: null });
    const res = await GET(new NextRequest('http://localhost/api/webhooks/wh-1'), { params });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/webhooks/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  const params = Promise.resolve({ id: '11111111-1111-4111-a111-111111111111' });

  it('returns 401 when not authenticated', async () => {
    buildMock({ user: null });
    const res = await PUT(makePutRequest({ url: 'https://new.com' }), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when employee not found', async () => {
    buildMock({ employee: null });
    const res = await PUT(makePutRequest({ url: 'https://new.com' }), { params });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe('Employee not found');
  });

  it('returns 404 when webhook not found', async () => {
    buildMock({ existingWebhook: null });
    const res = await PUT(makePutRequest({ url: 'https://new.com' }), { params });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe('Webhook not found');
  });

  it('returns 400 when updated URL targets disallowed SSRF host', async () => {
    buildMock();
    const res = await PUT(makePutRequest({ url: 'https://service.internal/hook' }), { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('disallowed host');
  });

  it('returns 403 when non-admin tries to update webhook from different dept', async () => {
    buildMock({
      employee: {
        department_id: 'dept-1',
        role: 'supervisor',
        accessible_departments: [],
      },
      existingWebhook: {
        id: 'wh-1',
        url: 'https://example.com',
        department_id: 'dept-OTHER',
      },
    });
    const res = await PUT(makePutRequest({ url: 'https://new.com' }), { params });
    expect(res.status).toBe(403);
  });

  it('persists url, secret, and active on successful update', async () => {
    const { updateFn } = buildMock({
      updatedWebhook: {
        id: 'wh-1',
        url: 'https://new.com',
        department_id: 'dept-1',
        active: false,
      },
    });

    const res = await PUT(
      makePutRequest({
        url: 'https://new.com',
        secret: 'rotated-hmac-secret-2026',
        active: false,
      }),
      { params }
    );
    expect(res.status).toBe(200);
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://new.com',
        secret: expect.stringMatching(/^enc:v1:/),
        active: false,
      })
    );
  });
});

describe('DELETE /api/webhooks/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  const params = Promise.resolve({ id: '11111111-1111-4111-a111-111111111111' });

  function makeDeleteRequest() {
    return new NextRequest('http://localhost/api/webhooks/wh-1', {
      method: 'DELETE',
    });
  }

  it('returns 401 when not authenticated', async () => {
    buildMock({ user: null });
    const res = await DELETE(makeDeleteRequest(), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when employee not found', async () => {
    buildMock({ employee: null });
    const res = await DELETE(makeDeleteRequest(), { params });
    expect(res.status).toBe(404);
  });

  it('returns 404 when webhook not found', async () => {
    buildMock({ existingWebhook: null });
    const res = await DELETE(makeDeleteRequest(), { params });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe('Webhook not found');
  });

  it('returns 403 when non-admin tries to delete webhook from different dept', async () => {
    buildMock({
      employee: {
        department_id: 'dept-1',
        role: 'supervisor',
        accessible_departments: [],
      },
      existingWebhook: {
        id: 'wh-1',
        url: 'https://example.com',
        department_id: 'dept-OTHER',
      },
    });
    const res = await DELETE(makeDeleteRequest(), { params });
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful soft delete', async () => {
    buildMock();
    const res = await DELETE(makeDeleteRequest(), { params });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 500 when soft delete fails', async () => {
    buildMock({ updateError: { message: 'Delete failed' } });
    const res = await DELETE(makeDeleteRequest(), { params });
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe('Failed to delete webhook');
  });
});
