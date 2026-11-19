/**
 * @jest-environment node
 */

import { getAuthenticatedEmployee } from '@repo/supabase';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { createServerSupabaseClient } from '@repo/supabase/server';
import {
  getPlantProcessingWorkspaceData,
  logPlantDelayAction,
  quickAddPlantEquipmentAction,
  savePlantHourlySheetAction,
} from './actions';
import { buildDefaultHourlyRows } from './types';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/server-cache', () => ({
  tagDepartment: jest.fn((slug: string, section: string) => `dept:${slug}:${section}`),
  updateTags: jest.fn(async () => undefined),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: jest.fn(),
}));

function buildWriteSupabaseMock() {
  const upsertHourlyMock = jest.fn(async () => ({ data: null, error: null }));
  const insertProdMock = jest.fn(async () => ({ data: null, error: null }));
  const insertMachineMock = jest.fn(async () => ({ data: null, error: null }));
  const insertDelayMock = jest.fn(async () => ({ data: null, error: null }));
  const updateDelayEqMock = jest.fn(async () => ({ data: null, error: null }));

  const from = jest.fn((table: string) => {
    if (table === 'departments') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: { id: 'dept-pp-1' } })),
      };
    }
    if (table === 'plant_hourly_logs') {
      return { upsert: upsertHourlyMock };
    }
    if (table === 'daily_logs') {
      return {
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            maybeSingle: jest.fn(async () => ({ data: { id: 'daily-log-1' } })),
          }),
        }),
      };
    }
    if (table === 'production_logs') {
      return { insert: insertProdMock };
    }
    if (table === 'plant_delays') {
      return {
        insert: insertDelayMock,
        update: jest.fn().mockReturnValue({ eq: updateDelayEqMock }),
      };
    }
    if (table === 'machines') {
      return { insert: insertMachineMock };
    }
    return {};
  });

  return {
    client: { from },
    upsertHourlyMock,
    insertProdMock,
    insertMachineMock,
    insertDelayMock,
    updateDelayEqMock,
  };
}

