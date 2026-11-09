/**
 * @jest-environment node
 */
import { submitShiftCloseout } from './shift-closeout';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  getRedisClient: jest.fn(),
}));

const { createServerSupabaseClient } = require('@repo/supabase/server');
const { getRedisClient } = require('@repo/redis');

describe('submitShiftCloseout server action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns validation error when payload fails Zod schema verification', async () => {
    const invalidPayload: any = {
      shiftId: 'not-a-uuid',
      department: 'control_room',
      supervisorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      supervisorPin: '12', // invalid: less than 4 digits
      totalLoads: -5,
      totalOperatingHours: 25,
      breakdownHours: 0,
    };

    const result = await submitShiftCloseout(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns auth error when supervisor PIN verification fails', async () => {
    const validPayload = {
      shiftId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      department: 'control_room' as const,
      supervisorId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      supervisorPin: '1234',
      totalLoads: 45,
      totalOperatingHours: 8,
      breakdownHours: 0,
      operatorNotes: 'Shift completed without incident',
    };

    getRedisClient.mockResolvedValue({
      isOpen: true,
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    });

    createServerSupabaseClient.mockResolvedValue({
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    });

    const result = await submitShiftCloseout(validPayload);
    expect(result.success).toBe(false);
    expect(result.code).toBe('AUTH_ERROR');
    expect(result.error).toContain('Invalid supervisor PIN');
  });

  it('returns auth error when caller has no authenticated session', async () => {
    const validPayload = {
      shiftId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      department: 'control_room' as const,
      supervisorId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      supervisorPin: '1234',
      totalLoads: 45,
      totalOperatingHours: 8,
      breakdownHours: 0,
    };

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const result = await submitShiftCloseout(validPayload);
    expect(result.success).toBe(false);
    expect(result.code).toBe('AUTH_ERROR');
    expect(result.error).toContain('Unauthorized');
  });

  it('returns rate limit error when supervisor exceeds 5 attempts per minute in Redis', async () => {
    const validPayload = {
      shiftId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      department: 'control_room' as const,
      supervisorId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      supervisorPin: '1234',
      totalLoads: 45,
      totalOperatingHours: 8,
      breakdownHours: 0,
    };

    getRedisClient.mockResolvedValue({
      isOpen: true,
      incr: jest.fn().mockResolvedValue(6),
      expire: jest.fn().mockResolvedValue(1),
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'op-1' } }, error: null }),
      },
    });

    const result = await submitShiftCloseout(validPayload);
    expect(result.success).toBe(false);
    expect(result.code).toBe('RATE_LIMIT_ERROR');
    expect(result.error).toContain('Maximum 5 shift closeout attempts');
  });

  it('returns auth lockout error when RPC reports supervisor PIN is temporarily locked', async () => {
    const validPayload = {
      shiftId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      department: 'control_room' as const,
      supervisorId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      supervisorPin: '1234',
      totalLoads: 45,
      totalOperatingHours: 8,
      breakdownHours: 0,
    };

    getRedisClient.mockResolvedValue({
      isOpen: true,
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'op-1' } }, error: null }),
      },
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Supervisor PIN is temporarily locked due to failed attempts.' },
      }),
    });

    const result = await submitShiftCloseout(validPayload);
    expect(result.success).toBe(false);
    expect(result.code).toBe('AUTH_ERROR');
    expect(result.error).toContain('temporarily locked');
  });

  it('resolves supervisor department_id and falls back to shift_status when report upsert fails', async () => {
    const validPayload = {
      shiftId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      department: 'control_room' as const,
      supervisorId: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
      supervisorPin: '1234',
      totalLoads: 45,
      totalOperatingHours: 8,
      breakdownHours: 0,
      operatorNotes: 'Fallback shift status closeout test',
    };

    getRedisClient.mockResolvedValue({
      isOpen: false,
    });

    const mockUpsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'table not available' },
        }),
      }),
    });

    const mockShiftStatusUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: validPayload.shiftId, status: 'closed' },
            error: null,
          }),
        }),
      }),
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'op-1' } }, error: null }),
      },
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
      from: jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { department_id: 'dept-control-room-uuid' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'control_room_shift_reports') {
          return { upsert: mockUpsert };
        }
        return { update: mockShiftStatusUpdate };
      }),
    });

    const result = await submitShiftCloseout(validPayload);
    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        department_id: 'dept-control-room-uuid',
        supervisor_signature: `Verified:${validPayload.supervisorId}`,
      }),
      { onConflict: 'department_id,report_date,shift_type' }
    );
    expect(result.data).toEqual({ id: validPayload.shiftId, status: 'closed' });
  });

  it('returns success when PIN is valid and shift report updates successfully', async () => {
    const validPayload = {
      shiftId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      department: 'control_room' as const,
      supervisorId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      supervisorPin: '1234',
      totalLoads: 45,
      totalOperatingHours: 8,
      breakdownHours: 0,
      operatorNotes: 'Shift completed cleanly',
    };

    getRedisClient.mockResolvedValue({
      isOpen: true,
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    });

    createServerSupabaseClient.mockResolvedValue({
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
      from: jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'report-123', status: 'closed' },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await submitShiftCloseout(validPayload);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
