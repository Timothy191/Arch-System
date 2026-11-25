/**
 * @jest-environment node
 */

import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  getProductionDepartmentData,
  getProductionMachinesTargetReport,
  getProductionPerformanceData,
  getProductionPlatformTargets,
  saveProductionPlatformTargets,
  upsertMonthlyProductionTarget,
} from './actions';
import { DEFAULT_PRODUCTION_PLATFORM_TARGETS } from './production-types';

jest.mock('@repo/redis', () => ({
  CacheCategory: { METRICS: 'metrics' },
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@repo/logger/server', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

function makeSupabaseQuery(result: { data: unknown; error?: unknown } = { data: [], error: null }) {
  const query: Record<string, jest.Mock | ((r: (v: unknown) => unknown) => Promise<unknown>)> = {};
  for (const method of [
    'select',
    'insert',
    'update',
    'upsert',
    'eq',
    'is',
    'gte',
    'lte',
    'in',
    'order',
  ]) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => result);
  query.single = jest.fn(async () => result);
  query.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

describe('production/actions.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads persisted Production Platform Targets or falls back to structured defaults', async () => {
    const persistedConfig = {
      shift: {
        pitBcmTarget: 3100,
        coalTonnesTarget: 2400,
        wasteTonnesTarget: 6800,
        loadsTarget: 140,
        rolloverTargetBcm: 1000,
        smrHoursTarget: 110,
      },
      daily: DEFAULT_PRODUCTION_PLATFORM_TARGETS.daily,
      weekly: DEFAULT_PRODUCTION_PLATFORM_TARGETS.weekly,
      monthly: DEFAULT_PRODUCTION_PLATFORM_TARGETS.monthly,
      notes: 'Custom Nov shift baseline',
      updatedAt: null,
    };

    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() =>
        makeSupabaseQuery({
          data: { config: persistedConfig, updated_at: '2026-11-24T08:00:00Z' },
          error: null,
        })
      ),
    });

    const loaded = await getProductionPlatformTargets();
    expect(loaded.shift.pitBcmTarget).toBe(3100);
    expect(loaded.notes).toBe('Custom Nov shift baseline');
    expect(loaded.updatedAt).toBe('2026-11-24T08:00:00Z');

    (createServerSupabaseClient as jest.Mock).mockRejectedValueOnce(new Error('DB offline'));
    const fallback = await getProductionPlatformTargets();
    expect(fallback.shift.pitBcmTarget).toBe(
      DEFAULT_PRODUCTION_PLATFORM_TARGETS.shift.pitBcmTarget
    );
  });

  it('validates auth and permissions when saving targets, updates existing row, and syncs monthly target', async () => {
    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => makeSupabaseQuery()),
    });
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      saveProductionPlatformTargets(DEFAULT_PRODUCTION_PLATFORM_TARGETS)
    ).rejects.toThrow('Unauthorized');

    const reportTemplatesUpdateQuery = makeSupabaseQuery({ data: null, error: null });
    const monthlySyncQuery = makeSupabaseQuery({ data: null, error: null });
    let reportTemplateCalls = 0;

    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'report_templates') {
          reportTemplateCalls += 1;
          return reportTemplateCalls === 1
            ? makeSupabaseQuery({ data: { id: 'tpl-1' }, error: null })
            : reportTemplatesUpdateQuery;
        }
        if (table === 'production_monthly_targets') {
          return monthlySyncQuery;
        }
        return makeSupabaseQuery();
      }),
    });

    (getAuthenticatedEmployee as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
      employee: {
        id: 'emp-1',
        role: 'supervisor',
        accessible_departments: ['production'],
      },
    });

    const saved = await saveProductionPlatformTargets({
      ...DEFAULT_PRODUCTION_PLATFORM_TARGETS,
      notes: 'Pit Alpha Q4 Ramp',
    });

    expect(saved.success).toBe(true);
    expect(saved.targets.notes).toBe('Pit Alpha Q4 Ramp');
    expect(reportTemplatesUpdateQuery.update).toHaveBeenCalled();
    expect(monthlySyncQuery.upsert).toHaveBeenCalled();
    expect(cacheInvalidateTags).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/production/daily-log');

    const monthlyResult = await upsertMonthlyProductionTarget({
      target_month: '2026-11',
      coal_target_tonnes: 140000,
      waste_target_tonnes: 390000,
      bcm_target: 180000,
      notes: 'Updated monthly budget',
    });
    expect(monthlyResult.coal_target_tonnes).toBe(140000);
  });

  it('populates full calendar month 1..totalDays in getProductionDepartmentData and marks hasData accurately', async () => {
    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'production_monthly_targets') {
          return makeSupabaseQuery({
            data: {
              target_month: '2026-11',
              coal_target_tonnes: 135000,
              waste_target_tonnes: 378000,
              bcm_target: 175000,
              notes: 'Nov Target',
              updated_at: null,
            },
            error: null,
          });
        }
        if (table === 'daily_logs') {
          return makeSupabaseQuery({
            data: [
              { id: 'dl-1', log_date: '2026-11-05', shift: 'day', department_id: 'dept-prod' },
              { id: 'dl-2', log_date: '2026-11-05', shift: 'night', department_id: 'dept-prod' },
            ],
            error: null,
          });
        }
        if (table === 'production_logs') {
          return makeSupabaseQuery({
            data: [
              { daily_log_id: 'dl-1', coal_tonnes: 1200, waste_tonnes: 3400 },
              { daily_log_id: 'dl-2', coal_tonnes: 900, waste_tonnes: 2800 },
            ],
            error: null,
          });
        }
        if (table === 'hourly_loads') {
          return makeSupabaseQuery({
            data: [
              {
                id: 'hl-1',
                machine_id: 'm-dt1',
                load_date: '2026-11-05',
                shift_type: 'day',
                total_loads: 40,
                machine: { name: 'DT-01', machine_type: 'Dump Truck', bin_factor: 20 },
              },
            ],
            error: null,
          });
        }
        if (table === 'excavator_dumper_assignments') {
          return makeSupabaseQuery({
            data: [
              {
                total_bcm: 950,
                excavator_activity: { activity_date: '2026-11-06', shift_type: 'day' },
              },
            ],
            error: null,
          });
        }
        if (table === 'machine_operations') {
          return makeSupabaseQuery({
            data: [
              {
                id: 'op-1',
                machine_id: 'm-dz1',
                shift_date: '2026-11-05',
                shift_type: 'day',
                hours_worked: 8,
                machine: { name: 'DZ-01', machine_type: 'Dozer', bin_factor: null },
              },
            ],
            error: null,
          });
        }
        if (table === 'dozer_rolls') {
          return makeSupabaseQuery({ data: [], error: null });
        }
        return makeSupabaseQuery();
      }),
    });

    const report = await getProductionDepartmentData('2026-11', 'dept-prod');
    expect(report.dailyRows).toHaveLength(30);
    expect(report.totals.totalDaysInMonth).toBe(30);
    expect(report.totals.daysLogged).toBe(2);

    const activeDay = report.dailyRows.find((r) => r.date === '2026-11-05');
    expect(activeDay?.hasData).toBe(true);
    expect(activeDay?.haulTruckLoads).toBe(40);
    expect(activeDay?.dozerPushBcm).toBe(2000);

    const emptyDay = report.dailyRows.find((r) => r.date === '2026-11-01');
    expect(emptyDay?.hasData).toBe(false);
    expect(emptyDay?.totalBcm).toBe(0);
  });

  it('evaluates machine compliance statuses (meeting, below, idle) across horizons', async () => {
    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'report_templates') {
          return makeSupabaseQuery({ data: null, error: null });
        }
        if (table === 'machines') {
          return makeSupabaseQuery({
            data: [
              {
                id: 'm-hauler',
                name: 'DT-01',
                machine_type: 'Haul Truck',
                serial_number: 'CAT777',
                bin_factor: 25,
                active: true,
                site: { name: 'Main Pit' },
              },
              {
                id: 'm-dozer',
                name: 'DZ-01',
                machine_type: 'Dozer',
                serial_number: 'D10',
                bin_factor: null,
                active: true,
                site: { name: 'Main Pit' },
              },
              {
                id: 'm-idle',
                name: 'EX-99',
                machine_type: 'Excavator',
                serial_number: 'PC8000',
                bin_factor: null,
                active: true,
                site: null,
              },
            ],
            error: null,
          });
        }
        if (table === 'hourly_loads') {
          return makeSupabaseQuery({
            data: [
              {
                machine_id: 'm-hauler',
                load_date: '2026-11-24',
                shift_type: 'day',
                total_loads: 200,
              },
            ],
            error: null,
          });
        }
        if (table === 'machine_operations') {
          return makeSupabaseQuery({
            data: [
              {
                machine_id: 'm-dozer',
                shift_date: '2026-11-24',
                shift_type: 'day',
                hours_worked: 1,
              },
            ],
            error: null,
          });
        }
        return makeSupabaseQuery({ data: [], error: null });
      }),
    });

    const machineReport = await getProductionMachinesTargetReport('2026-11-24');
    expect(machineReport.machines).toHaveLength(3);

    const hauler = machineReport.machines.find((m) => m.name === 'DT-01');
    const dozer = machineReport.machines.find((m) => m.name === 'DZ-01');
    const idleExcavator = machineReport.machines.find((m) => m.name === 'EX-99');

    expect(hauler?.horizons.shift.status).toBe('meeting');
    expect(dozer?.horizons.shift.status).toBe('below');
    expect(idleExcavator?.horizons.shift.status).toBe('idle');
    expect(machineReport.summaryByHorizon.shift.totalFleet).toBe(3);
  });

  it('aggregates Shift/Daily/Weekly/Monthly performance, Combined Delays, and Foreman Report', async () => {
    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'report_templates' || table === 'production_monthly_targets') {
          return makeSupabaseQuery({ data: null, error: null });
        }
        if (table === 'daily_logs') {
          return makeSupabaseQuery({
            data: [
              {
                id: 'dl-1',
                log_date: '2026-11-10',
                shift: 'day',
                department_id: 'dept-prod',
                notes: 'Clean coal seam exposure on Bench 4.',
              },
            ],
            error: null,
          });
        }
        if (table === 'production_logs') {
          return makeSupabaseQuery({
            data: [{ daily_log_id: 'dl-1', coal_tonnes: 2100, waste_tonnes: 5900 }],
            error: null,
          });
        }
        if (table === 'hourly_loads') {
          return makeSupabaseQuery({
            data: [
              {
                id: 'hl-1',
                machine_id: 'm-1',
                load_date: '2026-11-10',
                shift_type: 'day',
                total_loads: 85,
                machine: { name: 'DT-01', machine_type: 'Dump Truck', bin_factor: 20 },
              },
            ],
            error: null,
          });
        }
        if (table === 'machine_operations') {
          return makeSupabaseQuery({
            data: [
              {
                id: 'op-1',
                machine_id: 'm-1',
                shift_date: '2026-11-10',
                shift_type: 'day',
                hours_worked: 10,
                machine: { name: 'DT-01', machine_type: 'Dump Truck', bin_factor: 20 },
                delay_entries: [
                  {
                    duration_hours: 1.5,
                    deleted_at: null,
                    delay_category: { name: 'Hydraulic Breakdown' },
                  },
                  {
                    duration_hours: 0.5,
                    deleted_at: null,
                    delay_category: { name: 'Blast Clearance' },
                  },
                ],
              },
            ],
            error: null,
          });
        }
        return makeSupabaseQuery({ data: [], error: null });
      }),
    });

    const perf = await getProductionPerformanceData('2026-11', 'dept-prod');
    expect(perf.shiftRows).toHaveLength(1);
    expect(perf.dailyRows).toHaveLength(30);
    expect(perf.weeklyRows).toHaveLength(5);
    expect(perf.monthlyRows).toHaveLength(1);
    expect(perf.foremanSummary.totalCombinedDelayHours).toBe(2);
    expect(perf.foremanSummary.handoverNotes[0]).toContain('Clean coal seam exposure');
    expect(perf.delayGroups.find((g) => g.key === 'engineering')?.delayHours).toBe(1.5);
  });
});
