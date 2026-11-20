/**
 * @jest-environment node
 */

import {
  AuthError,
  DatabaseError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAuditEvent } from '@/lib/audit';
import { logTireActivity } from './actions';
import {
  buildTireActivityNote,
  classifyTireActivityType,
  TIRE_ACTIVITY_RATE_LIMIT,
} from './tire-constants';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(async () => undefined),
}));

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.Mock;
const mockGetAuthenticatedEmployee = getAuthenticatedEmployee as jest.Mock;
const mockCacheInvalidateTags = cacheInvalidateTags as jest.Mock;
const mockRevalidatePath = revalidatePath as jest.Mock;
const mockLogAuditEvent = logAuditEvent as jest.Mock;

interface SupabaseMockConfig {
  readonly machineName?: string;
  readonly updateTireError?: { message: string } | null;
  readonly insertTireId?: string;
  readonly insertTireError?: { message: string } | null;
  readonly insertInspectionError?: { message: string } | null;
}

function buildSupabaseMock(config: SupabaseMockConfig = {}) {
  const tireUpdates: Array<Record<string, unknown>> = [];
  const tireInserts: Array<Record<string, unknown>> = [];
  const inspectionInserts: Array<Record<string, unknown>> = [];

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'machines') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'm1', name: config.machineName ?? 'CAT 797F #12' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'tires') {
        return {
          update: jest.fn((payload: Record<string, unknown>) => {
            tireUpdates.push(payload);
            return {
              eq: jest.fn().mockResolvedValue({
                error: config.updateTireError ?? null,
              }),
            };
          }),
          insert: jest.fn((payload: Record<string, unknown>) => {
            tireInserts.push(payload);
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: config.insertTireError
                    ? null
                    : { id: config.insertTireId ?? 'new-tire-99' },
                  error: config.insertTireError ?? null,
                }),
              }),
            };
          }),
        };
      }

      if (table === 'tire_inspections') {
        return {
          insert: jest.fn((payload: Record<string, unknown>) => {
            inspectionInserts.push(payload);
            return Promise.resolve({
              error: config.insertInspectionError ?? null,
            });
          }),
        };
      }

      return {};
    }),
  };

  return { client, tireUpdates, tireInserts, inspectionInserts };
}

