'use server';

import {
  type AdminMineralRegistry,
  adminMineralRegistrySchema,
} from '@repo/contract/schemas/admin.schema';
import { AuthError, DatabaseError } from '@repo/errors';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
import { assertAdmin, logAdminAuditEvent } from './shared';

const DEFAULT_WASTE_MINERALS: readonly string[] = [
  'Dyke',
  'Overburden',
  'Interburden',
  'Topsoil',
  'Waste',
  'Other',
];

const DEFAULT_COAL_MINERALS: readonly string[] = [
  '2#Lower',
  '2#Upper',
  '4#Lower',
  '4#Upper',
  'Seam 1',
  'Seam 2',
  'Raw Coal',
  'Other',
];

export async function getMineralRegistry(): Promise<AdminMineralRegistry> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthError('Unauthorized', { context: { action: 'getMineralRegistry' } });
  }

  let query = supabase
    .from('report_templates')
    .select('config')
    .eq('report_type', 'mineral_registry');
  if (typeof (query as { is?: unknown }).is === 'function') {
    query = (query as unknown as { is: (col: string, val: null) => typeof query }).is(
      'deleted_at',
      null
    );
  }
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new DatabaseError('Failed to load mineral registry', {
      operation: 'select',
      table: 'report_templates',
      context: { error: error.message },
    });
  }

  if (data?.config && typeof data.config === 'object') {
    const parsed = adminMineralRegistrySchema.safeParse(data.config);
    if (parsed.success) {
      return parsed.data;
    }
  }

  return {
    waste: [...DEFAULT_WASTE_MINERALS],
    coal: [...DEFAULT_COAL_MINERALS],
  };
}

export async function adminSaveMineralRegistry(rawInput: { waste: string[]; coal: string[] }) {
  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const parseResult = adminMineralRegistrySchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid mineral data' };
  }
  const config = parseResult.data;

  const { supabase } = auth;

  let existingQuery = supabase
    .from('report_templates')
    .select('id')
    .eq('report_type', 'mineral_registry');
  if (typeof (existingQuery as { is?: unknown }).is === 'function') {
    existingQuery = (
      existingQuery as unknown as { is: (col: string, val: null) => typeof existingQuery }
    ).is('deleted_at', null);
  }
  const { data: existing, error: lookupError } = await existingQuery.maybeSingle();

  if (lookupError) {
    return { error: lookupError.message || 'Failed to inspect mineral registry' };
  }

  if (existing) {
    const { error } = await supabase
      .from('report_templates')
      .update({
        config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) return { error: error.message || 'Failed to update mineral registry' };
  } else {
    const { error } = await supabase.from('report_templates').insert({
      name: 'Mineral Registry',
      description: 'Registered minerals for Waste and Coal operations',
      report_type: 'mineral_registry',
      config,
    });
    if (error) return { error: error.message || 'Failed to save mineral registry' };
  }

  await updateTags(['config:mineral_registry']);
  logAdminAuditEvent({
    actorId: auth.userId,
    action: existing ? 'update' : 'create',
    resource: 'mineral_registry',
    resourceId: existing?.id ?? null,
    metadata: { wasteCount: config.waste.length, coalCount: config.coal.length },
  });
  revalidatePath('/admin');
  revalidatePath('/control-room/hourly-loads');
  revalidatePath('/control-room');
  return { success: true as const };
}
