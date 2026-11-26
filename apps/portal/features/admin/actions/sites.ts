'use server';

import {
  adminAddMineBlockSchema,
  adminAddSiteSchema,
  adminUpdateMineBlockSchema,
  adminUpdateSiteSchema,
} from '@repo/contract/schemas/admin.schema';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { updateTags } from '@/lib/server-cache';
import { assertAdmin, logAdminAuditEvent } from './shared';

const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';
const siteUuidSchema = z.string().uuid('Invalid site ID format');
const blockUuidSchema = z.string().uuid('Invalid mine block ID format');

function buildSiteCode(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w.slice(0, 4))
      .join('-')
      .slice(0, 20);
  }
  return (words[0] || 'SITE').slice(0, 12);
}

export async function adminAddSite(rawInput: {
  name: string;
  site_code?: string;
  active?: boolean;
}) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const normalizedInput = {
    ...rawInput,
    site_code: rawInput.site_code?.trim() || buildSiteCode(rawInput.name || ''),
  };
  const parseResult = adminAddSiteSchema.safeParse(normalizedInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid site data' };
  }
  const data = parseResult.data;

  const { supabase, userId } = auth;

  const name = data.name.trim();
  const siteCode = data.site_code.trim().toUpperCase();

  const { error } = await supabase.from('sites').insert({
    name,
    site_code: siteCode,
    active: data.active ?? true,
  });

  if (error) return { error: error.message || 'Failed to add site' };

  logAdminAuditEvent({
    actorId: userId,
    action: 'create',
    resource: 'sites',
    metadata: { name, site_code: siteCode },
  });

  await updateTags(['table:sites']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true as const };
}

export async function adminDeleteSite(id: string) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const idParse = siteUuidSchema.safeParse(id.trim());
  if (!idParse.success) {
    return { error: idParse.error.issues[0]?.message || 'Invalid site ID format' };
  }
  const validId = idParse.data;

  const { supabase, userId } = auth;

  let resolution: 'deleted' | 'deactivated' = 'deleted';
  const { error } = await supabase.from('sites').delete().eq('id', validId);
  if (error) {
    if (error.code !== POSTGRES_FOREIGN_KEY_VIOLATION) {
      return { error: error.message || 'Failed to remove site' };
    }
    resolution = 'deactivated';
    const { error: updateErr } = await supabase
      .from('sites')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', validId);
    if (updateErr) return { error: updateErr.message || 'Failed to deactivate referenced site' };
  }

  logAdminAuditEvent({
    actorId: userId,
    action: resolution === 'deleted' ? 'delete' : 'deactivate',
    resource: 'sites',
    resourceId: validId,
  });

  await updateTags(['table:sites']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true as const, resolution };
}

export async function adminUpdateSite(
  id: string,
  rawInput: {
    name?: string;
    site_code?: string;
    active?: boolean;
  }
) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const idParse = siteUuidSchema.safeParse(id.trim());
  if (!idParse.success) {
    return { error: idParse.error.issues[0]?.message || 'Invalid site ID format' };
  }
  const validId = idParse.data;

  const parseResult = adminUpdateSiteSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid site data' };
  }
  const data = parseResult.data;

  const { supabase, userId } = auth;

  const name = data.name?.trim();
  const siteCode = data.site_code?.trim().toUpperCase();
  if (name !== undefined && !name) return { error: 'Site name cannot be empty.' };
  if (siteCode !== undefined && !siteCode) return { error: 'Site code cannot be empty.' };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) patch.name = name;
  if (siteCode !== undefined) patch.site_code = siteCode;
  if (data.active !== undefined) patch.active = data.active;

  const { error } = await supabase.from('sites').update(patch).eq('id', validId);

  if (error) return { error: error.message || 'Failed to update site' };

  logAdminAuditEvent({
    actorId: userId,
    action: 'update',
    resource: 'sites',
    resourceId: validId,
    metadata: { name, site_code: siteCode, active: data.active },
  });

  await updateTags(['table:sites']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true as const };
}

function buildBlockCode(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `BLK-${words.map((w) => w.slice(0, 3)).join('-')}`;
  }
  return `BLK-${(words[0] || '1').slice(0, 6)}`;
}

export async function adminAddMineBlock(rawInput: {
  name: string;
  code?: string;
  site_id?: string | null;
  active?: boolean;
}) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const normalizedInput = {
    ...rawInput,
    code: rawInput.code?.trim() || buildBlockCode(rawInput.name || ''),
  };
  const parseResult = adminAddMineBlockSchema.safeParse(normalizedInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid mine block data' };
  }
  const data = parseResult.data;

  const { supabase, userId } = auth;

  const name = data.name.trim();
  const code = data.code.trim().toUpperCase();

  const { error } = await supabase.from('mine_blocks').insert({
    name,
    code,
    site_id: data.site_id || null,
    active: data.active ?? true,
  });

  if (error) return { error: error.message || 'Failed to add mine block' };

  logAdminAuditEvent({
    actorId: userId,
    action: 'create',
    resource: 'mine_blocks',
    metadata: { name, code, site_id: data.site_id ?? null },
  });

  await updateTags(['table:mine_blocks']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true as const };
}

export async function adminDeleteMineBlock(id: string) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const idParse = blockUuidSchema.safeParse(id.trim());
  if (!idParse.success) {
    return { error: idParse.error.issues[0]?.message || 'Invalid mine block ID format' };
  }
  const validId = idParse.data;

  const { supabase, userId } = auth;

  let resolution: 'deleted' | 'deactivated' = 'deleted';
  const { error } = await supabase.from('mine_blocks').delete().eq('id', validId);
  if (error) {
    if (error.code !== POSTGRES_FOREIGN_KEY_VIOLATION) {
      return { error: error.message || 'Failed to remove mine block' };
    }
    resolution = 'deactivated';
    const { error: updateErr } = await supabase
      .from('mine_blocks')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', validId);
    if (updateErr) {
      return { error: updateErr.message || 'Failed to deactivate referenced mine block' };
    }
  }

  logAdminAuditEvent({
    actorId: userId,
    action: resolution === 'deleted' ? 'delete' : 'deactivate',
    resource: 'mine_blocks',
    resourceId: validId,
  });

  await updateTags(['table:mine_blocks']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true as const, resolution };
}

export async function adminUpdateMineBlock(
  id: string,
  rawInput: {
    name?: string;
    code?: string;
    site_id?: string | null;
    active?: boolean;
  }
) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parseResult = adminUpdateMineBlockSchema.safeParse({ id: id.trim(), ...rawInput });
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid mine block data' };
  }
  const data = parseResult.data;

  const { supabase, userId } = auth;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.code !== undefined) patch.code = data.code.trim().toUpperCase();
  if (data.site_id !== undefined) patch.site_id = data.site_id;
  if (data.active !== undefined) patch.active = data.active;

  const { error } = await supabase.from('mine_blocks').update(patch).eq('id', data.id);
  if (error) return { error: error.message || 'Failed to update mine block' };

  logAdminAuditEvent({
    actorId: userId,
    action: 'update',
    resource: 'mine_blocks',
    resourceId: data.id,
    metadata: { name: patch.name, code: patch.code, active: data.active },
  });

  await updateTags(['table:mine_blocks']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true as const };
}