describe('logTireActivity server action & helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'user-eng-1' },
      employee: {
        id: 'emp-eng-1',
        role: 'engineering',
        department_id: 'dept-eng-1',
        accessible_departments: ['engineering'],
      },
    });
  });

  it('rejects unauthenticated requests with AuthError', async () => {
    const { client } = buildSupabaseMock();
    mockCreateServerSupabaseClient.mockResolvedValue(client);
    mockGetAuthenticatedEmployee.mockResolvedValue(null);

    await expect(
      logTireActivity({
        mode: 'remove',
        machineId: 'm1',
        position: 'Front Left',
        actionDate: '2026-11-20',
        machineHours: 1400,
        removedTireId: 't1',
        removedOutcome: 'inventory',
        conditionStatus: 'good',
      })
    ).rejects.toThrow(AuthError);
  });

  it('rejects unauthorized employees outside engineering/allowed roles with ForbiddenError', async () => {
    const { client } = buildSupabaseMock();
    mockCreateServerSupabaseClient.mockResolvedValue(client);
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'user-guest-1' },
      employee: {
        id: 'emp-guest-1',
        role: 'operator',
        department_id: 'dept-office-1',
        accessible_departments: ['office'],
      },
    });

    await expect(
      logTireActivity({
        mode: 'remove',
        machineId: 'm1',
        position: 'Front Left',
        actionDate: '2026-11-20',
        machineHours: 1400,
        removedTireId: 't1',
        removedOutcome: 'inventory',
        conditionStatus: 'good',
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('authorizes operator when accessible_departments includes engineering', async () => {
    const { client } = buildSupabaseMock();
    mockCreateServerSupabaseClient.mockResolvedValue(client);
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'user-op-eng' },
      employee: {
        id: 'emp-op-eng',
        role: 'operator',
        department_id: 'dept-eng-1',
        accessible_departments: ['engineering'],
      },
    });

    const result = await logTireActivity({
      mode: 'inspect',
      machineId: 'm1',
      position: 'Front Left',
      actionDate: '2026-11-20',
      machineHours: 1420,
      removedTireId: 't1',
      treadDepthMm: 34,
      pressurePsi: 108,
      conditionStatus: 'good',
    });

    expect(result.success).toBe(true);
    expect(result.inspectedTireId).toBe('t1');
  });

  it('validates schema constraints including rejecting normal conditionStatus and missing scrap reason', async () => {
    const { client } = buildSupabaseMock();
    mockCreateServerSupabaseClient.mockResolvedValue(client);

    await expect(
      logTireActivity({
        mode: 'remove',
        machineId: 'm1',
        position: 'Front Left',
        actionDate: '2026-11-20',
        machineHours: 1400,
        removedTireId: 't1',
        removedOutcome: 'scrapped',
        conditionStatus: 'good',
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      logTireActivity({
        mode: 'inspect',
        machineId: 'm1',
        position: 'Front Left',
        actionDate: '2026-11-20',
        machineHours: 1400,
        removedTireId: 't1',
        treadDepthMm: 28,
        pressurePsi: 105,
        conditionStatus: 'normal' as unknown as 'good',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('logs a full replacement with old tire removal + new tire registration + two inspection ledger entries', async () => {
    const { client, tireUpdates, tireInserts, inspectionInserts } = buildSupabaseMock({
      machineName: 'DT-04 Komatsu 730E',
      insertTireId: 't-new-404',
    });
    mockCreateServerSupabaseClient.mockResolvedValue(client);

    const result = await logTireActivity({
      mode: 'replace',
      machineId: 'm1',
      position: 'Rear Outer Left',
      actionDate: '2026-11-20',
      machineHours: 4820,
      removedTireId: 't1',
      removedOutcome: 'scrapped',
      removedReason: 'Sidewall rock cut',
      replacementSerial: 'TIRE-2026-888',
      replacementBrand: 'Michelin',
      replacementSize: '59/80R63',
      treadDepthMm: 46,
      pressurePsi: 112,
      conditionStatus: 'good',
      notes: 'Torqued lugs to spec',
    });

    expect(result).toEqual({
      success: true,
      mode: 'replace',
      removedTireId: 't1',
      installedTireId: 't-new-404',
      inspectedTireId: null,
      machineName: 'DT-04 Komatsu 730E',
    });

    expect(tireUpdates[0]).toMatchObject({
      status: 'scrapped',
      removed_at: '2026-11-20',
      removed_hours: 4820,
      scrapped_reason: 'Sidewall rock cut',
      machine_id: null,
    });

    expect(tireInserts[0]).toMatchObject({
      serial_number: 'TIRE-2026-888',
      brand: 'Michelin',
      size: '59/80R63',
      machine_id: 'm1',
      position: 'Rear Outer Left',
      status: 'installed',
      installed_at: '2026-11-20',
      installed_hours: 4820,
    });

    expect(inspectionInserts).toHaveLength(2);
    expect(String(inspectionInserts[0]?.notes)).toContain('[REMOVAL]');
    expect(String(inspectionInserts[0]?.notes)).toContain('DT-04 Komatsu 730E');
    expect(String(inspectionInserts[1]?.notes)).toContain('[REPLACEMENT]');
    expect(inspectionInserts[1]?.condition_status).toBe('good');

    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockCacheInvalidateTags).toHaveBeenCalledWith(['table:tires', 'table:tire_inspections']);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/engineering/tire-management');
  });

  it('installs an existing spare tire from inventory without inserting a duplicate tire row', async () => {
    const { client, tireUpdates, tireInserts, inspectionInserts } = buildSupabaseMock({
      machineName: 'DT-02',
    });
    mockCreateServerSupabaseClient.mockResolvedValue(client);

    const result = await logTireActivity({
      mode: 'install',
      machineId: 'm1',
      position: 'Front Right',
      actionDate: '2026-11-20',
      machineHours: 2300,
      existingSpareTireId: 't-spare-1',
      treadDepthMm: 38,
      pressurePsi: 110,
      conditionStatus: 'warning',
      notes: 'Mounted reconditioned spare',
    });

    expect(result.installedTireId).toBe('t-spare-1');
    expect(tireInserts).toHaveLength(0);
    expect(tireUpdates[0]).toMatchObject({
      machine_id: 'm1',
      position: 'Front Right',
      status: 'installed',
      installed_at: '2026-11-20',
      installed_hours: 2300,
    });
    expect(String(inspectionInserts[0]?.notes)).toContain('[INSTALLATION]');
  });

  it('throws DatabaseError when Supabase update or insert fails', async () => {
    const { client } = buildSupabaseMock({
      updateTireError: { message: 'RLS violation' },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(client);

    await expect(
      logTireActivity({
        mode: 'remove',
        machineId: 'm1',
        position: 'Front Left',
        actionDate: '2026-11-20',
        machineHours: 1400,
        removedTireId: 't1',
        removedOutcome: 'inventory',
        conditionStatus: 'good',
      })
    ).rejects.toThrow(DatabaseError);

    const { client: clientInspErr } = buildSupabaseMock({
      insertInspectionError: { message: 'check constraint failure' },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(clientInspErr);

    await expect(
      logTireActivity({
        mode: 'inspect',
        machineId: 'm1',
        position: 'Front Left',
        actionDate: '2026-11-20',
        machineHours: 1400,
        removedTireId: 't1',
        treadDepthMm: 10,
        pressurePsi: 95,
        conditionStatus: 'critical',
      })
    ).rejects.toThrow(DatabaseError);
  });

  it('enforces per-user rate limit on rapid consecutive requests', async () => {
    const { client } = buildSupabaseMock();
    mockCreateServerSupabaseClient.mockResolvedValue(client);
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'rate-limit-user' },
      employee: {
        id: 'emp-rl',
        role: 'admin',
        department_id: 'dept-eng-1',
        accessible_departments: ['engineering'],
      },
    });

    for (let i = 0; i < TIRE_ACTIVITY_RATE_LIMIT; i += 1) {
      await logTireActivity({
        mode: 'inspect',
        machineId: 'm1',
        position: 'Front Left',
        actionDate: '2026-11-20',
        machineHours: 1500 + i,
        removedTireId: 't1',
        treadDepthMm: 30,
        pressurePsi: 108,
        conditionStatus: 'good',
      });
    }

    await expect(
      logTireActivity({
        mode: 'inspect',
        machineId: 'm1',
        position: 'Front Left',
        actionDate: '2026-11-20',
        machineHours: 1600,
        removedTireId: 't1',
        treadDepthMm: 30,
        pressurePsi: 108,
        conditionStatus: 'good',
      })
    ).rejects.toThrow(RateLimitError);
  });

  it('formats and classifies activity notes accurately', () => {
    const removalNote = buildTireActivityNote({
      prefix: '[REMOVAL]',
      machineName: 'DT-01',
      position: 'Front Left',
      machineHours: 1200,
      outcome: 'inventory',
      reason: 'Scheduled rotation',
    });
    expect(removalNote).toContain('[REMOVAL] Machine: DT-01');
    expect(classifyTireActivityType(removalNote)).toBe('removal');
    expect(classifyTireActivityType('[REPLACEMENT] Machine: DT-01')).toBe('replacement');
    expect(classifyTireActivityType('[INSTALLATION] Machine: DT-01')).toBe('installation');
    expect(classifyTireActivityType('Routine check')).toBe('inspection');
  });
});
