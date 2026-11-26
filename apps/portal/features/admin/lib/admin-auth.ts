import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { cache } from 'react';

export type AdminAccessResolution = 'unauthenticated' | 'forbidden' | 'authorized';

export interface RolesAccessResult {
  readonly status: AdminAccessResolution;
  readonly role: string | null;
}

type SupabaseClientFactory = typeof createServerSupabaseClient;

/**
 * Per-request memoized multi-role authorization check shared by `/admin/layout.tsx`
 * and `/admin/support/page.tsx` so Supabase session + `employees.role` run once per RSC render.
 */
export const resolveRolesAccess = cache(
  async (
    allowedRoles: readonly string[] = ['admin'],
    clientFactory: SupabaseClientFactory = createServerSupabaseClient
  ): Promise<RolesAccessResult> => {
    const supabase = await clientFactory();
    const user = await getUserSafely(supabase);

    if (!user) {
      return { status: 'unauthenticated', role: null };
    }

    const employeeQuery = supabase.from('employees').select('role').eq('auth_id', user.id);
    const activeEmployeeQuery =
      typeof employeeQuery.is === 'function' ? employeeQuery.is('deleted_at', null) : employeeQuery;
    const { data: employee } = await activeEmployeeQuery.single();

    const employeeRole = typeof employee?.role === 'string' ? employee.role : null;
    if (!employeeRole || !allowedRoles.includes(employeeRole)) {
      return { status: 'forbidden', role: employeeRole };
    }

    return { status: 'authorized', role: employeeRole };
  }
);

/**
 * Per-request memoized admin authorization check shared by `/admin/layout.tsx`
 * and `/admin/page.tsx` so Supabase session + `employees.role` run once per RSC render.
 */
export const resolveAdminAccess = cache(
  async (
    requiredRole = 'admin',
    clientFactory: SupabaseClientFactory = createServerSupabaseClient
  ): Promise<AdminAccessResolution> => {
    const result = await resolveRolesAccess([requiredRole], clientFactory);
    return result.status;
  }
);
