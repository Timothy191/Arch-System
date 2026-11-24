/**
 * @jest-environment node
 */

import { AuthError, ForbiddenError, ValidationError } from '@repo/errors';
import { loadDrillingDailyLogData, saveDrillDailyEntry } from './actions';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase');
const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');
const { cacheInvalidateTags } = jest.requireMock('@repo/redis');
const { revalidatePath } = jest.requireMock('next/cache');

const DEPT_ID = '11111111-1111-4111-8111-111111111111';
const MACHINE_ID_1 = '22222222-2222-4222-8222-222222222222';
const MACHINE_ID_2 = '33333333-3333-4333-8333-333333333333';

describe('drilling daily log server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadDrillingDailyLogData', () => {
    it('throws ValidationError when date format is invalid', async () => {
      await expect(
        loadDrillingDailyLogData({ deptId: DEPT_ID, logDate: 'invalid-date' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws AuthError when user is unauthenticated', async () => {
      createServerSupabaseClient.mockResolvedValue({});
      getAuthenticatedEmployee.mockResolvedValue(null);

      await expect(
        loadDrillingDailyLogData({ deptId: DEPT_ID, logDate: '2026-11-24' })
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('throws ForbiddenError when user lacks drilling department access', async () => {
      createServerSupabaseClient.mockResolvedValue({});
      getAuthenticatedEmployee.mockResolvedValue({
        user: { id: 'user-1' },
        employee: {
          id: 'emp-1',
          role: 'operator',
          department_id: 'other-dept',
          accessible_departments: [],
        },
      });

      await expect(
        loadDrillingDailyLogData({ deptId: DEPT_ID, logDate: '2026-11-24' })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('aggregates per-rig day and night meters, holes, photos, and Where labels', async () => {
      const machinesOrder = jest.fn().mockResolvedValue({
        data: [
          {
            id: MACHINE_ID_1,
            name: 'DR-01',
            machine_type: 'Drill Rig',
            serial_number: 'SN-DR01',
            image_url: '/images/fleet/atlas-copco-drill.webp',
            site: { name: 'Pit North', site_code: 'PN' },
          },
          {
            id: MACHINE_ID_2,
            name: 'DR-02',
            machine_type: 'Drill Rig',
            serial_number: null,
            image_url: null,
            site: null,
          },
        ],
        error: null,
      });

      const opsEqDate = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'op-day',
            machine_id: MACHINE_ID_1,
            shift_type: 'day',
            meters_drilled: 120.5,
            holes: 24,
            site: 'Pit North',
            block_drilled: 'Bench B4',
            operator_name: 'T. Moyo',
            comments: 'Clean bench',
            status: 'active',
          },
          {
            id: 'op-night',
            machine_id: MACHINE_ID_1,
            shift_type: 'night',
            meters_drilled: 95,
            holes: 18,
            site: 'Pit North',
            block_drilled: 'Bench B5',
            operator_name: 'K. Nkosi',
            comments: null,
            status: 'completed',
          },
        ],
        error: null,
      });

      createServerSupabaseClient.mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === 'machines') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: machinesOrder,
                  }),
                }),
              }),
            };
          }
          if (table === 'drill_operations') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: opsEqDate,
                }),
              }),
            };
          }
          return {};
        }),
      });

      getAuthenticatedEmployee.mockResolvedValue({
        user: { id: 'user-1' },
        employee: {
          id: 'emp-1',
          role: 'operator',
          department_id: DEPT_ID,
          accessible_departments: [],
        },
      });

      const result = await loadDrillingDailyLogData({ deptId: DEPT_ID, logDate: '2026-11-24' });

      expect(result.summary).toEqual({
        activeRigs: 2,
        loggedRigs: 1,
        totalDailyMeters: 215.5,
        totalDailyHoles: 42,
        activeSitesCount: 1,
        activeSites: ['Pit North'],
      });

      expect(result.rigs[0]).toMatchObject({
        machineId: MACHINE_ID_1,
        name: 'DR-01',
        dailyMetersDrilled: 215.5,
        dailyHolesDrilled: 42,
        whereSite: 'Pit North',
        whereBlock: 'Bench B4 / Bench B5',
        whereDisplay: 'Pit North · Bench B4 / Bench B5',
        isLogged: true,
      });

      expect(result.rigs[1]).toMatchObject({
        machineId: MACHINE_ID_2,
        name: 'DR-02',
        imageUrl: '/images/fleet/atlas-copco-drill.webp',
        dailyMetersDrilled: 0,
        dailyHolesDrilled: 0,
        whereDisplay: 'Unassigned Site',
        isLogged: false,
      });
    });
  });

  describe('saveDrillDailyEntry', () => {
    it('rejects unauthenticated requests', async () => {
      createServerSupabaseClient.mockResolvedValue({});
      getAuthenticatedEmployee.mockResolvedValue(null);

      const res = await saveDrillDailyEntry({
        departmentId: DEPT_ID,
        machineId: MACHINE_ID_1,
        operationDate: '2026-11-24',
        shiftType: 'day',
        metersDrilled: 100,
        holes: 20,
        site: 'Pit North',
        blockDrilled: 'B4',
      });

      expect(res).toEqual({ success: false, error: 'Unauthorized access' });
    });

    it('validates input via drillOperationSchema before database mutation', async () => {
      createServerSupabaseClient.mockResolvedValue({});
      getAuthenticatedEmployee.mockResolvedValue({
        user: { id: 'user-1' },
        employee: {
          id: 'emp-1',
          role: 'operator',
          department_id: DEPT_ID,
          accessible_departments: [],
        },
      });

      const res = await saveDrillDailyEntry({
        departmentId: DEPT_ID,
        machineId: 'not-a-uuid',
        operationDate: '2026-11-24',
        shiftType: 'day',
        metersDrilled: 100,
        holes: 20,
        site: 'Pit North',
        blockDrilled: 'B4',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Validation error');
      }
    });

    it('upserts drill_operations with composite conflict key and invalidates caches', async () => {
      const singleMock = jest.fn().mockResolvedValue({
        data: {
          id: 'op-saved-1',
          machine_id: MACHINE_ID_1,
          department_id: DEPT_ID,
          operation_date: '2026-11-24',
          shift_type: 'day',
          meters_drilled: 145.5,
          holes: 28,
          site: 'Pit North',
          block_drilled: 'Bench B4',
          operator_name: null,
          comments: 'Hard dolerite',
          status: 'active',
        },
        error: null,
      });
      const selectMock = jest.fn().mockReturnValue({ single: singleMock });
      const upsertMock = jest.fn().mockReturnValue({ select: selectMock });

      createServerSupabaseClient.mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === 'drill_operations') {
            return { upsert: upsertMock };
          }
          return {};
        }),
      });

      getAuthenticatedEmployee.mockResolvedValue({
        user: { id: 'user-1' },
        employee: {
          id: 'emp-1',
          role: 'operator',
          department_id: DEPT_ID,
          accessible_departments: [],
        },
      });

      const res = await saveDrillDailyEntry({
        departmentId: DEPT_ID,
        machineId: MACHINE_ID_1,
        operationDate: '2026-11-24',
        shiftType: 'day',
        metersDrilled: 145.5,
        holes: 28,
        site: 'Pit North',
        blockDrilled: 'Bench B4',
        comments: 'Hard dolerite',
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          machine_id: MACHINE_ID_1,
          department_id: DEPT_ID,
          operation_date: '2026-11-24',
          shift_type: 'day',
          meters_drilled: 145.5,
          holes: 28,
          site: 'Pit North',
          block_drilled: 'Bench B4',
          comments: 'Hard dolerite',
        }),
        { onConflict: 'machine_id,operation_date,shift_type' }
      );

      expect(revalidatePath).toHaveBeenCalledWith('/drilling');
      expect(revalidatePath).toHaveBeenCalledWith('/drilling/daily-log');
      expect(revalidatePath).toHaveBeenCalledWith('/drilling/drilling-operations');
      expect(cacheInvalidateTags).toHaveBeenCalledWith([
        'table:drill_operations',
        'table:daily_logs',
      ]);

      expect(res).toEqual({
        success: true,
        record: {
          id: 'op-saved-1',
          machineId: MACHINE_ID_1,
          departmentId: DEPT_ID,
          operationDate: '2026-11-24',
          shiftType: 'day',
          metersDrilled: 145.5,
          holes: 28,
          site: 'Pit North',
          blockDrilled: 'Bench B4',
          operatorName: null,
          comments: 'Hard dolerite',
          status: 'active',
        },
      });
    });
  });
});
