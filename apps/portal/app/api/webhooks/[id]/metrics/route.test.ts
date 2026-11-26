/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');

describe('GET /api/webhooks/[id]/metrics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns delivery health metrics for an admin', async () => {
    const logs = [
      { success: true, created_at: '2026-01-01T00:00:00Z', retry_count: 0 },
      { success: false, created_at: '2026-01-02T00:00:00Z', retry_count: 1 },
      { success: true, created_at: '2026-01-03T00:00:00Z', retry_count: 0 },
    ];
    const mock = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'emp-1',
                    role: 'admin',
                    department_id: 'dept-1',
                    accessible_departments: [],
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'webhook_endpoints') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { department_id: 'dept-1' } }),
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest
                .fn()
                .mockReturnValue({ limit: jest.fn().mockResolvedValue({ data: logs }) }),
            }),
          }),
        };
      }),
    };
    createServerSupabaseClient.mockResolvedValue(mock);

    const req = new NextRequest(
      'http://localhost/api/webhooks/11111111-1111-4111-a111-111111111111/metrics'
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: '11111111-1111-4111-a111-111111111111' }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      total: 3,
      successful: 2,
      failed: 1,
      retried: 1,
      successRate: 67,
    });
  });
});
