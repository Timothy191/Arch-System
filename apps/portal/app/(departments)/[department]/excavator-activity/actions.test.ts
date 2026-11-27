/**
 * @jest-environment node
 */

import { cacheInvalidateTags } from '@repo/redis/cache';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { revalidatePath } from 'next/cache';
import { saveExcavatorShiftTelemetry } from './actions';

jest.mock('@repo/redis/cache', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@repo/logger/server', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

const DEPT_ID = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
const EXCAVATOR_ID = 'd290f1ee-6c54-4b01-90e6-d701748f0853';
const OPERATOR_ID = 'd290f1ee-6c54-4b01-90e6-d701748f0859';
const SITE_ID = 'd290f1ee-6c54-4b01-90e6-d701748f0854';

function makeQuery(result: { data: unknown; error?: unknown } = { data: [], error: null }) {
  const chain: Record<string, jest.Mock | ((r: (v: unknown) => unknown) => Promise<unknown>)> = {};
  for (const method of ['select', 'update', 'insert', 'eq', 'order']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

describe('excavator-activity saveExcavatorShiftTelemetry action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      saveExcavatorShiftTelemetry({
        departmentId: DEPT_ID,
        excavatorId: EXCAVATOR_ID,
        loadDate: '2026-11-24',
        shiftType: 'day',
        startSmr: 1200,
        stopSmr: 1210,
        operatorId: OPERATOR_ID,
        operatorName: 'Thabo Mokoena',
        comment: 'Loading highwall waste bench',
      })
    ).rejects.toThrow('Unauthorized');
  });

  it('rejects when Stop SMR is lower than Start SMR', async () => {
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-1' },
      employee: {
        id: 'emp-1',
        role: 'supervisor',
        department_id: DEPT_ID,
        accessible_departments: ['control-room'],
      },
    });

    await expect(
      saveExcavatorShiftTelemetry({
        departmentId: DEPT_ID,
        excavatorId: EXCAVATOR_ID,
        loadDate: '2026-11-24',
        shiftType: 'day',
        startSmr: 1250,
        stopSmr: 1240,
        operatorId: OPERATOR_ID,
        operatorName: 'Thabo Mokoena',
        comment: 'Invalid meter reading',
      })
    ).rejects.toThrow('Stop SMR must be greater than or equal to Start SMR');
  });

  it('updates existing excavator_activity and machine_operations records and invalidates caches', async () => {
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-1' },
      employee: {
        id: 'emp-1',
        role: 'supervisor',
        department_id: DEPT_ID,
        accessible_departments: ['control-room'],
      },
    });

    const actSelectChain = makeQuery({ data: [{ id: 'act-existing' }], error: null });
    const actUpdateChain = makeQuery({ data: null, error: null });
    const opSelectChain = makeQuery({ data: [{ id: 'op-existing' }], error: null });
    const opUpdateChain = makeQuery({ data: null, error: null });
    const delaySelectChain = makeQuery({ data: [{ total_delay_hours: 0 }], error: null });
    let actCall = 0;
    let opCall = 0;

    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'excavator_activity') {
          actCall += 1;
          return actCall === 1 ? actSelectChain : actUpdateChain;
        }
        if (table === 'machine_operations') {
          opCall += 1;
          return opCall === 1 ? opSelectChain : opUpdateChain;
        }
        if (table === 'machine_operations_with_delays') {
          return delaySelectChain;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const res = await saveExcavatorShiftTelemetry({
      departmentId: DEPT_ID,
      excavatorId: EXCAVATOR_ID,
      loadDate: '2026-11-24',
      shiftType: 'night',
      startSmr: 14500.5,
      stopSmr: 14511.25,
      operatorId: OPERATOR_ID,
      operatorName: 'Thabo Mokoena',
      comment: 'Bench cleared cleanly',
      siteId: SITE_ID,
    });

    expect(res).toEqual({
      success: true,
      startSmr: 14500.5,
      stopSmr: 14511.25,
      hoursWorked: 10.75,
      operatorId: OPERATOR_ID,
      operatorName: 'Thabo Mokoena',
      comment: 'Bench cleared cleanly',
    });

    expect(actUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        operator_id: OPERATOR_ID,
        notes: 'Bench cleared cleanly',
      })
    );
    expect(opUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        start_smu: 14500.5,
        end_smu: 14511.25,
        hours_worked: 10.75,
        operator_id: OPERATOR_ID,
        operator_name: 'Thabo Mokoena',
      })
    );
    expect(cacheInvalidateTags).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/control-room/excavator-activity');
  });

  it('inserts new activity and operation rows when no records exist for the shift', async () => {
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-2' },
      employee: {
        id: 'emp-2',
        role: 'operator',
        department_id: DEPT_ID,
        accessible_departments: ['control-room'],
      },
    });

    const actSelectChain = makeQuery({ data: [], error: null });
    const actInsertChain = makeQuery({ data: null, error: null });
    const opSelectChain = makeQuery({ data: [], error: null });
    const opInsertChain = makeQuery({ data: null, error: null });
    let actCall = 0;
    let opCall = 0;

    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'excavator_activity') {
          actCall += 1;
          return actCall === 1 ? actSelectChain : actInsertChain;
        }
        if (table === 'machine_operations') {
          opCall += 1;
          return opCall === 1 ? opSelectChain : opInsertChain;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const res = await saveExcavatorShiftTelemetry({
      departmentId: DEPT_ID,
      excavatorId: EXCAVATOR_ID,
      loadDate: '2026-11-24',
      shiftType: 'day',
      startSmr: 9000,
      stopSmr: 9009.5,
      operatorId: OPERATOR_ID,
      operatorName: 'Sipho Dlamini',
      comment: 'Starting east pit cut',
    });

    expect(res.hoursWorked).toBe(9.5);
    expect(actInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        machine_id: EXCAVATOR_ID,
        shift_type: 'day',
        operator_id: OPERATOR_ID,
        notes: 'Starting east pit cut',
      })
    );
    expect(opInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        machine_id: EXCAVATOR_ID,
        shift_type: 'day',
        start_time: '06:00',
        start_smu: 9000,
        end_smu: 9009.5,
        hours_worked: 9.5,
      })
    );
  });

  it('rejects via Zod when Stop SMR exceeds Start SMR + 12 hours', async () => {
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-3' },
      employee: {
        id: 'emp-3',
        role: 'supervisor',
        department_id: DEPT_ID,
        accessible_departments: ['control-room'],
      },
    });

    await expect(
      saveExcavatorShiftTelemetry({
        departmentId: DEPT_ID,
        excavatorId: EXCAVATOR_ID,
        loadDate: '2026-11-24',
        shiftType: 'day',
        startSmr: 1200,
        stopSmr: 1212.5,
        operatorId: OPERATOR_ID,
        operatorName: 'Thabo Mokoena',
        comment: null,
      })
    ).rejects.toThrow('Stop SMR cannot exceed Start SMR + 12 hours');
  });

  it('rejects when Stop SMR exceeds Start SMR + (12 h - logged delay hours)', async () => {
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-4' },
      employee: {
        id: 'emp-4',
        role: 'supervisor',
        department_id: DEPT_ID,
        accessible_departments: ['control-room'],
      },
    });

    const actSelectChain = makeQuery({ data: [{ id: 'act-existing' }], error: null });
    const opSelectChain = makeQuery({ data: [{ id: 'op-existing' }], error: null });
    const delaySelectChain = makeQuery({ data: [{ total_delay_hours: 2.5 }], error: null });

    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'excavator_activity') return actSelectChain;
        if (table === 'machine_operations') return opSelectChain;
        if (table === 'machine_operations_with_delays') return delaySelectChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(
      saveExcavatorShiftTelemetry({
        departmentId: DEPT_ID,
        excavatorId: EXCAVATOR_ID,
        loadDate: '2026-11-24',
        shiftType: 'day',
        startSmr: 1200,
        stopSmr: 1210,
        operatorId: OPERATOR_ID,
        operatorName: 'Thabo Mokoena',
        comment: null,
      })
    ).rejects.toThrow('Stop SMR cannot exceed 1209.5 (Start SMR + 12 h − 2.5 h delay).');
  });
});
