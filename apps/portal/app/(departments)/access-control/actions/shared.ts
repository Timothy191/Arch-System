import {
  type AuthenticatedPrincipal,
  type EmployeeSummary,
  getAuthenticatedEmployee,
} from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { cache } from 'react';
import { getDeptId } from '@/lib/dept-registry';
import { AuthError, ForbiddenError } from '@/lib/errors/error-classes';

const getCachedAccessControlSession = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const [principal, accessControlDeptId] = await Promise.all([
    getAuthenticatedEmployee(supabase),
    getDeptId('access-control'),
  ]);
  return { supabase, principal, accessControlDeptId };
});

export const ACCESS_CONTROL_WRITE_ROLES = ['admin', 'access_control', 'supervisor'] as const;

export { CANONICAL_MUSTER_STATIONS } from './constants';

export interface AccessControlRoleGuard {
  /** Roles permitted for this operation (checked on every call, read or write). */
  readonly allowedRoles: readonly string[];
  /** Resource label recorded on the ForbiddenError for audit traceability. */
  readonly resource: string;
  readonly forbiddenMessage?: string;
}

export type AccessControlSession = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: AuthenticatedPrincipal['user'];
  employee: EmployeeSummary;
  departmentId: string | null;
};

/** Resolve the canonical `access-control` department UUID (request-cached). */
export async function resolveAccessControlDeptId(): Promise<string | null> {
  return getDeptId('access-control');
}

/**
 * Role-scoped access-control guard: authenticates the caller and enforces an explicit
 * role allow-list plus department scoping for supervisors on every invocation.
 */
export async function assertAccessControlRoleFor(
  guard: AccessControlRoleGuard
): Promise<AccessControlSession> {
  const supabase = await createServerSupabaseClient();
  const [principal, departmentId] = await Promise.all([
    getAuthenticatedEmployee(supabase),
    getDeptId('access-control'),
  ]);
  if (!principal?.employee) throw new AuthError('Unauthorized');

  if (!guard.allowedRoles.includes(principal.employee.role)) {
    throw new ForbiddenError(
      guard.forbiddenMessage ?? 'Forbidden: access_control or admin role required',
      { resource: guard.resource, action: 'assert_role' }
    );
  }

  if (
    principal.employee.role === 'supervisor' &&
    !hasAccessControlWritePermission(principal.employee, departmentId)
  ) {
    throw new ForbiddenError(
      guard.forbiddenMessage ?? 'Forbidden: supervisor lacks access-control write permission',
      { resource: guard.resource, action: 'assert_department_write' }
    );
  }

  return { supabase, user: principal.user, employee: principal.employee, departmentId };
}

export function hasAccessControlDepartmentPermission(
  employee: Pick<EmployeeSummary, 'role'> & {
    readonly department_id?: string | null;
    readonly accessible_departments?: readonly string[] | null;
  },
  accessControlDeptId?: string | null
): boolean {
  if (employee.role === 'admin' || employee.role === 'access_control') {
    return true;
  }
  const accessibleDepts = employee.accessible_departments;
  if (accessControlDeptId) {
    if (employee.department_id === accessControlDeptId) {
      return true;
    }
    if (Array.isArray(accessibleDepts) && accessibleDepts.includes(accessControlDeptId)) {
      return true;
    }
    return false;
  }
  return Array.isArray(accessibleDepts) && accessibleDepts.includes('access-control');
}

export function hasAccessControlWritePermission(
  employee: Pick<EmployeeSummary, 'role'> & {
    readonly department_id?: string | null;
    readonly writable_departments?: readonly string[] | null;
    readonly accessible_departments?: readonly string[] | null;
  },
  accessControlDeptId?: string | null
): boolean {
  if (employee.role === 'admin' || employee.role === 'access_control') {
    return true;
  }
  if (employee.role !== 'supervisor') {
    return false;
  }
  if (accessControlDeptId) {
    if (Array.isArray(employee.writable_departments)) {
      return employee.writable_departments.includes(accessControlDeptId);
    }
    return employee.department_id === accessControlDeptId;
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
    const [principal, departmentId] = await Promise.all([
      getAuthenticatedEmployee(supabase),
      getDeptId('access-control'),
    ]);
    if (!principal?.employee) {
      throw new AuthError('Unauthorized: employee profile required for access control mutations');
    }
    if (!hasAccessControlWritePermission(principal.employee, departmentId)) {
      throw new ForbiddenError(
        'Forbidden: access_control, admin, or access-control scoped supervisor role required',
        {
          resource: 'access_control',
          action: 'assert_role',
        }
      );
    }
    return { supabase, user: principal.user, employee: principal.employee, departmentId };
  }

  const { supabase, principal, accessControlDeptId } = await getCachedAccessControlSession();

  if (!principal?.employee || !principal?.user) {
    throw new AuthError('Unauthorized: employee profile required for access control operations');
  }

  if (!hasAccessControlDepartmentPermission(principal.employee, accessControlDeptId)) {
    throw new ForbiddenError('Forbidden: insufficient department access for access-control', {
      resource: 'access_control',
      action: 'assert_department_access',
    });
  }

  return {
    supabase,
    user: principal.user,
    employee: principal.employee,
    departmentId: accessControlDeptId,
  };
}
