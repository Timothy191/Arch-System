'use server';

import {
  type AdminMineralRegistry,
  adminMineralRegistrySchema,
} from '@repo/contract/schemas/admin.schema';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

export const DEFAULT_WASTE_MINERALS: readonly string[] = [
  'Dyke',
  'Overburden',
  'Interburden',
  'Topsoil',
  'Waste',
  'Other',
];

export const DEFAULT_COAL_MINERALS: readonly string[] = [
  '2#Lower',
  '2#Upper',
  '4#Lower',
  '4#Upper',
  'Seam 1',
  'Seam 2',
  'Raw Coal',
  'Other',
];

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

export async function getMineralRegistry(): Promise<AdminMineralRegistry> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from('report_templates')
      .select('config')
      .eq('report_type', 'mineral_registry')
      .maybeSingle();

    if (data?.config && typeof data.config === 'object') {
      const parsed = adminMineralRegistrySchema.safeParse(data.config);
      if (parsed.success) {
        return parsed.data;
      }
    }
  } catch {
    // Fallback to industrial defaults
  }
  return {
    waste: [...DEFAULT_WASTE_MINERALS],
    coal: [...DEFAULT_COAL_MINERALS],
  };
}

export async function adminSaveMineralRegistry(rawInput: { waste: string[]; coal: string[] }) {
  const parseResult = adminMineralRegistrySchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid mineral data' };
  }
  const config = parseResult.data;

  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const { data: existing } = await supabase
    .from('report_templates')
    .select('id')
    .eq('report_type', 'mineral_registry')
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('report_templates')
      .update({
        config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) return { error: 'Failed to update mineral registry' };
  } else {
    const { error } = await supabase.from('report_templates').insert({
      name: 'Mineral Registry',
      description: 'Registered minerals for Waste and Coal operations',
      report_type: 'mineral_registry',
      config,
    });
    if (error) return { error: 'Failed to save mineral registry' };
  }

  await cacheInvalidateTags(['config:mineral_registry']);
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true };
}
