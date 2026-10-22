'use server';

import {
  adminAddMineBlockSchema,
  adminAddSiteSchema,
  adminUpdateMineBlockSchema,
  adminUpdateSiteSchema,
} from '@repo/contract/schemas/admin.schema';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

async function assertAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const };

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (employee?.role !== 'admin') {
    return { error: 'Forbidden: admin role required', status: 403 as const };
  }

  return { supabase, employee };
}

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
  const normalizedInput = {
    ...rawInput,
    site_code: rawInput.site_code?.trim() || buildSiteCode(rawInput.name || ''),
  };
  const parseResult = adminAddSiteSchema.safeParse(normalizedInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid site data' };
  }
  const data = parseResult.data;

  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name.trim();
  const siteCode = data.site_code.trim().toUpperCase();

  const { error } = await supabase.from('sites').insert({
    name,
    site_code: siteCode,
    active: data.active ?? true,
  });

  if (error) return { error: 'Failed to add site' };

  await cacheInvalidateTags(['table:sites']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true };
}

export async function adminDeleteSite(id: string) {
  if (!id.trim()) {
    return { error: 'Site ID is required' };
  }

  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const { error } = await supabase.from('sites').delete().eq('id', id);
  if (error) {
    // Fallback to deactivating if foreign keys reference the site
    const { error: updateErr } = await supabase
      .from('sites')
      .update({ active: false })
      .eq('id', id);
    if (updateErr) return { error: 'Failed to remove site' };
  }

  await cacheInvalidateTags(['table:sites']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true };
}

export async function adminUpdateSite(
  id: string,
  rawInput: {
    name?: string;
    site_code?: string;
    active?: boolean;
  }
) {
  const parseResult = adminUpdateSiteSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid site data' };
  }
  const data = parseResult.data;

  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name?.trim();
  const siteCode = data.site_code?.trim().toUpperCase();
  if (name !== undefined && !name) return { error: 'Site name cannot be empty.' };
  if (siteCode !== undefined && !siteCode) return { error: 'Site code cannot be empty.' };

  const { error } = await supabase
    .from('sites')
    .update({
      ...data,
      name,
      site_code: siteCode,
    })
    .eq('id', id);

  if (error) return { error: 'Failed to update site' };

  await cacheInvalidateTags(['table:sites']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true };
}

function buildBlockCode(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return 'BLK-' + words.map((w) => w.slice(0, 3)).join('-');
  }
  return 'BLK-' + (words[0] || '1').slice(0, 6);
}

export async function adminAddMineBlock(rawInput: {
  name: string;
  code?: string;
  site_id?: string | null;
  active?: boolean;
}) {
  const normalizedInput = {
    ...rawInput,
    code: rawInput.code?.trim() || buildBlockCode(rawInput.name || ''),
  };
  const parseResult = adminAddMineBlockSchema.safeParse(normalizedInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid mine block data' };
  }
  const data = parseResult.data;

  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name.trim();
  const code = data.code.trim().toUpperCase();

  const { error } = await supabase.from('mine_blocks').insert({
    name,
    code,
    site_id: data.site_id || null,
    active: data.active ?? true,
  });

  if (error) return { error: error.message || 'Failed to add mine block' };

  await cacheInvalidateTags(['table:mine_blocks']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true };
}

export async function adminDeleteMineBlock(id: string) {
  if (!id.trim()) {
    return { error: 'Mine block ID is required' };
  }

  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const { error } = await supabase.from('mine_blocks').delete().eq('id', id);
  if (error) {
    // Fallback to deactivating if referenced
    const { error: updateErr } = await supabase
      .from('mine_blocks')
      .update({ active: false })
      .eq('id', id);
    if (updateErr) return { error: updateErr.message || 'Failed to remove mine block' };
  }

  await cacheInvalidateTags(['table:mine_blocks']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true };
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
  const parseResult = adminUpdateMineBlockSchema.safeParse({ id, ...rawInput });
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid mine block data' };
  }
  const data = parseResult.data;

  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.code !== undefined) patch.code = data.code.trim().toUpperCase();
  if (data.site_id !== undefined) patch.site_id = data.site_id;
  if (data.active !== undefined) patch.active = data.active;

  const { error } = await supabase.from('mine_blocks').update(patch).eq('id', id);
  if (error) return { error: error.message || 'Failed to update mine block' };

  await cacheInvalidateTags(['table:mine_blocks']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true };
}
