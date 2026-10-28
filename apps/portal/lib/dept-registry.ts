import { createServerSupabaseClient } from '@repo/supabase/server';

const deptCache = new Map<string, string>();

/** Virtual modules that fall back to the `production` department row. */
const PRODUCTION_FALLBACK_SLUGS = new Set([
  'plant-processing',
  'plant-inventory',
  'database',
  'overview',
]);

export async function getDeptId(slug: string): Promise<string | null> {
  const cached = deptCache.get(slug);
  if (cached) {
    return cached;
  }

  const supabase = await createServerSupabaseClient();
  const lookup = (name: string) =>
    supabase.from('departments').select('id').eq('name', name).single();

  // PERF: for virtual slugs, query the primary row and the fallback row in
  // parallel instead of waiting for the primary lookup to fail first.
  const shouldFallback = PRODUCTION_FALLBACK_SLUGS.has(slug);
  const [primary, fallback] = await Promise.all([
    lookup(slug),
    shouldFallback ? lookup('production') : Promise.resolve(null),
  ]);

  const resolvedId = (!primary.error && primary.data?.id) || fallback?.data?.id || null;
  if (!resolvedId) {
    return null;
  }

  deptCache.set(slug, resolvedId);
  return resolvedId;
}

export function clearDeptCache(): void {
  deptCache.clear();
}
