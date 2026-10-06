/** @jest-environment node */
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextRequest } from 'next/server';

jest.mock('next/server', () => {
  return {
    NextRequest: Request,
    NextResponse: {
      json: (body, init) => ({
        status: init?.status || 200,
        json: async () => body,
        headers: new Headers(init?.headers),
      }),
    },
  };
});

import { POST } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/observability/tracing', () => ({
  withAsyncSpan: jest.fn((_name, _attrs, fn) => fn()),
  setAttributes: jest.fn(),
  addEvent: jest.fn(),
}));

jest.mock('@repo/utils/inngest', () => ({
  inngest: { send: jest.fn() },
  shiftCloseoutReportEvent: 'reports/shift-closeout',
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn((e) => console.log(e)),
}));

const mockSupabase = {
  rpc: jest.fn(),
};

describe('POST /api/control-room/shift-closeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase);
    jest.mocked(getAuthenticatedEmployee).mockResolvedValue({
      user: { id: 'u1' },
      employee: {
        id: 'e1',
        role: 'operator',
        department_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
      },
    } as never);
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

  function makeRequest(body: unknown, headerKey = 'idem-key-12345678') {
    return new Request('http://localhost/api/control-room/shift-closeout', {
      method: 'POST',
      headers: {
        'Idempotency-Key': headerKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 if not authenticated', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce(null);
    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid payload', async () => {
    const req = makeRequest({ ...validPayload, shift: 'invalid' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 for viewers', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'u1' },
      employee: { id: 'e1', role: 'viewer', department_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851' },
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects unrecognized roles instead of allowing every non-viewer to close shifts', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'u1' },
      employee: {
        id: 'e1',
        role: 'contractor',
        department_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
        accessible_departments: [],
      },
    } as never);

    const res = await POST(makeRequest(validPayload));

    expect(res.status).toBe(403);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects closeout requests for departments outside the employee access list', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'u1' },
      employee: {
        id: 'e1',
        role: 'operator',
        department_id: 'd290f1ee-6c54-4b01-90e6-d701748f0852',
        accessible_departments: [],
      },
    } as never);

    const res = await POST(makeRequest(validPayload));

    expect(res.status).toBe(403);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('requires the body idempotency key to match the request header', async () => {
    const res = await POST(makeRequest(validPayload, 'different-idempotency-key'));

    expect(res.status).toBe(400);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects oversized request bodies before JSON parsing', async () => {
    const request = new Request('http://localhost/api/control-room/shift-closeout', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem-key-12345678' },
      body: 'x'.repeat(1024 * 1024 + 1),
    });

    const res = await POST(request);

    expect(res.status).toBe(413);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('short-circuits with already_closed if idempotency key hits', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: {
        status: 'already_closed',
        response: { id: 'report-already', status: 'closed' },
      },
      error: null,
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ id: 'report-already', status: 'closed' });
  });

  it('inserts report and returns 200 on success', async () => {
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

  it('returns a retryable response for SMR failures and reuses mutation IDs on retry', async () => {
    const payload = {
      ...validPayload,
      allocations: [
        {
          machine_id: 'd290f1ee-6c54-4b01-90e6-d701748f0852',
          machine_name: 'Haul Truck 1',
          opening_smr: 100,
          closing_smr: 106,
        },
      ],
    };
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: { id: 'd290f1ee-6c54-4b01-90e6-d701748f0853', status: 'closed' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'temporary write failure' } })
      .mockResolvedValueOnce({
        data: {
          status: 'already_closed',
          response: { id: 'd290f1ee-6c54-4b01-90e6-d701748f0853', status: 'closed' },
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const firstResponse = await POST(makeRequest(payload));
    expect(firstResponse.status).toBe(503);
    expect(firstResponse.headers.get('Retry-After')).toBe('5');

    const firstMutationCall = mockSupabase.rpc.mock.calls[1]?.[1] as {
      p_mutations: Array<{ id: string }>;
    };
    const firstMutationId = firstMutationCall.p_mutations[0]?.id;

    const retryResponse = await POST(makeRequest(payload));
    expect(retryResponse.status).toBe(200);

    const retryMutationCall = mockSupabase.rpc.mock.calls[3]?.[1] as {
      p_mutations: Array<{ id: string }>;
    };
    expect(retryMutationCall.p_mutations[0]?.id).toBe(firstMutationId);
  });
});
