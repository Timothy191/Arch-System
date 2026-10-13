/** @jest-environment node */
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextRequest } from 'next/server';

jest.mock('next/server', () => {
  return {
    NextRequest: Request,
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        status: init?.status || 200,
        json: async () => body,
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

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

const mockSupabase = {
  rpc: jest.fn(),
};

describe('POST /api/control-room/shift-closeout/approve', () => {
  const reportId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';

  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  it('rejects unauthenticated requests', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValue(null as never);
    const req = new Request('http://localhost/api/control-room/shift-closeout/approve', {
      method: 'POST',
      body: JSON.stringify({ reportId }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects operators attempting to approve reports', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValue({
      user: { id: 'u1' },
      employee: { id: 'e1', role: 'operator' },
    } as never);

    const req = new Request('http://localhost/api/control-room/shift-closeout/approve', {
      method: 'POST',
      body: JSON.stringify({ reportId }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects self-approval under MHSA separation of duties', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValue({
      user: { id: 'u2' },
      employee: { id: 'e2', role: 'supervisor' },
    } as never);

    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Separation of duties violation: Approver cannot approve their own shift closeout',
      },
    });

    const req = new Request('http://localhost/api/control-room/shift-closeout/approve', {
      method: 'POST',
      body: JSON.stringify({ reportId }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SEPARATION_OF_DUTIES_VIOLATION');
  });

  it('approves report successfully when supervisor is distinct from submitter', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValue({
      user: { id: 'u3' },
      employee: { id: 'e3', role: 'supervisor' },
    } as never);

    mockSupabase.rpc.mockResolvedValue({
      data: { status: 'approved', id: reportId, approver_id: 'e3' },
      error: null,
    });

    const req = new Request('http://localhost/api/control-room/shift-closeout/approve', {
      method: 'POST',
      body: JSON.stringify({ reportId, approvalNote: 'All checks verified in pit.' }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.status).toBe('approved');
  });
});
