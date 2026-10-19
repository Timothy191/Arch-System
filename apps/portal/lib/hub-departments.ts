import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { withCache } from '@/lib/cache-utils';
import { cachedRSC } from '@/lib/server-cache';

/**
 * Hub department access and employee data utilities.
 *
 * This module centralizes department-related data fetching logic used across
 * the Hub route (layout.tsx and page.tsx). All functions implement dual-layer
 * caching (RSC cache + Redis) to ensure consistent cache coherency and prevent
 * redundant database queries during navigation.
 *
 * Functions:
 * - getAccessibleDepartmentNames: Department access control
 * - getEmployeeRole: User role authorization
 * - getEmployeeClearance: Employee data compliance status
 */

/**
 * Fetch the list of department names the given user can access.
 *
 * AGENT-TRACE: Shared between hub/layout.tsx and hub/page.tsx so both use the
 * same cached path (RSC cache + Redis cache) instead of the layout hitting the
 * read-replica uncached on every navigation.
 */
export async function getAccessibleDepartmentNames(
  userId: string,
  cookieList?: Array<{ name: string; value: string }>
): Promise<string[]> {
  return cachedRSC(
    ['user', userId, 'accessible-dept-names'],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const { data: empData } = await db
            .from('employees')
            .select('accessible_departments')
            .eq('auth_id', userId)
            .single();

          const accessibleDeptIds = (empData?.accessible_departments ?? []) as string[];
          if (accessibleDeptIds.length === 0) return [];

          const { data: deptData } = await db
            .from('departments')
            .select('name')
            .in('id', accessibleDeptIds);

          return (deptData ?? []).map((d) => d.name);
        },
        {
          category: CacheCategory.AUTH,
          keyParts: ['user', userId, 'accessible-dept-names'],
          tags: [`auth:${userId}`, 'table:employees', 'table:departments'],
        }
      );
    },
    {
      revalidate: 3600,
      tags: [`auth:${userId}`, 'table:employees', 'table:departments'],
    }
  );
}

/**
 * Fetch the role of the given user.
 */
export async function getEmployeeRole(
  userId: string,
  cookieList?: Array<{ name: string; value: string }>
): Promise<string | null> {
  return cachedRSC(
    ['user', userId, 'role'],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const { data } = await db.from('employees').select('role').eq('auth_id', userId).single();

          return data?.role ?? null;
        },
        {
          category: CacheCategory.AUTH,
          keyParts: ['user', userId, 'role'],
          tags: [`auth:${userId}`, 'table:employees'],
        }
      );
    },
    {
      revalidate: 3600,
      tags: [`auth:${userId}`, 'table:employees'],
    }
  );
}

export interface EmployeeClearance {
  state: 'clear' | 'missing' | 'expired' | 'unlinked';
  details: string[];
}

/**
 * Compute the current user's employee data-requirement clearance.
 *
 * Reads employees.employee_code → personnel.emp_code → medical/induction expiry.
 * Returns 'unlinked' when no personnel row matches, 'expired' when any required
 * date is missing or in the past, otherwise 'clear'.
 */
export async function getEmployeeClearance(
  userId: string,
  cookieList?: Array<{ name: string; value: string }>
): Promise<EmployeeClearance> {
  return cachedRSC(
    ['user', userId, 'clearance'],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);

          const { data: emp } = await db
            .from('employees')
            .select('employee_code')
            .eq('auth_id', userId)
            .single();

          if (!emp?.employee_code) {
            return {
              state: 'unlinked' as const,
              details: ['No personnel record linked to your account.'],
            };
          }

          const { data: personnel } = await db
            .from('personnel')
            .select('emp_code, induction_expiry, medical_expiry')
            .eq('emp_code', emp.employee_code)
            .single();

          if (!personnel) {
            return {
              state: 'unlinked' as const,
              details: ['No personnel record linked to your account.'],
            };
          }

          const now = new Date();
          const details: string[] = [];

          if (!personnel.medical_expiry || new Date(personnel.medical_expiry) <= now) {
            details.push('Medical clearance missing or expired');
          }
          if (!personnel.induction_expiry || new Date(personnel.induction_expiry) <= now) {
            details.push('Induction clearance missing or expired');
          }

          if (details.length > 0) {
            return { state: 'expired' as const, details };
          }

          return { state: 'clear' as const, details: [] };
        },
        {
          category: CacheCategory.AUTH,
          keyParts: ['user', userId, 'clearance'],
          tags: [`auth:${userId}`, 'table:employees', 'table:personnel'],
        }
      );
    },
    {
      revalidate: 3600,
      tags: [`auth:${userId}`, 'table:employees', 'table:personnel'],
    }
  );
}
