/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from './route';

const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: jest.fn(() => ({
      update: mockUpdate,
    })),
  }),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');

function buildMock({
  employee = { id: 'emp-1', department_id: 'dept-1', role: 'admin', accessible_departments: [] },
  webhook = {
    id: 'wh-1',
    department_id: 'dept-1',
    url: 'https://example.com/hook',
    secret: 'secret',
    active: true,
  },
  logs = [],
}: {
  employee?: unknown;
  webhook?: unknown;
  logs?: unknown[];
} = {}) {
  const updateEq = mockUpdateEq;
  const update = mockUpdate;
  mockUpdateEq.mockClear();
  mockUpdate.mockClear();
  const insert = jest.fn().mockResolvedValue({ error: null });
  const mock = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'employees') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest
              .fn()
              .mockReturnValue({ single: jest.fn().mockResolvedValue({ data: employee }) }),
          }),
        };
      }
      if (table === 'webhook_endpoints') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest
                .fn()
                .mockReturnValue({ single: jest.fn().mockResolvedValue({ data: webhook }) }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest
                .fn()
                .mockReturnValue({ limit: jest.fn().mockResolvedValue({ data: logs }) }),
            }),
          }),
        }),
        update,
        insert,
      };
    }),
  };
  createServerSupabaseClient.mockResolvedValue(mock);
  return { mock, update, updateEq, insert };
}

const params = Promise.resolve({ id: '11111111-1111-4111-a111-111111111111' });

describe('POST /api/webhooks/[id]/retry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { mock } = buildMock({ employee: null });
    mock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const req = new NextRequest('http://localhost/api/webhooks/wh-1/retry', { method: 'POST' });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it('blocks SSRF against private/loopback webhook URLs with 400', async () => {
    buildMock({
      webhook: {
        id: 'wh-1',
        department_id: 'dept-1',
        url: 'http://192.168.1.50/hook',
        secret: null,
        active: true,
      },
    });
    const req = new NextRequest('http://localhost/api/webhooks/wh-1/retry', { method: 'POST' });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns a no-op result when there are no failed deliveries', async () => {
    buildMock({ logs: [] });
    const req = new NextRequest('http://localhost/api/webhooks/wh-1/retry', { method: 'POST' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, retried: 0 });
  });

  it('retries failed deliveries and updates the existing delivery log row in place', async () => {
    const log = {
      id: 'log-1',
      event_type: 'breakdown.created',
      payload: { id: 'bd-1' },
      retry_count: 0,
      success: false,
    };
    const { update, updateEq, insert } = buildMock({ logs: [log] });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('ok'),
    } as unknown as Response);

    const req = new NextRequest('http://localhost/api/webhooks/wh-1/retry', { method: 'POST' });
    const res = await POST(req, { params });
    const json = await res.json();

    expect(json).toMatchObject({ success: true, retried: 1, succeeded: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' })
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ retry_count: 1, success: true }));
    expect(updateEq).toHaveBeenCalledWith('id', 'log-1');
    expect(insert).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
