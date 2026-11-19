/**
 * @jest-environment node
 */
import { createServerSupabaseClient } from '@repo/supabase/server';
import { exportSignedShiftReportPdf } from './pdf-actions';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/logger', () => ({
  serverLogger: {
    error: jest.fn(),
  },
}));

const mockCreateSupabase = jest.mocked(createServerSupabaseClient);

describe('exportSignedShiftReportPdf', () => {
  const prevSecret = process.env.SHIFT_SIGNING_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SHIFT_SIGNING_SECRET = 'test-shift-signing-secret-0123456789';
  });

  afterAll(() => {
    process.env.SHIFT_SIGNING_SECRET = prevSecret;
  });

  it('rejects unauthenticated requests cleanly', async () => {
    mockCreateSupabase.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as never);

    const res = await exportSignedShiftReportPdf({
      departmentId: 'dept-1',
      shiftDate: '2026-11-19',
      shiftType: 'day',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Unauthorized/i);
  });

  it('returns signed HTML payload with en-US formatted production and rollover totals', async () => {
    const rpcMock = jest.fn(async () => ({
      data: {
        meta: { shift_date: '2026-11-19', shift_type: 'day' },
        production: {
          BKF: [
            {
              excavator_name: 'EX-01',
              operator_name: 'S. Mokoena',
              block_id: 'B4',
              material_type: 'COAL',
              trucks: [{ truck_name: 'DT-11', loads: 12 }],
              total_loads: 12,
              total_bcm: 1450,
              total_tonnes: 1850,
              operating_hours: 9.5,
              rate_per_hour: 1.26,
              delays: null,
            },
          ],
        },
        rollover: {
          entries: [
            {
              machine_name: 'DZ-01',
              start_smu: 2100,
              end_smu: 2108,
              hours: 8,
              total_bcm: 2000,
            },
          ],
          total_bcm: 2000,
        },
        breakdowns: [],
        ancillary: [],
      },
      error: null,
    }));

    mockCreateSupabase.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'u-1', email: 'lead@plantcor.co.za' } },
          error: null,
        }),
      },
      rpc: rpcMock,
    } as never);

    const res = await exportSignedShiftReportPdf({
      departmentId: 'dept-1',
      shiftDate: '2026-11-19',
      shiftType: 'day',
    });

    expect(res.success).toBe(true);
    expect(res.signatureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.fileName).toContain('Shift_Report_2026-11-19_DAY_');
    expect(res.htmlContent).toContain('1,850 t');
    expect(res.htmlContent).toContain('2,000 BCM');
  });
});
