'use server';

import {
  adminAddDepartmentSchema,
  adminArchiveDepartmentSchema,
} from '@repo/contract/schemas/admin.schema';
import { cacheInvalidateTags } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import { assertAdmin, logAdminAuditEvent } from './shared';

export interface AdminDepartmentRecord {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_at: string | null;
}

function buildDepartmentSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function adminAddDepartment(rawInput: { display_name: string; name?: string }) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parseResult = adminAddDepartmentSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid department name' };
  }

  const displayName = parseResult.data.display_name.trim();
  const slug = parseResult.data.name
    ? buildDepartmentSlug(parseResult.data.name)
    : buildDepartmentSlug(displayName);
  if (!slug) {
    return { error: 'Department name must contain alphanumeric characters' };
  }

  const { supabase, userId } = auth;
  const { data: created, error } = await supabase
    .from('departments')
    .insert({
      name: slug,
      display_name: displayName,
      color: 'slate',
      icon: 'Building2',
    })
    .select('id, name, display_name, description, color, icon, created_at')
    .single();

  if (error || !created) {
    return { error: error?.message || 'Failed to create department' };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'create',
    resource: 'departments',
    resourceId: created.id,
    metadata: { name: created.name, display_name: created.display_name },
  });

  await cacheInvalidateTags(['table:departments']);
  revalidatePath('/admin');
  return { success: true as const, department: created as AdminDepartmentRecord };
}

export async function adminArchiveDepartment(id: string) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parseResult = adminArchiveDepartmentSchema.safeParse({ id });
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid department ID' };
  }

  const { supabase, userId } = auth;
  const { error } = await supabase
    .from('departments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parseResult.data.id);

  if (error) {
    return { error: error.message || 'Failed to archive department' };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'archive',
    resource: 'departments',
    resourceId: parseResult.data.id,
  });

  await cacheInvalidateTags(['table:departments']);
  revalidatePath('/admin');
  return { success: true as const };
}
