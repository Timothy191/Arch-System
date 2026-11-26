'use server';

import {
  type AdminPortalSettings,
  adminCardTemplateIdSchema,
  adminCardTemplateUploadSchema,
  adminPortalSettingsSchema,
} from '@repo/contract/schemas/admin.schema';
import { logger } from '@repo/logger/server';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  AuthError,
  DatabaseError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/error-classes';
import { updateTags } from '@/lib/server-cache';
import { assertAdmin, logAdminAuditEvent } from './shared';

const MAX_TEMPLATE_FILE_BYTES = 5_242_880;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const CARD_TEMPLATES_BUCKET = 'card-templates';

const ALLOWED_CARD_TEMPLATE_MIME_TYPES: Record<string, 'png' | 'jpg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface AdminCardTemplateItem {
  id: string;
  name: string;
  background: string | null;
  is_default: boolean | null;
  created_at: string | null;
}

const DEFAULT_PORTAL_SETTINGS: AdminPortalSettings = adminPortalSettingsSchema.parse({});

function extractStoragePathFromUrl(backgroundUrl: string | null | undefined): string | null {
  if (!backgroundUrl) return null;
  const trimmed = backgroundUrl.trim();
  if (!trimmed) return null;

  const marker = `/${CARD_TEMPLATES_BUCKET}/`;
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex !== -1) {
    const rawKey = trimmed.slice(markerIndex + marker.length).split('?')[0];
    return rawKey ? decodeURIComponent(rawKey) : null;
  }

  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return null;
}

