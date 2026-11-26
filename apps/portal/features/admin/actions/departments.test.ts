/**
 * @jest-environment node
 */

import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
import { adminAddDepartment, adminArchiveDepartment, adminUpdateDepartment } from './departments';

const mockAssertAdmin = jest.fn();
const mockLogAdminAuditEvent = jest.fn();

jest.mock('./shared', () => ({
  assertAdmin: () => mockAssertAdmin(),
  logAdminAuditEvent: (args: unknown) => mockLogAdminAuditEvent(args),
}));

jest.mock('@/lib/server-cache', () => ({
  updateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Admin Departments server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-admin callers cleanly', async () => {
    mockAssertAdmin.mockResolvedValueOnce({ error: 'Forbidden: admin role required', status: 403 });
    expect(await adminAddDepartment({ display_name: 'Geology' })).toEqual({
      error: 'Forbidden: admin role required',
    });

    mockAssertAdmin.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    expect(await adminArchiveDepartment('dept-1')).toEqual({ error: 'Unauthorized' });
  });

  it('validates input and creates a normalized slug department with audit log & cache invalidation', async () => {
    const single = jest.fn().mockResolvedValue({
      data: {
        id: 'dept-geo',
        name: 'geology-survey',
        display_name: 'Geology & Survey',
        description: null,
        color: 'slate',
        icon: 'Building2',
        created_at: '2026-11-24T08:00:00Z',
      },
      error: null,
    });
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ single }),
    });
    const selectExisting = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    mockAssertAdmin.mockResolvedValue({
      userId: 'admin-u1',
      employee: { id: 'emp-1', role: 'admin' },
      supabase: { from: jest.fn(() => ({ select: selectExisting, insert })) },
    });

    const invalid = await adminAddDepartment({ display_name: '   ' });
    expect(invalid).toEqual({ error: 'Department name is required' });

    const created = await adminAddDepartment({ display_name: 'Geology & Survey' });
    expect(created).toEqual({
      success: true,
      department: expect.objectContaining({
        id: 'dept-geo',
        name: 'geology-survey',
        display_name: 'Geology & Survey',
      }),
    });
    expect(mockLogAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-u1',
        action: 'create',
        resource: 'departments',
        resourceId: 'dept-geo',
      })
    );
    expect(updateTags).toHaveBeenCalledWith(['table:departments']);
    expect(revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('reactivates a soft-deleted department slug cleanly on re-create and supports adminUpdateDepartment', async () => {
    const reactivatedRow = {
      id: 'dept-geo',
      name: 'geology-survey',
      display_name: 'Geology & Survey',
      description: 'Restored division',
      color: 'emerald',
      icon: 'Layers',
      created_at: '2026-11-24T08:00:00Z',
    };
    const updateSelectSingle = jest.fn().mockResolvedValue({ data: reactivatedRow, error: null });

    mockAssertAdmin.mockResolvedValueOnce({
      userId: 'admin-u1',
      employee: { id: 'emp-1', role: 'admin' },
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: 'dept-geo',
                  name: 'geology-survey',
                  display_name: 'Geology',
                  deleted_at: '2026-11-20T00:00:00Z',
                },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({ single: updateSelectSingle }),
            }),
          }),
        })),
      },
    });

    const reactivated = await adminAddDepartment({ display_name: 'Geology & Survey' });
    expect(reactivated).toMatchObject({
      success: true,
      reactivated: true,
      department: expect.objectContaining({ id: 'dept-geo' }),
    });

    mockAssertAdmin.mockResolvedValueOnce({
      userId: 'admin-u1',
      employee: { id: 'emp-1', role: 'admin' },
      supabase: {
        from: jest.fn(() => ({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({ single: updateSelectSingle }),
              }),
            }),
          }),
        })),
      },
    });

    const updated = await adminUpdateDepartment({
      id: 'dept-geo',
      display_name: 'Geology & Survey',
      description: 'Restored division',
      color: 'emerald',
      icon: 'Layers',
    });
    expect(updated).toMatchObject({
      success: true,
      department: expect.objectContaining({ color: 'emerald' }),
    });
  });

  it('archives a department via soft-delete with audit logging', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    mockAssertAdmin.mockResolvedValueOnce({
      userId: 'admin-u1',
      employee: { id: 'emp-1', role: 'admin' },
      supabase: { from: jest.fn(() => ({ update })) },
    });

    const res = await adminArchiveDepartment('dept-geo');
    expect(res).toEqual({ success: true });
    expect(eq).toHaveBeenCalledWith('id', 'dept-geo');
    expect(mockLogAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-u1',
        action: 'archive',
        resource: 'departments',
        resourceId: 'dept-geo',
      })
    );
    expect(updateTags).toHaveBeenCalledWith(['table:departments']);
  });
});
