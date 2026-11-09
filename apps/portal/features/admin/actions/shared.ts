import { createServerSupabaseClient } from '@repo/supabase/server';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

/**
 * Shared admin guard for admin server actions (fleet, minerals, sites, targets).
 * Intentionally NOT a `'use server'` module: it is an internal helper consumed by
 * sibling action files and must never be exposed as a client-callable action.
 */
export async function assertAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: HTTP_UNAUTHORIZED } as const;

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (employee?.role !== 'admin') {
    return { error: 'Forbidden: admin role required', status: HTTP_FORBIDDEN } as const;
  }

  return { supabase, employee };
}
