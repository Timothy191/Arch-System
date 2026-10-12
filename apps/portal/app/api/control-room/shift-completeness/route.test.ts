/// <reference types="jest" />
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from './route';

// Mock next/server
jest.mock('next/server', () => {
  return {
    NextRequest: jest.fn().mockImplementation((url: string) => {
      return {
        nextUrl: new URL(url),
      } as unknown as NextRequest;
    }),
    NextResponse: {
      json: (body: any, init: any = {}) => ({
        status: init?.status || 200,
        json: async () => body,
        headers: new Headers(init?.headers || {}),
      }),
    },
  };
});

// Mock supabase/server
jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');

// Mock shift-completeness lib
jest.mock('@/lib/shift-completeness', () => ({
  getShiftCompleteness: jest.fn(),
}));

const { getShiftCompleteness } = jest.requireMock('@/lib/shift-completeness');

// Helper function to mock authenticated Supabase response
function buildSupabaseAuth(user: unknown) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

describe('GET /api/control-room/shift-completeness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when the user is not authenticated', async () => {
    createServerSupabaseClient.mockResolvedValue(buildSupabaseAuth(null));

    const req = new NextRequest('http://localhost:3000/api/control-room/shift-completeness');
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      success: false,
      error: {
        message: 'Unauthorized',
        code: 'API_ERROR',
      },
    });
  });

  it('returns 400 when required query params are missing', async () => {
    createServerSupabaseClient.mockResolvedValue(buildSupabaseAuth({ id: 'user-1' }));

    const req = new NextRequest('http://localhost:3000/api/control-room/shift-completeness');
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      success: false,
      error: {
        message: 'Missing required params: deptId, deptSlug, date, shift',
        code: 'API_ERROR',
      },
    });
  });

  it('returns 200 with completeness payload when authenticated and params are present', async () => {
    createServerSupabaseClient.mockResolvedValue(buildSupabaseAuth({ id: 'user-1' }));
    getShiftCompleteness.mockResolvedValue({
      complete: true,
      missing: [],
      coverage: 1,
    });

    const req = new NextRequest(
      'http://localhost:3000/api/control-room/shift-completeness?deptId=dept-1&deptSlug=ops&date=2026-09-07&shift=day'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      complete: true,
      missing: [],
      coverage: 1,
    });
    expect(getShiftCompleteness).toHaveBeenCalledWith(
      expect.anything(),
      'dept-1',
      'ops',
      '2026-09-07',
      'day'
    );
  });
});
