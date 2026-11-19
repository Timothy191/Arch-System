/**
 * @jest-environment node
 */

import { AuthError, DatabaseError, ForbiddenError, ValidationError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { triggerPluginHook } from '@/lib/plugins/consumers';
import { createDailyLog } from './actions';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/plugins/consumers', () => ({
  triggerPluginHook: jest.fn(async () => undefined),
}));

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.Mock;
const mockCacheInvalidateTags = cacheInvalidateTags as jest.Mock;
const mockRevalidatePath = revalidatePath as jest.Mock;
const mockTriggerPluginHook = triggerPluginHook as jest.Mock;

const TARGET_DEPT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_DEPT_ID = '00000000-0000-4000-8000-000000000002';

interface MockOptions {
  user?: { id: string } | null;
  employee?: {
    role: string;
    department_id: string | null;
    accessible_departments: string[] | null;
  } | null;
  employeeError?: { message: string } | null;
  dailyLogId?: string;
  dailyLogError?: { message: string } | null;
  productionLogError?: { message: string } | null;
}

function buildSupabaseMock(options: MockOptions = {}) {
  const dailyLogInserts: Array<Record<string, unknown>> = [];
  const productionLogInserts: Array<Record<string, unknown>> = [];

  const mock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: options.user !== undefined ? options.user : { id: 'auth-user-1' } },
      }),
    },
    from: jest.fn((table: string) => {
      if (table === 'employees') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: options.employee !== undefined ? options.employee : null,
                error: options.employeeError ?? null,
              }),
            }),
          }),
        };
      }

      if (table === 'daily_logs') {
        return {
          insert: jest.fn((payload: Record<string, unknown>) => {
            dailyLogInserts.push(payload);
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: options.dailyLogError ? null : { id: options.dailyLogId ?? 'daily-log-1' },
                  error: options.dailyLogError ?? null,
                }),
              }),
            };
          }),
        };
      }

      if (table === 'production_logs') {
        return {
          insert: jest.fn((payload: Record<string, unknown>) => {
            productionLogInserts.push(payload);
            return Promise.resolve({
              error: options.productionLogError ?? null,
            });
          }),
        };
      }

      return {};
    }),
  };

  mockCreateServerSupabaseClient.mockResolvedValue(mock);
  return { mock, dailyLogInserts, productionLogInserts };
}

describe('createDailyLog server action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws AuthError when caller is unauthenticated', async () => {
    buildSupabaseMock({ user: null });

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        today: '2026-11-19',
        shift: 'day',
        notes: 'Shift started smoothly',
      })
    ).rejects.toThrow(AuthError);
  });

  it('throws ValidationError for invalid UUID, date, shift, notes length, or negative/non-finite tonnage', async () => {
    buildSupabaseMock({
      employee: { role: 'admin', department_id: TARGET_DEPT_ID, accessible_departments: [] },
    });

    await expect(
      createDailyLog({
        departmentId: 'invalid-uuid',
        shift: 'day',
        notes: null,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        today: '19-11-2026',
        shift: 'day',
        notes: null,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        shift: 'swing' as 'day',
        notes: null,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        shift: 'day',
        notes: 'x'.repeat(2001),
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        shift: 'day',
        notes: null,
        isProduction: true,
        actualCoalTonnes: -5,
        actualWasteTonnes: 10,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        shift: 'day',
        notes: null,
        isProduction: true,
        actualCoalTonnes: 10,
        actualWasteTonnes: Number.NaN,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ForbiddenError when employee record is missing or lacks department access', async () => {
    buildSupabaseMock({ employee: null });

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        shift: 'day',
        notes: null,
      })
    ).rejects.toThrow(ForbiddenError);

    buildSupabaseMock({
      employee: {
        role: 'operator',
        department_id: OTHER_DEPT_ID,
        accessible_departments: [],
      },
    });

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        shift: 'day',
        notes: 'Cross-dept write attempt',
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('allows non-production insert when caller belongs to primary or accessible department', async () => {
    const { dailyLogInserts, productionLogInserts } = buildSupabaseMock({
      employee: {
        role: 'operator',
        department_id: OTHER_DEPT_ID,
        accessible_departments: [TARGET_DEPT_ID],
      },
    });

    const result = await createDailyLog({
      departmentId: TARGET_DEPT_ID,
      today: '2026-11-19',
      shift: 'night',
      notes: '',
      isProduction: false,
    });

    expect(result).toEqual({ success: true, id: 'daily-log-1' });
    expect(dailyLogInserts).toEqual([
      {
        department_id: TARGET_DEPT_ID,
        log_date: '2026-11-19',
        shift: 'night',
        notes: null,
      },
    ]);
    expect(productionLogInserts).toHaveLength(0);
    expect(mockCacheInvalidateTags).toHaveBeenCalledWith(['table:daily_logs']);
    expect(mockTriggerPluginHook).toHaveBeenCalledWith('onLogCreated', {
      id: 'daily-log-1',
      department_id: TARGET_DEPT_ID,
      log_date: '2026-11-19',
      shift: 'night',
      notes: null,
      is_production: false,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('allows admin/manager production insert and writes production_logs metrics', async () => {
    const { dailyLogInserts, productionLogInserts } = buildSupabaseMock({
      employee: {
        role: 'manager',
        department_id: OTHER_DEPT_ID,
        accessible_departments: [],
      },
    });

    const result = await createDailyLog({
      departmentId: TARGET_DEPT_ID,
      today: '2026-11-19',
      shift: 'day',
      notes: 'Steady haulage shift',
      isProduction: true,
      actualCoalTonnes: 1250,
      actualWasteTonnes: 3400,
    });

    expect(result).toEqual({ success: true, id: 'daily-log-1' });
    expect(dailyLogInserts).toHaveLength(1);
    expect(productionLogInserts).toEqual([
      {
        daily_log_id: 'daily-log-1',
        coal_tonnes: 1250,
        waste_tonnes: 3400,
      },
    ]);
  });

  it('throws DatabaseError when daily_logs or production_logs insert fails', async () => {
    buildSupabaseMock({
      employee: { role: 'admin', department_id: TARGET_DEPT_ID, accessible_departments: [] },
      dailyLogError: { message: 'insert error' },
    });

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        shift: 'day',
        notes: 'Notes',
      })
    ).rejects.toThrow(DatabaseError);

    buildSupabaseMock({
      employee: { role: 'operator', department_id: TARGET_DEPT_ID, accessible_departments: [] },
      productionLogError: { message: 'prod insert error' },
    });

    await expect(
      createDailyLog({
        departmentId: TARGET_DEPT_ID,
        shift: 'day',
        notes: 'Notes',
        isProduction: true,
        actualCoalTonnes: 100,
        actualWasteTonnes: 200,
      })
    ).rejects.toThrow(DatabaseError);
  });
});
