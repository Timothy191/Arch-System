import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { AuthError, ForbiddenError } from '@/lib/errors/error-classes';

/**
 * Shared auth helper for access-control server actions.
 * Not exported to clients: only consumed by sibling action modules.
 */
export async function assertAccessControlRole(options?: { requireWrite?: boolean }): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: any;
  employee: any;
}> {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);

  if (options?.requireWrite) {
    if (!principal?.employee) {
      throw new AuthError('Unauthorized: employee profile required for access control mutations');
    }
    if (!['admin', 'access_control', 'supervisor'].includes(principal.employee.role)) {
      throw new ForbiddenError('Forbidden: access_control, admin or supervisor role required', {
        resource: 'access_control',
        action: 'assert_role',
      });
    }
    return { supabase, user: principal.user, employee: principal.employee };
  }

  // Permissive read access for all authenticated staff (operator, supervisor, admin, access_control)
  const user = principal?.user ?? null;
  const employee = principal?.employee ?? null;
  return { supabase, user, employee };
}
