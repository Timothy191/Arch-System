'use server';

import {
  adminCardTemplateIdSchema,
  adminCardTemplateUploadSchema,
} from '@repo/contract/schemas/admin.schema';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  AuthError,
  DatabaseError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/error-classes';
import { assertAdmin, logAdminAuditEvent } from './shared';

const MAX_TEMPLATE_FILE_BYTES = 5_242_880;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const ZERO_SENTINEL_UUID = '00000000-0000-0000-0000-000000000000';

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

export async function listCardTemplates(): Promise<{
  templates: AdminCardTemplateItem[];
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { templates: [], error: 'Unauthorized' };

    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_id', user.id)
      .single();
    if (employee?.role !== 'admin') {
      return { templates: [], error: 'Forbidden: admin role required' };
    }

    const { data, error } = await supabase
      .from('card_templates')
      .select('id, name, background, is_default, created_at')
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { templates: [], error: 'Failed to load card templates' };
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
    .from('card-templates')
    .upload(fileName, file);

  if (uploadError) {
    throw new DatabaseError(`Failed to upload background: ${uploadError.message}`, {
      cause: uploadError,
    });
  }

  const { data: publicUrlData } = supabase.storage.from('card-templates').getPublicUrl(fileName);
  const backgroundUrl = publicUrlData.publicUrl;

  if (parsed.data.isDefault) {
    await supabase
      .from('card_templates')
      .update({ is_default: false })
      .neq('id', ZERO_SENTINEL_UUID);
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
    throw new DatabaseError('Failed to save card template', { cause: dbError });
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'create',
    resource: 'card_templates',
    resourceId: inserted?.id ?? null,
    metadata: { name: parsed.data.name, isDefault: parsed.data.isDefault, mimeType: file.type },
  });

  await cacheInvalidateTags(['table:card_templates']);
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
  await supabase.from('card_templates').update({ is_default: false }).neq('id', ZERO_SENTINEL_UUID);

  const { error } = await supabase
    .from('card_templates')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id);

  if (error) {
    return { error: 'Failed to set default card template' };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'set_default',
    resource: 'card_templates',
    resourceId: parsed.data.id,
  });

  await cacheInvalidateTags(['table:card_templates']);
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
  const { error } = await supabase
    .from('card_templates')
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq('id', parsed.data.id);

  if (error) {
    return { error: 'Failed to remove card template' };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'delete',
    resource: 'card_templates',
    resourceId: parsed.data.id,
  });

  await cacheInvalidateTags(['table:card_templates']);
  revalidatePath('/admin');
  revalidatePath('/access-control/card-actions');
  return { success: true as const };
}
