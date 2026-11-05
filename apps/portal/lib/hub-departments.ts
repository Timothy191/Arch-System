import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { CACHE_TAGS, tagAuthUser } from '@/lib/cache-tags';
import { withCache } from '@/lib/cache-utils';
import { cacheLife, cacheTag } from '@/lib/server-cache';

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

interface EmployeeBaseRecord {
  full_name?: string | null;
  role?: string | null;
  employee_code?: string | null;
  accessible_departments?: string[] | null;
}

/**
 * Shared cached base lookup for a user's `employees` row so concurrent calls to
 * `getAccessibleDepartmentNames`, `getEmployeeRole`, `getEmployeeClearance`, and
 * `getEmployeeIdentity` deduplicate into a single `public.employees` query on
 * cold cache misses.
 */
async function getEmployeeBaseRecord(
  userId: string,
  cookieList?: Array<{ name: string; value: string }>
): Promise<EmployeeBaseRecord | null> {
  'use cache';

  const authTag = tagAuthUser(userId);
  cacheLife('hours');
  cacheTag(authTag);
  cacheTag(CACHE_TAGS.TABLE_EMPLOYEES);

  return withCache(
    async () => {
      const db = await createReadReplicaClient(cookieList);
      const query = db
        .from('employees')
        .select('full_name, role, employee_code, accessible_departments')
        .eq('auth_id', userId);
      const { data, error } = await (typeof query.single === 'function'
        ? query.single()
        : query.maybeSingle());
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch employee record: ${error.message}`);
      }
      return (data as EmployeeBaseRecord | null) ?? null;
    },
    {
      category: CacheCategory.AUTH,
      keyParts: ['user', userId, 'employee-record-v2'],
      tags: [authTag, CACHE_TAGS.TABLE_EMPLOYEES],
    }
  );
}

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
  'use cache';

  const authTag = tagAuthUser(userId);
  cacheLife('hours');
  cacheTag(authTag);
  cacheTag(CACHE_TAGS.TABLE_EMPLOYEES);
  cacheTag(CACHE_TAGS.TABLE_DEPARTMENTS);

  return withCache(
    async () => {
      const empData = await getEmployeeBaseRecord(userId, cookieList);
      const accessibleDeptIds = (empData?.accessible_departments ?? []) as string[];
      if (accessibleDeptIds.length === 0) return [];

      const db = await createReadReplicaClient(cookieList);
      const { data: deptData, error: deptError } = await db
        .from('departments')
        .select('name')
        .in('id', accessibleDeptIds);
      if (deptError) {
        throw new Error(`Failed to fetch accessible departments: ${deptError.message}`);
      }

      return (deptData ?? []).map((d) => d.name);
    },
    {
      category: CacheCategory.AUTH,
      keyParts: ['user', userId, 'accessible-dept-names-v2'],
      tags: [authTag, CACHE_TAGS.TABLE_EMPLOYEES, CACHE_TAGS.TABLE_DEPARTMENTS],
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
  'use cache';

  const authTag = tagAuthUser(userId);
  cacheLife('hours');
  cacheTag(authTag);
  cacheTag(CACHE_TAGS.TABLE_EMPLOYEES);

  return withCache(
    async () => {
      const data = await getEmployeeBaseRecord(userId, cookieList);
      return data?.role ?? null;
    },
    {
      category: CacheCategory.AUTH,
      keyParts: ['user', userId, 'role-v2'],
      tags: [authTag, CACHE_TAGS.TABLE_EMPLOYEES],
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
  'use cache';

  const authTag = tagAuthUser(userId);
  cacheLife('hours');
  cacheTag(authTag);
  cacheTag(CACHE_TAGS.TABLE_EMPLOYEES);
  cacheTag(CACHE_TAGS.TABLE_PERSONNEL);

  return withCache(
    async () => {
      const emp = await getEmployeeBaseRecord(userId, cookieList);

      if (!emp?.employee_code) {
        return {
          state: 'unlinked' as const,
          details: ['No personnel record linked to your account.'],
        };
      }

      const db = await createReadReplicaClient(cookieList);
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
      keyParts: ['user', userId, 'clearance-v2'],
      tags: [authTag, CACHE_TAGS.TABLE_EMPLOYEES, CACHE_TAGS.TABLE_PERSONNEL],
    }
  );
}

export interface EmployeeIdentityRecord {
  fullName: string | null;
  role: string | null;
}

/**
 * Fetch the display identity (full name and role) of the given user.
 * Cached via Next.js 16 'use cache' and Redis L1/L2.
 */
export async function getEmployeeIdentity(
  userId: string,
  cookieList?: Array<{ name: string; value: string }>
): Promise<EmployeeIdentityRecord> {
  'use cache';

  const authTag = tagAuthUser(userId);
  cacheLife('hours');
  cacheTag(authTag);
  cacheTag(CACHE_TAGS.TABLE_EMPLOYEES);

  return withCache(
    async () => {
      const data = await getEmployeeBaseRecord(userId, cookieList);
      return {
        fullName: data?.full_name?.trim() ?? null,
        role: data?.role ?? null,
      };
    },
    {
      category: CacheCategory.AUTH,
      keyParts: ['user', userId, 'identity-v2'],
      tags: [authTag, CACHE_TAGS.TABLE_EMPLOYEES],
    }
  );
}
