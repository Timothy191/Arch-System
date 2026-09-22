/** @jest-environment node */
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextRequest } from 'next/server';

jest.mock('next/server', () => {
  return {
    NextRequest: Request,
    NextResponse: {
      json: (body, init) => ({
        status: init?.status || 200,
        json: async () => body,
      }),
    },
  };
});

import { POST } from './route';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/observability/tracing', () => ({
  withAsyncSpan: jest.fn((_name, _attrs, fn) => fn()),
  setAttributes: jest.fn(),
  addEvent: jest.fn(),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn((e) => console.log(e)),
}));

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('POST /api/control-room/shift-closeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  const validPayload = {
    deptId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    date: '2026-08-17',
    shift: 'day',
    operatorName: 'John Doe',
    idempotencyKey: 'idem-key-12345678',
    checklistItems: [],
    systemUptimePercent: 100,
  };

  function makeRequest(body: any) {
    return new Request('http://localhost/api/control-room/shift-closeout', {
      method: 'POST',
      headers: {
        'Idempotency-Key': body.idempotencyKey || 'idem-key-12345678',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 if not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid payload', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    const req = makeRequest({ ...validPayload, shift: 'invalid' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 for viewers', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });

    mockSupabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { id: 'e1', role: 'viewer' } }) }),
      }),
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('short-circuits with already_closed if idempotency key hits', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });

    // employee fetch
    mockSupabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { id: 'e1', role: 'operator' } }) }),
      }),
    });

    mockSupabase.rpc.mockResolvedValueOnce({
      data: { id: 'report-already', status: 'already_closed' },
      error: null,
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ id: 'report-already', status: 'already_closed' });
  });

  it('inserts report and returns 200 on success', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });

    // employee fetch
    mockSupabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { id: 'e1', role: 'operator' } }) }),
      }),
    });

    mockSupabase.rpc.mockResolvedValueOnce({
      data: { id: 'report-new', status: 'closed' },
      error: null,
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ id: 'report-new', status: 'closed' });
  });
});
