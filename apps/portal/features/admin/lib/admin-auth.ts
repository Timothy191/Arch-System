import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { cache } from 'react';

export type AdminAccessResolution = 'unauthenticated' | 'forbidden' | 'authorized';

type SupabaseClientFactory = typeof createServerSupabaseClient;

/**
 * Per-request memoized admin authorization check shared by `/admin/layout.tsx`
 * and `/admin/page.tsx` so Supabase session + `employees.role` run once per RSC render.
 */
export const resolveAdminAccess = cache(
  async (
    requiredRole = 'admin',
    clientFactory: SupabaseClientFactory = createServerSupabaseClient
  ): Promise<AdminAccessResolution> => {
    const supabase = await clientFactory();
    const user = await getUserSafely(supabase);

    if (!user) {
      return 'unauthenticated';
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (employee?.role !== requiredRole) {
      return 'forbidden';
    }

    return 'authorized';
  }
);
