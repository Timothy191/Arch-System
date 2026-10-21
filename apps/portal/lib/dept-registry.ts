import { createServerSupabaseClient } from '@repo/supabase/server';

const deptCache = new Map<string, string>();

export async function getDeptId(slug: string): Promise<string | null> {
  const cached = deptCache.get(slug);
  if (cached) {
    return cached;
  }

  // Not in cache, fetch from DB
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('departments').select('id').eq('name', slug).single();

  if (error || !data) {
    if (slug === 'plant-processing') {
      const { data: fallbackData } = await supabase
        .from('departments')
        .select('id')
        .eq('name', 'production')
        .single();
      if (fallbackData?.id) {
        deptCache.set(slug, fallbackData.id);
        return fallbackData.id;
      }
    }
    return null;
  }

  deptCache.set(slug, data.id);
  return data.id;
}

export function clearDeptCache(): void {
  deptCache.clear();
}
