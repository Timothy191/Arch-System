'use server';

import {
  type AdminUpdateDepartmentInput,
  adminAddDepartmentSchema,
  adminArchiveDepartmentSchema,
  adminUpdateDepartmentSchema,
} from '@repo/contract/schemas/admin.schema';
import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
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

const DEPARTMENT_SELECT_COLUMNS =
  'id, name, display_name, description, color, icon, created_at' as const;

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

  const existingLookup = supabase.from('departments');
  if (typeof existingLookup.select === 'function') {
    const { data: existingDept, error: lookupError } = await existingLookup
      .select('id, name, display_name, deleted_at')
      .eq('name', slug)
      .maybeSingle();

    if (lookupError) {
      return { error: lookupError.message || 'Failed to inspect existing department' };
    }

    if (existingDept && !existingDept.deleted_at) {
      return { error: `Department "${displayName}" already exists` };
    }

    if (existingDept?.deleted_at) {
      const { data: reactivated, error: reactivateError } = await supabase
        .from('departments')
        .update({
          display_name: displayName,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDept.id)
        .select(DEPARTMENT_SELECT_COLUMNS)
        .single();

      if (reactivateError || !reactivated) {
        return { error: reactivateError?.message || 'Failed to reactivate archived department' };
      }

      logAdminAuditEvent({
        actorId: userId,
        action: 'reactivate',
        resource: 'departments',
        resourceId: reactivated.id,
        metadata: { name: reactivated.name, display_name: reactivated.display_name },
      });

      await updateTags(['table:departments']);
      revalidatePath('/admin');
      return {
        success: true as const,
        department: reactivated as AdminDepartmentRecord,
        reactivated: true as const,
      };
    }
  }

  const { data: created, error } = await supabase
    .from('departments')
    .insert({
      name: slug,
      display_name: displayName,
      color: 'slate',
      icon: 'Building2',
    })
    .select(DEPARTMENT_SELECT_COLUMNS)
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

  await updateTags(['table:departments']);
  revalidatePath('/admin');
  return { success: true as const, department: created as AdminDepartmentRecord };
}

export async function adminUpdateDepartment(rawInput: AdminUpdateDepartmentInput) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parseResult = adminUpdateDepartmentSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid department update data' };
  }

  const { id, display_name, description, color, icon } = parseResult.data;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (display_name !== undefined) patch.display_name = display_name.trim();
  if (description !== undefined) patch.description = description?.trim() || null;
  if (color !== undefined) patch.color = color.trim();
  if (icon !== undefined) patch.icon = icon.trim();

  const { supabase, userId } = auth;
  const { data: updated, error } = await supabase
    .from('departments')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select(DEPARTMENT_SELECT_COLUMNS)
    .single();

  if (error || !updated) {
    return { error: error?.message || 'Failed to update department' };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: 'update',
    resource: 'departments',
    resourceId: id,
    metadata: { display_name: updated.display_name, color: updated.color, icon: updated.icon },
  });

  await updateTags(['table:departments']);
  revalidatePath('/admin');
  return { success: true as const, department: updated as AdminDepartmentRecord };
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
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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

  await updateTags(['table:departments']);
  revalidatePath('/admin');
  return { success: true as const };
}
