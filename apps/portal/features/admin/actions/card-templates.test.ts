/**
 * @jest-environment node
 */

import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  deleteCardTemplate,
  listCardTemplates,
  setDefaultCardTemplate,
  uploadCardTemplate,
} from './card-templates';

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

describe('Admin Card Templates server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists active templates for admin users and blocks non-admins', async () => {
    mockCreateServerSupabaseClient.mockResolvedValueOnce({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u-op' } } }) },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'operator' } }),
          }),
        }),
      })),
    } as never);

    const forbidden = await listCardTemplates();
    expect(forbidden.error).toContain('Forbidden');
    expect(forbidden.templates).toEqual([]);

    const order2 = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'tpl-1',
          name: 'Standard 2026',
          background: 'https://img/a.png',
          is_default: true,
          created_at: null,
        },
      ],
      error: null,
    });
    const order1 = jest.fn().mockReturnValue({ order: order2 });
    const isFn = jest.fn().mockReturnValue({ order: order1 });
    mockCreateServerSupabaseClient.mockResolvedValueOnce({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u-adm' } } }) },
      from: jest.fn((table: string) =>
        table === 'employees'
          ? {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }),
                }),
              }),
            }
          : {
              select: jest.fn().mockReturnValue({ is: isFn }),
            }
      ),
    } as never);

    const ok = await listCardTemplates();
    expect(ok.error).toBeUndefined();
    expect(ok.templates).toHaveLength(1);
    expect(ok.templates[0]?.name).toBe('Standard 2026');
  });

  it('validates MIME type and file size <= 5MB before storage upload', async () => {
    mockAssertAdmin.mockResolvedValue({
      userId: 'u-adm',
      employee: { id: 'e-adm', role: 'admin' },
      supabase: {},
    });

    const badMimeForm = new FormData();
    badMimeForm.set('name', 'Malicious SVG');
    badMimeForm.set('background', new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' }));
    await expect(uploadCardTemplate(badMimeForm)).rejects.toThrow(/Unsupported file type/);

    const hugeFile = new File([new Uint8Array(5_242_881)], 'huge.png', { type: 'image/png' });
    const bigForm = new FormData();
    bigForm.set('name', 'Oversized PNG');
    bigForm.set('background', hugeFile);
    await expect(uploadCardTemplate(bigForm)).rejects.toThrow(/5 MB/);
  });

  it('uploads valid PNG template, writes audit log, and supports setDefault & delete', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: 'https://cdn.example/card-templates/tpl.png' },
    });
    const neq = jest.fn().mockResolvedValue({ error: null });
    const eq = jest.fn().mockResolvedValue({ error: null });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'tpl-2',
        name: 'Contractor Card',
        background: 'https://cdn.example/card-templates/tpl.png',
        is_default: true,
        created_at: null,
      },
      error: null,
    });

    mockAssertAdmin.mockResolvedValue({
      userId: 'u-adm',
      employee: { id: 'e-adm', role: 'admin' },
      supabase: {
        storage: { from: jest.fn(() => ({ upload, getPublicUrl })) },
        from: jest.fn(() => ({
          update: jest.fn(() => ({ neq, eq })),
          insert: jest.fn(() => ({ select: jest.fn(() => ({ maybeSingle })) })),
        })),
      },
    });

    const form = new FormData();
    form.set('name', 'Contractor Card');
    form.set('isDefault', 'true');
    form.set('background', new File(['png-bytes'], 'card.png', { type: 'image/png' }));

    const uploaded = await uploadCardTemplate(form);
    expect(uploaded.success).toBe(true);
    expect(mockLogAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', resource: 'card_templates', resourceId: 'tpl-2' })
    );
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['table:card_templates']);
    expect(revalidatePath).toHaveBeenCalledWith('/access-control/card-actions');

    const defaulted = await setDefaultCardTemplate('tpl-2');
    expect(defaulted).toEqual({ success: true });
    expect(mockLogAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'set_default', resourceId: 'tpl-2' })
    );

    const removed = await deleteCardTemplate('tpl-2');
    expect(removed).toEqual({ success: true });
    expect(mockLogAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', resourceId: 'tpl-2' })
    );
  });
});