async function removeTemplateStorageObject(
  supabase: {
    storage?: {
      from?: (bucket: string) => {
        remove?: (paths: string[]) => Promise<{ error?: { message: string } | null }>;
      };
    };
  },
  objectKey: string | null
): Promise<void> {
  if (!objectKey) return;
  const bucket = supabase.storage?.from?.(CARD_TEMPLATES_BUCKET);
  if (typeof bucket?.remove === 'function') {
    try {
      const result = await bucket.remove([objectKey]);
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        logger.warn({
          event: 'card_template_storage_remove_failed',
          objectKey,
          error: result.error.message,
        });
      }
    } catch (err) {
      logger.warn({
        event: 'card_template_storage_remove_exception',
        objectKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function listCardTemplates(): Promise<{
  templates: AdminCardTemplateItem[];
  error?: string;
}> {
  try {
    const auth = await assertAdmin();
    if ('error' in auth) {
      return { templates: [], error: auth.error };
    }

    const { supabase } = auth;
    const { data, error } = await supabase
      .from('card_templates')
      .select('id, name, background, is_default, created_at')
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { templates: [], error: error.message || 'Failed to load card templates' };
    }
    return { templates: (data ?? []) as AdminCardTemplateItem[] };
  } catch {
    return { templates: [], error: 'Failed to load card templates' };
  }
}

export async function uploadCardTemplate(formData: FormData) {
  const auth = await assertAdmin();
  if ('error' in auth) {
    const errorMessage = auth.error ?? 'Rate limit exceeded';
    if (auth.status === HTTP_UNAUTHORIZED) throw new AuthError(errorMessage);
    if (auth.status === HTTP_FORBIDDEN) throw new ForbiddenError(errorMessage);
    throw new RateLimitError(errorMessage);
  }

  const rawName = typeof formData.get('name') === 'string' ? (formData.get('name') as string) : '';
  const isDefaultRaw = formData.get('isDefault') === 'true';
  const parsed = adminCardTemplateUploadSchema.safeParse({
    name: rawName,
    isDefault: isDefaultRaw,
  });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Template name is required');
  }

  const rawFile = formData.get('background');
  if (!rawFile || typeof rawFile !== 'object' || !('type' in rawFile) || !('size' in rawFile)) {
    throw new ValidationError('Background image file is required');
  }
  const file = rawFile as File;
  const fileExt = ALLOWED_CARD_TEMPLATE_MIME_TYPES[file.type];
  if (!fileExt) {
    throw new ValidationError('Unsupported file type. Allowed formats: PNG, JPEG, or WebP');
  }
  if (file.size <= 0 || file.size > MAX_TEMPLATE_FILE_BYTES) {
    throw new ValidationError('Template image must be between 1 byte and 5 MB');
  }

  const { supabase, userId } = auth;
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(CARD_TEMPLATES_BUCKET)
    .upload(fileName, file);

  if (uploadError) {
    throw new DatabaseError(`Failed to upload background: ${uploadError.message}`, {
      cause: uploadError,
    });
  }

  const { data: publicUrlData } = supabase.storage
    .from(CARD_TEMPLATES_BUCKET)
    .getPublicUrl(fileName);
  const backgroundUrl = publicUrlData.publicUrl;

  if (parsed.data.isDefault) {
    const { error: clearDefaultErr } = await supabase
      .from('card_templates')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('is_default', true);

    if (clearDefaultErr) {
      await removeTemplateStorageObject(supabase, fileName);
      throw new DatabaseError(
        `Failed to reset previous default template: ${clearDefaultErr.message}`,
        { cause: clearDefaultErr }
      );
    }
  }

  const { data: inserted, error: dbError } = await supabase
    .from('card_templates')
    .insert({
      name: parsed.data.name,
      background: backgroundUrl,
      is_default: parsed.data.isDefault,
    })
    .select('id, name, background, is_default, created_at')
    .maybeSingle();

  if (dbError) {
    await removeTemplateStorageObject(supabase, fileName);
    throw new DatabaseError('Failed to save card template', { cause: dbError });
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'create',
    resource: 'card_templates',
    resourceId: inserted?.id ?? null,
    metadata: { name: parsed.data.name, isDefault: parsed.data.isDefault, mimeType: file.type },
  });

  await updateTags(['table:card_templates']);
  revalidatePath('/admin');
  revalidatePath('/access-control/card-actions');
  return { success: true as const, template: (inserted as AdminCardTemplateItem | null) ?? null };
}

export async function setDefaultCardTemplate(id: string) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parsed = adminCardTemplateIdSchema.safeParse({ id });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid template ID' };
  }

  const { supabase, userId } = auth;
  const nowIso = new Date().toISOString();

  const { error: setTargetErr } = await supabase
    .from('card_templates')
    .update({ is_default: true, updated_at: nowIso })
    .eq('id', parsed.data.id);

  if (setTargetErr) {
    return { error: setTargetErr.message || 'Failed to set default card template' };
  }

  const { error: clearOthersErr } = await supabase
    .from('card_templates')
    .update({ is_default: false, updated_at: nowIso })
    .neq('id', parsed.data.id);

  if (clearOthersErr) {
    return {
      error: clearOthersErr.message || 'Failed to clear previous default card template',
    };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'set_default',
    resource: 'card_templates',
    resourceId: parsed.data.id,
  });

  await updateTags(['table:card_templates']);
  revalidatePath('/admin');
  revalidatePath('/access-control/card-actions');
  return { success: true as const };
}

export async function deleteCardTemplate(id: string) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parsed = adminCardTemplateIdSchema.safeParse({ id });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid template ID' };
  }

  const { supabase, userId } = auth;

  let existingBackground: string | null = null;
  const templatesTable = supabase.from('card_templates');
  if (typeof templatesTable.select === 'function') {
    const selectRes = templatesTable.select('background');
    if (selectRes && typeof (selectRes as { eq?: unknown }).eq === 'function') {
      const eqRes = (
        selectRes as unknown as {
          eq: (
            col: string,
            val: string
          ) => { maybeSingle?: () => Promise<{ data?: { background?: string | null } | null }> };
        }
      ).eq('id', parsed.data.id);
      if (typeof eqRes?.maybeSingle === 'function') {
        const { data: row } = await eqRes.maybeSingle();
        existingBackground = row?.background ?? null;
      }
    }
  }

  const { error } = await supabase
    .from('card_templates')
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq('id', parsed.data.id);

  if (error) {
    return { error: error.message || 'Failed to remove card template' };
  }

  const storagePath = extractStoragePathFromUrl(existingBackground);
  await removeTemplateStorageObject(supabase, storagePath);

  logAdminAuditEvent({
    actorId: userId,
    action: 'delete',
    resource: 'card_templates',
    resourceId: parsed.data.id,
  });

  await updateTags(['table:card_templates']);
  revalidatePath('/admin');
  revalidatePath('/access-control/card-actions');
  return { success: true as const };
}

