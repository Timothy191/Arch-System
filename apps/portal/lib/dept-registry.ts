import { createServerSupabaseClient } from '@repo/supabase/server';

const deptCache = new Map<string, string>();

/**
 * Canonical department UUIDs from the production Supabase `departments` table.
 * Used as a 0ms fast-path in Edge/Node route access checks when an employee's
 * `department_id` or `accessible_departments` matches one of these IDs.
 */
export const STATIC_DEPT_UUIDS: Readonly<Record<string, string>> = {
  'control-room': '0f160914-d92e-45d9-9547-d3d1a11ef6a1',
};

/** Virtual modules that fall back to the `production` department row. */
const PRODUCTION_FALLBACK_SLUGS = new Set([
  'plant-processing',
  'plant-inventory',
  'database',
  'overview',
  'availability-utilization',
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