describe('plant-processing actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads workspace data with persisted sheets and delays', async () => {
    (createServerSupabaseClient as jest.Mock).mockResolvedValueOnce({});
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce({
      user: { id: 'u-1', email: 'metallurgist@plantcor.co.za' },
      employee: { id: 'emp-1' },
    });

    const sampleRows = buildDefaultHourlyRows('day');
    (createReadReplicaClient as jest.Mock).mockResolvedValueOnce({
      from: jest.fn((table: string) => {
        if (table === 'departments') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({ data: { id: 'dept-pp-1' } })),
          };
        }
        if (table === 'plant_hourly_logs') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn(async () => ({
              data: [
                {
                  id: 'sheet-db-1',
                  operation_date: '2026-10-22',
                  shift: 'day',
                  module_id: 'DMS-MOD-1',
                  operator_name: 'S. Mokoena',
                  rows: sampleRows,
                  updated_at: '2026-10-22T12:00:00Z',
                },
              ],
              error: null,
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: [
              {
                id: 'delay-db-1',
                delay_date: '2026-10-22',
                shift: 'day',
                circuit: 'Primary Crusher',
                category: 'Mechanical',
                impact_type: 'Full Stoppage',
                start_time: '08:00',
                end_time: '08:30',
                duration_minutes: 30,
                reason: 'Chute blockage',
                corrective_action: 'Cleared chute',
                logged_by: 'S. Mokoena',
                status: 'Resolved',
              },
            ],
            error: null,
          })),
        };
      }),
    });

    const data = await getPlantProcessingWorkspaceData('2026-10-22');
    expect(data.departmentId).toBe('dept-pp-1');
    expect(data.currentDate).toBe('2026-10-22');
    expect(data.initialSheets.some((s) => s.id === 'sheet-db-1')).toBe(true);
    expect(data.initialDelays.some((d) => d.id === 'delay-db-1')).toBe(true);
  });

  it('rejects unauthenticated savePlantHourlySheetAction and formats en-US totals on success', async () => {
    const mock = buildWriteSupabaseMock();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mock.client);

    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce(null);
    const unauth = await savePlantHourlySheetAction({
      date: '2026-10-22',
      shift: 'day',
      moduleId: 'DMS-MOD-1',
      rows: [],
    });
    expect(unauth.success).toBe(false);

    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce({
      user: { id: 'u-1', email: 'operator@plantcor.co.za' },
      employee: { id: 'emp-1' },
    });

    const baseRow = buildDefaultHourlyRows('day')[0]!;
    const ok = await savePlantHourlySheetAction({
      date: '2026-10-22',
      shift: 'day',
      moduleId: 'DMS-MOD-1',
      rows: [{ ...baseRow, romFeedTonnes: 1750, cleanCoalTonnes: 1500, discardTonnes: 250 }],
    });
    expect(ok.success).toBe(true);
    expect(ok.message).toContain('1,500 t clean coal / 250 t discard');
    expect(mock.upsertHourlyMock).toHaveBeenCalledTimes(1);
    expect(mock.insertProdMock).toHaveBeenCalledTimes(1);
  });

  it('logs new and updated plant delays via logPlantDelayAction', async () => {
    const mock = buildWriteSupabaseMock();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mock.client);

    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce(null);
    const unauth = await logPlantDelayAction({
      date: '2026-10-22',
      shift: 'day',
      circuit: 'Primary Crusher',
      category: 'Mechanical',
      impactType: 'Full Stoppage',
      startTime: '08:00',
      reason: 'Bridge',
      correctiveAction: '',
    });
    expect(unauth.success).toBe(false);

    (getAuthenticatedEmployee as jest.Mock).mockResolvedValue({
      user: { id: 'u-1', email: 'operator@plantcor.co.za' },
      employee: { id: 'emp-1' },
    });

    const created = await logPlantDelayAction({
      date: '2026-10-22',
      shift: 'day',
      circuit: 'Primary Crusher',
      category: 'Mechanical',
      impactType: 'Full Stoppage',
      startTime: '08:00',
      reason: 'Oversize slab',
      correctiveAction: '',
    });
    expect(created.success).toBe(true);
    expect(created.entry.status).toBe('Active');
    expect(mock.insertDelayMock).toHaveBeenCalledTimes(1);

    const updated = await logPlantDelayAction({
      id: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-10-22',
      shift: 'day',
      circuit: 'Primary Crusher',
      category: 'Mechanical',
      impactType: 'Full Stoppage',
      startTime: '08:00',
      endTime: '08:45',
      durationMinutes: 45,
      reason: 'Oversize slab',
      correctiveAction: 'Cleared',
    });
    expect(updated.success).toBe(true);
    expect(updated.isUpdate).toBe(true);
    expect(updated.entry.status).toBe('Resolved');
    expect(mock.updateDelayEqMock).toHaveBeenCalledWith(
      'id',
      '550e8400-e29b-41d4-a716-446655440000'
    );
  });

  it('validates and inserts plant equipment via quickAddPlantEquipmentAction', async () => {
    const blank = await quickAddPlantEquipmentAction({ name: '   ' });
    expect(blank.success).toBe(false);

    const mock = buildWriteSupabaseMock();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mock.client);
    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce(null);

    const unauth = await quickAddPlantEquipmentAction({ name: 'Cone Crusher' });
    expect(unauth.success).toBe(false);

    (getAuthenticatedEmployee as jest.Mock).mockResolvedValueOnce({
      user: { id: 'u-1', email: 'operator@plantcor.co.za' },
      employee: { id: 'emp-1' },
    });

    const added = await quickAddPlantEquipmentAction({ name: 'Cone Crusher' });
    expect(added.success).toBe(true);
    expect(added.equipmentName).toBe('Cone Crusher');
    expect(mock.insertMachineMock).toHaveBeenCalledTimes(1);
  });
});
