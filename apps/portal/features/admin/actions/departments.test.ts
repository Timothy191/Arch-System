/**
 * @jest-environment node
 */

import { cacheInvalidateTags } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import { adminAddDepartment, adminArchiveDepartment } from './departments';

const mockAssertAdmin = jest.fn();
const mockLogAdminAuditEvent = jest.fn();

jest.mock('./shared', () => ({
  assertAdmin: () => mockAssertAdmin(),
  logAdminAuditEvent: (args: unknown) => mockLogAdminAuditEvent(args),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
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
    mockAssertAdmin.mockResolvedValue({
      userId: 'admin-u1',
      employee: { id: 'emp-1', role: 'admin' },
      supabase: { from: jest.fn(() => ({ insert })) },
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
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['table:departments']);
    expect(revalidatePath).toHaveBeenCalledWith('/admin');
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
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['table:departments']);
  });
});
