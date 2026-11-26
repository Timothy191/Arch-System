/**
 * @jest-environment node
 */

import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
import {
  deleteCardTemplate,
  getPortalSettings,
  listCardTemplates,
  savePortalSettings,
  setDefaultCardTemplate,
  uploadCardTemplate,
} from './card-templates';

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

describe('Admin Card Templates & Portal Settings server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists active templates via assertAdmin and blocks non-admins', async () => {
    mockAssertAdmin.mockResolvedValueOnce({
      error: 'Forbidden: admin role required',
      status: 403,
    });

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

    mockAssertAdmin.mockResolvedValueOnce({
      userId: 'u-adm',
      employee: { id: 'e-adm', role: 'admin' },
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({ is: isFn }),
        })),
      },
    });

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

  it('uploads valid PNG template, cleans up storage on DB failure or delete, and supports setDefault', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const remove = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: 'https://cdn.example/storage/v1/object/public/card-templates/tpl.png' },
    });
    const neq = jest.fn().mockResolvedValue({ error: null });
    const eq = jest.fn().mockResolvedValue({ error: null });
    const selectEqMaybeSingle = jest.fn().mockResolvedValue({
      data: { background: 'https://cdn.example/storage/v1/object/public/card-templates/tpl.png' },
      error: null,
    });
    const maybeSingle = jest.fn().mockResolvedValueOnce({
      data: {
        id: 'tpl-2',
        name: 'Contractor Card',
        background: 'https://cdn.example/storage/v1/object/public/card-templates/tpl.png',
        is_default: true,
        created_at: null,
      },
      error: null,
    });

    mockAssertAdmin.mockResolvedValue({
      userId: 'u-adm',
      employee: { id: 'e-adm', role: 'admin' },
      supabase: {
        storage: { from: jest.fn(() => ({ upload, remove, getPublicUrl })) },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ maybeSingle: selectEqMaybeSingle })),
          })),
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
    expect(updateTags).toHaveBeenCalledWith(['table:card_templates']);
    expect(revalidatePath).toHaveBeenCalledWith('/access-control/card-actions');

    const defaulted = await setDefaultCardTemplate('tpl-2');
    expect(defaulted).toEqual({ success: true });

    const removed = await deleteCardTemplate('tpl-2');
    expect(removed).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith(['tpl.png']);

    // Verify DB insert failure cleans up storage object
    maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'db write error' },
    });
    await expect(uploadCardTemplate(form)).rejects.toThrow(/Failed to save card template/);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('loads and saves Global Portal & Shift settings in report_templates', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockAssertAdmin.mockResolvedValue({
      userId: 'u-adm',
      employee: { id: 'e-adm', role: 'admin' },
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
          insert,
        })),
      },
    });

    const loaded = await getPortalSettings();
    expect(loaded.settings.dayShiftStart).toBe('06:00');
    expect(loaded.settings.siteTimezone).toBe('Africa/Johannesburg');

    const saved = await savePortalSettings({
      dayShiftStart: '06:30',
      nightShiftStart: '18:30',
      shiftDurationHours: 12,
      siteTimezone: 'Africa/Johannesburg',
      sessionIdleWarningMinutes: 45,
      operationalNoticeBanner: 'Blast scheduled at 15:00',
      operationalNoticeActive: true,
    });
    expect(saved).toMatchObject({ success: true });
    expect(insert).toHaveBeenCalled();
    expect(updateTags).toHaveBeenCalledWith(['config:portal_settings']);
  });
});
