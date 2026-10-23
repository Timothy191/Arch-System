'use server';

import {
  type AdminOperationalTargets,
  adminOperationalTargetsSchema,
} from '@repo/contract/schemas/admin.schema';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

const DEFAULT_OPERATIONAL_TARGETS: AdminOperationalTargets = {
  shift: {
    loadsTarget: 180,
    coalTonnesTarget: 4500,
    wasteTonnesTarget: 8200,
    volumeBcmTarget: 5400,
    smrHoursTarget: 96,
  },
  daily: {
    loadsTarget: 360,
    coalTonnesTarget: 9000,
    wasteTonnesTarget: 16400,
    volumeBcmTarget: 10800,
    smrHoursTarget: 192,
  },
  monthly: {
    loadsTarget: 10800,
    coalTonnesTarget: 270000,
    wasteTonnesTarget: 492000,
    volumeBcmTarget: 324000,
    smrHoursTarget: 5760,
  },
};

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

export async function getOperationalTargets(): Promise<AdminOperationalTargets> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from('report_templates')
      .select('config')
      .eq('report_type', 'operational_targets')
      .maybeSingle();

    if (data?.config && typeof data.config === 'object') {
      const parsed = adminOperationalTargetsSchema.safeParse(data.config);
      if (parsed.success) {
        return parsed.data;
      }
    }
  } catch {
    // Fallback to industrial defaults
  }
  return DEFAULT_OPERATIONAL_TARGETS;
}

export async function adminSaveOperationalTargets(rawInput: AdminOperationalTargets) {
  const parseResult = adminOperationalTargetsSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid operational targets data' };
  }
  const config = parseResult.data;

  const auth = await assertAdmin();
  if ('error' in auth) return { error: auth.error };

  const { supabase } = auth;

  const { data: existing } = await supabase
    .from('report_templates')
    .select('id')
    .eq('report_type', 'operational_targets')
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('report_templates')
      .update({
        config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) return { error: 'Failed to update operational targets' };
  } else {
    const { error } = await supabase.from('report_templates').insert({
      name: 'Operational Targets (Shift, Daily, Monthly)',
      description:
        'Configured Shift, Daily, and Monthly KPI targets for Control Room & Production telemetry',
      report_type: 'operational_targets',
      config,
    });
    if (error) return { error: 'Failed to save operational targets' };
  }

  await cacheInvalidateTags(['config:operational_targets']);
  revalidatePath('/admin');
  revalidatePath('/control-room');
  revalidatePath('/production');
  return { success: true };
}