/**
 * Public-authenticated cached reader for global portal & shift configuration.
 * Safe for all signed-in portal layouts and department utilities (does NOT require admin role).
 */
export async function getActivePortalSettings(): Promise<AdminPortalSettings> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return DEFAULT_PORTAL_SETTINGS;
    }

    let query = supabase
      .from('report_templates')
      .select('config')
      .eq('report_type', 'portal_settings');
    if (typeof (query as { is?: unknown }).is === 'function') {
      query = (query as unknown as { is: (col: string, val: null) => typeof query }).is(
        'deleted_at',
        null
      );
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data?.config && typeof data.config === 'object') {
      const parsed = adminPortalSettingsSchema.safeParse(data.config);
      if (parsed.success) {
        return parsed.data;
      }
    }
  } catch {
    // Fall back to canonical industrial defaults if auth cookies or table are unavailable
  }
  return DEFAULT_PORTAL_SETTINGS;
}

/**
 * Load Global Portal & Shift Configuration from `report_templates` (`report_type = 'portal_settings'`).
 */
export async function getPortalSettings(): Promise<{
  settings: AdminPortalSettings;
  error?: string;
}> {
  const auth = await assertAdmin();
  if ('error' in auth) {
    return { settings: DEFAULT_PORTAL_SETTINGS, error: auth.error };
  }

  const { supabase } = auth;
  let query = supabase
    .from('report_templates')
    .select('config')
    .eq('report_type', 'portal_settings');
  if (typeof (query as { is?: unknown }).is === 'function') {
    query = (query as unknown as { is: (col: string, val: null) => typeof query }).is(
      'deleted_at',
      null
    );
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return {
      settings: DEFAULT_PORTAL_SETTINGS,
      error: error.message || 'Failed to load portal settings',
    };
  }

  if (data?.config && typeof data.config === 'object') {
    const parsed = adminPortalSettingsSchema.safeParse(data.config);
    if (parsed.success) {
      return { settings: parsed.data };
    }
  }

  return { settings: DEFAULT_PORTAL_SETTINGS };
}

/**
 * Persist Global Portal & Shift Configuration into `report_templates` (`report_type = 'portal_settings'`).
 */
export async function savePortalSettings(rawInput: AdminPortalSettings) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parsed = adminPortalSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid portal settings payload' };
  }

  const config = parsed.data;
  const { supabase, userId } = auth;

  let existingQuery = supabase
    .from('report_templates')
    .select('id')
    .eq('report_type', 'portal_settings');
  if (typeof (existingQuery as { is?: unknown }).is === 'function') {
    existingQuery = (
      existingQuery as unknown as { is: (col: string, val: null) => typeof existingQuery }
    ).is('deleted_at', null);
  }
  const { data: existing, error: lookupError } = await existingQuery.maybeSingle();

  if (lookupError) {
    return { error: lookupError.message || 'Failed to inspect portal settings' };
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('report_templates')
      .update({
        config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      return { error: error.message || 'Failed to update portal settings' };
    }
  } else {
    const { error } = await supabase.from('report_templates').insert({
      name: 'Global Portal & Shift Settings',
      description:
        'Shift start hours, site timezone, session idle warning threshold, and operational notice banner',
      report_type: 'portal_settings',
      config,
    });

    if (error) {
      return { error: error.message || 'Failed to save portal settings' };
    }
  }

  logAdminAuditEvent({
    actorId: userId,
    action: existing?.id ? 'update' : 'create',
    resource: 'portal_settings',
    resourceId: existing?.id ?? null,
    metadata: {
      dayShiftStart: config.dayShiftStart,
      nightShiftStart: config.nightShiftStart,
      siteTimezone: config.siteTimezone,
      operationalNoticeActive: config.operationalNoticeActive,
    },
  });

  await updateTags(['config:portal_settings']);
  revalidatePath('/admin');
  revalidatePath('/hub');
  revalidatePath('/control-room');
  return { success: true as const, settings: config };
}
