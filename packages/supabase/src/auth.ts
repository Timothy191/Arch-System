import { cacheGet, cacheSet } from '@repo/redis/cache';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './server';

/**
 * Authoritative shape of an employee row the rest of the app cares about.
 * Shared by the Edge proxy (for routing decisions) and server actions/API
 * routes (for authorization and audit logging).
 */
export interface EmployeeSummary {
  id: string;
  role: string;
  department_id: string;
  accessible_departments: string[];
}

export interface AuthenticatedPrincipal {
  user: User;
  /**
   * The authed user's employee row. `null` when the user is authenticated
   * but has no matching `employees` row (treat as 404, not 401).
   */
  employee: EmployeeSummary | null;
}

export const EMPLOYEE_CACHE_KEY = (userId: string): string => `arch:auth:employee:${userId}`;
const EMPLOYEE_CACHE_TTL_SEC = 3600;
const CACHE_TIMEOUT_MS = 150;

/**
 * Resolve the current authenticated user together with their authoritative
 * employee row (id, role, primary department, accessible departments).
 *
 * Cache: reads `arch:auth:employee:{userId}` in Redis with a 150 ms timeout.
 *   On miss, falls back to a direct DB query and repopulates the cache.
 *
 * Returns:
 * - `null` if the request is unauthenticated (caller should respond 401).
 * - `{ user, employee: null }` if the user is authenticated but has no
 *   matching employee row (caller should respond 404 or 403).
 * - `{ user, employee }` otherwise.
 *
 * Throws only if the DB query itself fails (treat as 500).
 *
 * Pass a pre-built `supabase` client to reuse an existing session-bound
 * client (avoids creating a duplicate per request). When omitted, a fresh
 * server client is created via `createServerSupabaseClient()`.
 */
export async function getAuthenticatedEmployee(
  supabase?: SupabaseClient
): Promise<AuthenticatedPrincipal | null> {
  const client = supabase ?? (await createServerSupabaseClient());

  const { data: userData } = await client.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return null;

  let employee: EmployeeSummary | null = null;
  try {
    const cachePromise = cacheGet<EmployeeSummary>(EMPLOYEE_CACHE_KEY(user.id));
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Redis cache timeout')), CACHE_TIMEOUT_MS)
    );
    employee = await Promise.race([cachePromise, timeoutPromise]);
  } catch {
    // Redis offline or slow — fall through to direct DB fetch.
    employee = null;
  }

  // Older cache entries (written before `id` was included) lack the `id`
  // field. Treat as a miss so audit-log writes always have a valid id.
  if (!employee?.id) {
    const { data } = await client
      .from('employees')
      .select('id, role, department_id, accessible_departments')
      .eq('auth_id', user.id)
      .single();
    employee = (data as EmployeeSummary | null) ?? null;
    if (employee) {
      await cacheSet(EMPLOYEE_CACHE_KEY(user.id), employee, EMPLOYEE_CACHE_TTL_SEC);
    }
  }

  return { user, employee };
}
