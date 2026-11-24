/**
 * @jest-environment node
 */

import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { adminSaveOperationalTargets, getOperationalTargets } from './targets';

const mockAssertAdmin = jest.fn();
const mockLogAdminAuditEvent = jest.fn();

jest.mock('./shared', () => ({
  assertAdmin: () => mockAssertAdmin(),
  logAdminAuditEvent: (args: unknown) => mockLogAdminAuditEvent(args),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient);

const VALID_TARGETS = {
  shift: {
    loadsTarget: 200,
    coalTonnesTarget: 5000,
    wasteTonnesTarget: 9000,
    volumeBcmTarget: 6000,
    smrHoursTarget: 100,
  },
  daily: {
    loadsTarget: 400,
    coalTonnesTarget: 10000,
    wasteTonnesTarget: 18000,
    volumeBcmTarget: 12000,
    smrHoursTarget: 200,
  },
  monthly: {
    loadsTarget: 12000,
    coalTonnesTarget: 300000,
    wasteTonnesTarget: 540000,
    volumeBcmTarget: 360000,
    smrHoursTarget: 6000,
  },
};

describe('Admin Operational Targets server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default operational targets on empty or invalid config rows', async () => {
    mockCreateServerSupabaseClient.mockResolvedValueOnce({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
      })),
    } as never);

    const defaults = await getOperationalTargets();
    expect(defaults.shift.loadsTarget).toBe(180);
  });

  it('inserts new targets and updates existing targets with audit log + cache invalidation', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockAssertAdmin.mockResolvedValueOnce({
      userId: 'u-adm',
      employee: { id: 'emp-1', role: 'admin' },
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null }),
            }),
          }),
          insert,
        })),
      },
    });

    const created = await adminSaveOperationalTargets(VALID_TARGETS);
    expect(created).toEqual({ success: true });
    expect(insert).toHaveBeenCalled();
    expect(mockLogAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', resource: 'operational_targets' })
    );

    const eqUpdate = jest.fn().mockResolvedValue({ error: null });
    mockAssertAdmin.mockResolvedValueOnce({
      userId: 'u-adm',
      employee: { id: 'emp-1', role: 'admin' },
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'tpl-targets-1' } }),
            }),
          }),
          update: jest.fn().mockReturnValue({ eq: eqUpdate }),
        })),
      },
    });

    const updated = await adminSaveOperationalTargets(VALID_TARGETS);
    expect(updated).toEqual({ success: true });
    expect(eqUpdate).toHaveBeenCalledWith('id', 'tpl-targets-1');
    expect(mockLogAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', resourceId: 'tpl-targets-1' })
    );
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['config:operational_targets']);
    expect(revalidatePath).toHaveBeenCalledWith('/control-room');
  });

  it('rejects invalid zero target payloads and non-admin callers', async () => {
    mockAssertAdmin.mockResolvedValueOnce({ error: 'Forbidden: admin role required', status: 403 });
    expect(await adminSaveOperationalTargets(VALID_TARGETS)).toEqual({
      error: 'Forbidden: admin role required',
    });

    mockAssertAdmin.mockResolvedValueOnce({
      userId: 'u-adm',
      employee: { id: 'emp-1', role: 'admin' },
      supabase: {},
    });
    const invalid = await adminSaveOperationalTargets({
      ...VALID_TARGETS,
      shift: { ...VALID_TARGETS.shift, loadsTarget: 0 },
    });
    expect(invalid.error).toContain('at least 1');
  });
});
