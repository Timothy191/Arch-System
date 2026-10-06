/** @jest-environment node */

import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
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

const mockGetAuthenticatedEmployee = jest.mocked(getAuthenticatedEmployee);
const mockCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient);
const departmentId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
const validMutation = {
  id: 'd290f1ee-6c54-4b01-90e6-d701748f0852',
  hlc: { wall: 1_760_000_000_000, counter: 0, node: 'field-terminal-1' },
  entity: 'smr',
  entityId: 'machine-1',
  op: 'smr.update',
  payload: {
    meterId: 'machine-1',
    reading: 42.5,
    readingAt: '2026-10-05T12:00:00.000Z',
    deviceId: 'field-terminal-1',
  },
};

function makeRequest(body: unknown, headers?: HeadersInit): Request {
  return new Request('http://localhost/api/offline-mutations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/offline-mutations', () => {
  const rpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    mockCreateServerSupabaseClient.mockResolvedValue({ rpc } as never);
  });

  it('rejects unauthenticated requests before invoking the mutation RPC', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ clientHlc: validMutation.hlc, mutations: [validMutation] })
    );

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects employees without a primary department and viewers', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'user-1' },
      employee: {
        id: 'employee-1',
        role: 'operator',
        department_id: null,
        accessible_departments: [],
      },
    } as never);
    const missingDepartment = await POST(
      makeRequest({ clientHlc: validMutation.hlc, mutations: [validMutation] })
    );
    expect(missingDepartment.status).toBe(403);

    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      user: { id: 'user-1' },
      employee: {
        id: 'employee-1',
        role: 'viewer',
        department_id: departmentId,
        accessible_departments: [],
      },
    } as never);
    const viewer = await POST(
      makeRequest({ clientHlc: validMutation.hlc, mutations: [validMutation] })
    );

    expect(viewer.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('derives tenant scope from the authenticated employee and sends only validated mutations', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'user-1' },
      employee: {
        id: 'employee-1',
        role: 'operator',
        department_id: departmentId,
        accessible_departments: [],
      },
    } as never);

    const response = await POST(
      makeRequest({ clientHlc: validMutation.hlc, mutations: [validMutation] })
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('apply_offline_mutations', {
      p_tenant: departmentId,
      p_mutations: [validMutation],
    });
  });

  it('rejects malformed or oversized batches before the RPC', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'user-1' },
      employee: {
        id: 'employee-1',
        role: 'operator',
        department_id: departmentId,
        accessible_departments: [],
      },
    } as never);

    const invalid = await POST(
      makeRequest({
        clientHlc: validMutation.hlc,
        mutations: [{ ...validMutation, payload: { reading: -1 } }],
      })
    );
    const oversized = await POST(
      makeRequest(
        { clientHlc: validMutation.hlc, mutations: [validMutation] },
        { 'content-length': '1048577' }
      )
    );

    expect(invalid.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps database authorization rejection to forbidden', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'user-1' },
      employee: {
        id: 'employee-1',
        role: 'operator',
        department_id: departmentId,
        accessible_departments: [],
      },
    } as never);
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } });

    const response = await POST(
      makeRequest({ clientHlc: validMutation.hlc, mutations: [validMutation] })
    );

    expect(response.status).toBe(403);
  });
});
