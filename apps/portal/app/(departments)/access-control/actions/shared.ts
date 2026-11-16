import {
  type AuthenticatedPrincipal,
  type EmployeeSummary,
  getAuthenticatedEmployee,
} from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { cache } from 'react';
import { AuthError, ForbiddenError } from '@/lib/errors/error-classes';

const getCachedAccessControlSession = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  return { supabase, principal };
});

export const ACCESS_CONTROL_WRITE_ROLES = ['admin', 'access_control', 'supervisor'] as const;

export interface AccessControlRoleGuard {
  /** Roles permitted for this operation (checked on every call, read or write). */
  readonly allowedRoles: readonly string[];
  /** Resource label recorded on the ForbiddenError for audit traceability. */
  readonly resource: string;
  readonly forbiddenMessage?: string;
}

type AccessControlSession = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: AuthenticatedPrincipal['user'];
  employee: EmployeeSummary;
};

/**
 * Role-scoped access-control guard: authenticates the caller and enforces an explicit
 * role allow-list on every invocation. Used by print-cards (NEO-300) and QR management.
 */
export async function assertAccessControlRoleFor(
  guard: AccessControlRoleGuard
): Promise<AccessControlSession> {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) throw new AuthError('Unauthorized');

  if (!guard.allowedRoles.includes(principal.employee.role)) {
    throw new ForbiddenError(
      guard.forbiddenMessage ?? 'Forbidden: access_control or admin role required',
      { resource: guard.resource, action: 'assert_role' }
    );
  }

  return { supabase, user: principal.user, employee: principal.employee };
}

export function hasAccessControlDepartmentPermission(
  employee: Pick<EmployeeSummary, 'role'> & {
    readonly accessible_departments?: readonly string[] | null;
  }
): boolean {
  if ((ACCESS_CONTROL_WRITE_ROLES as readonly string[]).includes(employee.role)) {
    return true;
  }
  const accessibleDepts = employee.accessible_departments;
  if (Array.isArray(accessibleDepts) && accessibleDepts.length > 0) {
    return accessibleDepts.includes('access-control');
  }
  return false;
}

/**
 * Shared auth helper for access-control server actions.
 * Not exported to clients: only consumed by sibling action modules.
 */
export async function assertAccessControlRole(options?: {
  requireWrite?: boolean;
}): Promise<AccessControlSession> {
  if (options?.requireWrite) {
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal?.employee) {
      throw new AuthError('Unauthorized: employee profile required for access control mutations');
    }
    if (!(ACCESS_CONTROL_WRITE_ROLES as readonly string[]).includes(principal.employee.role)) {
      throw new ForbiddenError('Forbidden: access_control, admin or supervisor role required', {
        resource: 'access_control',
        action: 'assert_role',
      });
    }
    return { supabase, user: principal.user, employee: principal.employee };
  }

  const { supabase, principal } = await getCachedAccessControlSession();

  if (!principal?.employee || !principal?.user) {
    throw new AuthError('Unauthorized: employee profile required for access control operations');
  }

  if (!hasAccessControlDepartmentPermission(principal.employee)) {
    throw new ForbiddenError('Forbidden: insufficient department access for access-control', {
      resource: 'access_control',
      action: 'assert_department_access',
    });
  }

  return { supabase, user: principal.user, employee: principal.employee };
}
